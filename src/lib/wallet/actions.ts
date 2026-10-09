"use server";

import { audit } from "@/lib/admin/core";
import { refresh } from "next/cache";
import { adminUser } from "@/lib/admin/core";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import { notify } from "@/lib/notifications";
import { getPayoutGateway } from "@/lib/payouts";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";

type Fail = { ok: false; error: { key: MessageKey; params?: MessageParams } };
const fail = (key: MessageKey, params?: MessageParams): Fail => ({ ok: false, error: { key, params } });
const UUID = /^[0-9a-f-]{36}$/i;

/**
 * D-11: a designer withdraws. The balance goes down at once; bKash withdrawals are sent
 * automatically when the payout driver can, everything else waits for an admin (BLUEPRINT §7.3).
 */
export async function requestWithdrawal(input: { amount: number; methodId: string }): Promise<{ ok: true; status: "paid" | "requested"; txnId: string | null } | Fail> {
  if (!isSupabaseConfigured()) return fail("auth.errors.notConfigured");
  const user = await getCurrentUser();
  if (!user || user.role !== "designer" || user.status !== "active") return fail("auth.errors.generic");
  const min = await getSetting("limits.withdrawal_min");
  if (!Number.isInteger(input.amount) || input.amount < min) return fail("wallet.errors.min", { min });
  if (!UUID.test(input.methodId)) return fail("wallet.errors.method");

  const db = createAdminClient();
  const { data: w, error } = await db.rpc("request_withdrawal", { p_designer_id: user.id, p_amount: input.amount, p_payout_method_id: input.methodId, p_min: min });
  if (error || !w) return fail(error?.code === "P0002" ? "wallet.errors.method" : "wallet.errors.balance");
  const withdrawal = w as { id: string; method_type: string; destination: { bkash_number?: string } };

  if (withdrawal.method_type === "bkash" && withdrawal.destination.bkash_number) {
    const gateway = getPayoutGateway();
    if (gateway.sendsBkash) {
      const sent = await gateway.sendBkash({ withdrawalId: withdrawal.id, amount: input.amount, bkashNumber: withdrawal.destination.bkash_number });
      if (sent.ok) {
        await db.rpc("mark_withdrawal_paid", { p_withdrawal_id: withdrawal.id, p_txn_id: sent.txnId, p_gateway: gateway.name, p_by: null });
        await notify([user.id], "withdrawal_paid", { amount: input.amount }, "/dashboard/wallet");
        refresh();
        return { ok: true, status: "paid", txnId: sent.txnId };
      }
      console.error("[payouts] bKash payout failed, sent to the admin queue:", sent.error);
    }
  }
  refresh();
  return { ok: true, status: "requested", txnId: null };
}

/** Admins with the Withdrawals "manage" permission (BLUEPRINT §13.2). */
async function admin() {
  return adminUser("withdrawals.manage");
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
  await notify([w.designer_id], "withdrawal_paid", { amount: w.amount }, "/dashboard/wallet");
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
