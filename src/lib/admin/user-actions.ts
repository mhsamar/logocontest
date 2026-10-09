"use server";

import { refresh } from "next/cache";
import type { MessageKey } from "@/lib/i18n/translate";
import { notify } from "@/lib/notifications";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminUser, audit, cleanReason, UUID } from "./core";

type Result = { ok: true } | { ok: false; error: MessageKey };
type Fields = Record<string, string>;
const fail = (error: MessageKey): Result => ({ ok: false, error });

/** A-05: a strike from an admin (BLUEPRINT §10: 1 warning, 2 suspension, 3 ban). */
export async function giveStrike(userId: string, f: Fields): Promise<Result> {
  const input = { userId, reason: f.reason ?? "" };
  const admin = await adminUser();
  if (!admin || !UUID.test(input.userId) || input.userId === admin.id) return fail("auth.errors.generic");
  const reason = cleanReason(input.reason);
  if (!reason) return fail("admin.errors.reason");
  const days = await getSetting("timers.strike_suspension_days");
  const { data, error } = await createAdminClient().rpc("give_strike", {
    p_user_id: input.userId,
    p_reason: reason,
    p_entry_id: null,
    p_contest_id: null,
    p_issued_by: admin.id,
    p_issuer_role: "admin",
    p_suspend_days: days,
  });
  if (error) return fail("admin.errors.generic");
  const p = data as { status: string; strikes: number };
  await audit(admin.id, "give_strike", "user", input.userId, { reason, strikes: p.strikes, status: p.status });
  await notify([input.userId], "strike_received", { reason, number: p.strikes }, "/dashboard", admin.id);
  refresh();
  return { ok: true };
}

export async function removeStrike(strikeId: string, f: Fields): Promise<Result> {
  const input = { strikeId, reason: f.reason ?? "" };
  const admin = await adminUser();
  if (!admin || !UUID.test(input.strikeId)) return fail("auth.errors.generic");
  const reason = cleanReason(input.reason);
  if (!reason) return fail("admin.errors.reason");
  const days = await getSetting("timers.strike_suspension_days");
  const { data, error } = await createAdminClient().rpc("remove_strike", { p_strike_id: input.strikeId, p_admin_id: admin.id, p_suspend_days: days });
  if (error || !data) return fail("admin.errors.generic");
  const p = data as { id: string; strikes: number };
  await audit(admin.id, "remove_strike", "user", p.id, { strike: input.strikeId, reason, strikes: p.strikes });
  refresh();
  return { ok: true };
}

/** A-05: suspend (for N days), ban, or make active again. Never your own account. */
export async function setUserStatus(userId: string, status: string, f: Fields): Promise<Result> {
  const input = { userId, status, days: Number(f.days ?? 0), reason: f.reason ?? "" };
  const admin = await adminUser();
  if (!admin || !UUID.test(input.userId) || input.userId === admin.id || !["active", "suspended", "banned"].includes(input.status)) return fail("auth.errors.generic");
  const reason = cleanReason(input.reason);
  if (!reason) return fail("admin.errors.reason");
  const days = Math.floor(Number(input.days));
  if (input.status === "suspended" && !(days >= 1 && days <= 365)) return fail("admin.errors.days");
  const until = input.status === "suspended" ? new Date(Date.now() + days * 86_400_000).toISOString() : null;
  const { error } = await createAdminClient().from("profiles").update({ status: input.status, suspended_until: until }).eq("id", input.userId);
  if (error) return fail("admin.errors.generic");
  const action = input.status === "banned" ? "ban_user" : input.status === "suspended" ? "suspend_user" : "reactivate_user";
  await audit(admin.id, action, "user", input.userId, { reason, days: input.status === "suspended" ? days : undefined });
  if (input.status !== "active") await notify([input.userId], input.status === "banned" ? "account_banned" : "account_suspended", { reason, days: input.status === "suspended" ? days : undefined }, null, admin.id);
  refresh();
  return { ok: true };
}
