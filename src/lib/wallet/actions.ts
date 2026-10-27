"use server";

import { audit } from "@/lib/admin/core";
import { refresh } from "next/cache";
import { after } from "next/server";
import { adminUser } from "@/lib/admin/core";
import { normalizeBdMobile } from "@/lib/phone";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import { formatTaka } from "@/lib/money";
import { notify } from "@/lib/notifications";
import { alertAdmins } from "@/lib/notifications/admin-alerts";
import { payoutGateway } from "@/lib/payouts";
import { bkashPayoutsReady } from "@/lib/payouts/ready";
import { SETTINGS } from "@/lib/settings/registry";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { settingsChanged } from "@/lib/settings";

type Fail = { ok: false; error: { key: MessageKey; params?: MessageParams } };
const fail = (key: MessageKey, params?: MessageParams): Fail => ({ ok: false, error: { key, params } });
const UUID = /^[0-9a-f-]{36}$/i;

/**
 * D-11: a designer withdraws. The balance goes down at once; bKash withdrawals are sent
 * automatically when the payout driver can, everything else waits for an admin (BLUEPRINT §7.3).
 */
export async function requestWithdrawal(input: {
  amount: number;
  /** A saved bank account; or `bkash` with the number and Personal / Agent (owner, 2026-10-12). */
  methodId?: string;
  bkash?: { number: string; kind: string };
}): Promise<{ ok: true; status: "paid" | "requested"; txnId: string | null } | Fail> {
  if (!isSupabaseConfigured()) return fail("auth.errors.notConfigured");
  const user = await getCurrentUser();
  if (!user || user.role !== "designer" || user.status === "banned") return fail("auth.errors.generic");
  const min = await getSetting("limits.withdrawal_min");
  if (!Number.isInteger(input.amount) || input.amount < min) return fail("wallet.errors.min", { min });

  const db = createAdminClient();
  let methodId = input.methodId ?? "";
  if (input.bkash) {
    // The bKash number typed in the form becomes the designer's saved bKash method.
    const number = normalizeBdMobile(input.bkash.number);
    if (!number) return fail("wallet.errors.bkashNumber");
    if (input.bkash.kind !== "personal" && input.bkash.kind !== "agent") return fail("wallet.errors.bkashKind");
    const { data: saved } = await db.from("designer_payout_methods").select("id").eq("user_id", user.id).eq("type", "bkash").order("is_default", { ascending: false }).limit(1).maybeSingle();
    const row = { bkash_number: number, bkash_kind: input.bkash.kind };
    const { data: m, error: mError } = saved
      ? await db.from("designer_payout_methods").update(row).eq("id", saved.id).select("id").single()
      : await db.from("designer_payout_methods").insert({ user_id: user.id, type: "bkash", is_default: true, ...row }).select("id").single();
    if (mError || !m) return fail("auth.errors.generic");
    methodId = m.id as string;
  }
  if (!UUID.test(methodId)) return fail("wallet.errors.method");

  const { data: w, error } = await db.rpc("request_withdrawal", { p_designer_id: user.id, p_amount: input.amount, p_payout_method_id: methodId, p_min: min });
  if (error || !w) return fail(error?.code === "P0002" ? "wallet.errors.method" : "wallet.errors.balance");
  const withdrawal = w as { id: string; method_type: string; destination: { bkash_number?: string } };

  if (withdrawal.method_type === "bkash" && withdrawal.destination.bkash_number) {
    const gateway = await payoutGateway();
    if (gateway.sendsBkash) {
      const sent = await gateway.sendBkash({ withdrawalId: withdrawal.id, amount: input.amount, bkashNumber: withdrawal.destination.bkash_number });
      if (sent.ok) {
        await db.rpc("mark_withdrawal_paid", { p_withdrawal_id: withdrawal.id, p_txn_id: sent.txnId, p_gateway: gateway.name, p_by: null });
        await notify([user.id], "withdrawal_paid", { amount: input.amount }, "/dashboard/wallet#payout-card");
        refresh();
        return { ok: true, status: "paid", txnId: sent.txnId };
      }
      console.error("[payouts] bKash payout failed, sent to the admin queue:", sent.error);
    }
  }
  // The admins hear about every request waiting to be paid (owner, 2026-10-12), on the phone and by email too (2026-10-22).
  after(() =>
    alertAdmins({
      permission: "withdrawals.manage",
      bellPermission: "withdrawals.view",
      type: "withdrawal_requested_admin",
      data: { name: user.name, amount: input.amount },
      path: "/admin/withdrawals",
      actorId: user.id,
      notice: "admin_payments",
      ref: withdrawal.id,
      subject: "admin.alerts.withdrawal.subject",
      body: "admin.alerts.withdrawal.body",
      params: (_t, locale) => ({ name: user.name, amount: formatTaka(input.amount, locale) }),
    }),
  );
  refresh();
  return { ok: true, status: "requested", txnId: null };
}

/** Admins with the Withdrawals "manage" permission (BLUEPRINT §13.2). */
async function admin() {
  return adminUser("withdrawals.manage");
}

/**
 * Admin › Withdrawals (owner, 2026-10-15): automatic bKash withdrawals on or off. It can only be switched on once the
 * bKash payout API is connected on this server.
 */
export async function setAutoWithdrawals(on: boolean): Promise<{ ok: true } | Fail> {
  const user = await admin();
  if (!user || typeof on !== "boolean") return fail("auth.errors.generic");
  if (on && !bkashPayoutsReady()) return fail("admin.withdrawals.auto.errors.notReady");
  const { error } = await createAdminClient()
    .from("settings")
    .upsert({ key: "payouts.auto_bkash", value: on, type: "bool", group: "payouts", description: SETTINGS["payouts.auto_bkash"].description, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "key" });
  settingsChanged();
  if (error) return fail("auth.errors.generic");
  await audit(user.id, on ? "payouts.auto_on" : "payouts.auto_off", "settings", "payouts.auto_bkash");
  refresh();
  return { ok: true };
}

/** Admin: the money was sent by hand; records the transaction ID. */
export async function markWithdrawalPaid(input: { id: string; txnId: string }): Promise<{ ok: true } | Fail> {
  const user = await admin();
  if (!user || !UUID.test(input.id)) return fail("auth.errors.generic");
  const txn = input.txnId.trim();
  if (txn.length < 4 || txn.length > 60) return fail("wallet.errors.txn");
  const { data, error } = await createAdminClient().rpc("mark_withdrawal_paid", { p_withdrawal_id: input.id, p_txn_id: txn, p_gateway: "manual", p_by: user.id });
  if (error || !data) return fail("auth.errors.generic");
  const w = data as { designer_id: string; amount: number };
  await audit(user.id, "mark_withdrawal_paid", "withdrawal", input.id, { amount: w.amount, txn });
  // With the "Payment sent" card on the wallet page (owner, 2026-10-12).
  await notify([w.designer_id], "withdrawal_paid", { amount: w.amount }, "/dashboard/wallet#payout-card");
  refresh();
  return { ok: true };
}

/** Admin: rejects a withdrawal with a reason; the amount goes back to the wallet. */
export async function rejectWithdrawal(input: { id: string; reason: string }): Promise<{ ok: true } | Fail> {
  const user = await admin();
  if (!user || !UUID.test(input.id)) return fail("auth.errors.generic");
  const reason = input.reason.trim();
  if (reason.length < 5 || reason.length > 300) return fail("wallet.errors.reason");
  const { data, error } = await createAdminClient().rpc("reject_withdrawal", { p_withdrawal_id: input.id, p_reason: reason, p_by: user.id });
  if (error || !data) return fail("auth.errors.generic");
  const w = data as { designer_id: string; amount: number };
  await audit(user.id, "reject_withdrawal", "withdrawal", input.id, { amount: w.amount, reason });
  await notify([w.designer_id], "withdrawal_rejected", { amount: w.amount }, "/dashboard/wallet");
  refresh();
  return { ok: true };
}
