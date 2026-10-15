"use server";

import { refresh } from "next/cache";
import type { MessageKey } from "@/lib/i18n/translate";
import { suspendUser, tellUser } from "@/lib/moderation/suspension";
import { isPersonName } from "@/lib/profile/name-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminUser, audit, cleanReason, UUID } from "./core";

type Result = { ok: true } | { ok: false; error: MessageKey };
type Fields = Record<string, string>;
const fail = (error: MessageKey): Result => ({ ok: false, error });

/** Suspensions and bans are for clients and designers only: never an admin or a super admin (owner, 2026-10-12). */
async function actionable(userId: string): Promise<boolean> {
  const { data } = await createAdminClient().from("profiles").select("role, is_super_admin").eq("id", userId).maybeSingle();
  return Boolean(data) && data!.role !== "admin" && !data!.is_super_admin;
}

/**
 * A-05 Suspend for 48 hours (owner, 2026-10-12): one row in strikes, ends on its own; the 3rd within 30 days bans
 * the account. For misuse such as contact details, a fake NID/passport/birth certificate, or rude comments.
 */
export async function giveStrike(userId: string, f: Fields): Promise<Result> {
  const admin = await adminUser("users.manage");
  if (!admin || !UUID.test(userId) || userId === admin.id) return fail("auth.errors.generic");
  const reason = cleanReason(f.reason ?? "");
  if (!reason) return fail("admin.errors.reason");
  if (!(await actionable(userId))) return fail("admin.users.x.actions.notStaff");
  const p = await suspendUser({ userId, reason, issuedBy: admin.id, issuerRole: "admin" });
  if (!p) return fail("admin.errors.generic");
  await audit(admin.id, p.status === "banned" ? "ban_user" : "suspend_user", "user", userId, { reason, suspensions: p.strikes, until: p.suspendedUntil });
  refresh();
  return { ok: true };
}

/** Takes one suspension off the count (it no longer counts toward a ban). Never lifts a ban or the current hold. */
export async function removeStrike(strikeId: string, f: Fields): Promise<Result> {
  const admin = await adminUser("users.manage");
  if (!admin || !UUID.test(strikeId)) return fail("auth.errors.generic");
  const reason = cleanReason(f.reason ?? "");
  if (!reason) return fail("admin.errors.reason");
  const { data, error } = await createAdminClient().rpc("remove_strike", { p_strike_id: strikeId, p_admin_id: admin.id, p_suspend_days: 0 });
  if (error || !data) return fail("admin.errors.generic");
  const p = data as { id: string; strikes: number };
  await audit(admin.id, "remove_strike", "user", p.id, { strike: strikeId, reason, suspensions: p.strikes });
  refresh();
  return { ok: true };
}

/**
 * A-05: ban for good, or make the account active again (lifts a suspension early, or a ban). Never your own account.
 * Suspending goes through giveStrike, so every suspension counts toward the ban.
 */
export async function setUserStatus(userId: string, status: string, f: Fields): Promise<Result> {
  const admin = await adminUser("users.manage");
  if (!admin || !UUID.test(userId) || userId === admin.id || !["active", "banned"].includes(status)) return fail("auth.errors.generic");
  const reason = cleanReason(f.reason ?? "");
  if (!reason) return fail("admin.errors.reason");
  if (!(await actionable(userId))) return fail("admin.users.x.actions.notStaff");
  const { error } = await createAdminClient().from("profiles").update({ status, suspended_until: null }).eq("id", userId);
  if (error) return fail("admin.errors.generic");
  await audit(admin.id, status === "banned" ? "ban_user" : "reactivate_user", "user", userId, { reason });
  await tellUser(userId, status === "banned" ? "banned" : "reactivated", reason, null, admin.id);
  refresh();
  return { ok: true };
}

/**
 * Marks an account as a test account, or back (owner, 2026-10-11): test accounts never take part in the monthly
 * race (smartphone and gift box) and are the only ones counted in its test mode.
 */
export async function setTestAccount(userId: string, on: boolean): Promise<Result> {
  const admin = await adminUser("users.manage");
  if (!admin || !UUID.test(userId)) return fail("auth.errors.generic");
  const { data, error } = await createAdminClient().from("profiles").update({ is_test: on }).eq("id", userId).neq("role", "admin").select("id").maybeSingle();
  if (error || !data) return fail("admin.errors.generic");
  await audit(admin.id, on ? "mark_test_account" : "unmark_test_account", "user", userId, {});
  refresh();
  return { ok: true };
}

/**
 * Correct a person's name (owner, 2026-10-16): people can't change their own name, since it is checked against
 * payments and payouts; the team corrects a mistake, with a reason, and it is written to the audit log.
 */
export async function correctUserName(userId: string, f: Fields): Promise<Result> {
  const admin = await adminUser("users.manage");
  if (!admin || !UUID.test(userId)) return fail("auth.errors.generic");
  const reason = cleanReason(f.reason);
  if (!reason) return fail("admin.errors.reason");
  const name = String(f.name ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 60) return fail("designerSignup.errors.name");
  if (!isPersonName(name)) return fail("designerSignup.errors.nameLetters");
  const db = createAdminClient();
  const { data: before } = await db.from("profiles").select("name").eq("id", userId).maybeSingle();
  if (!before) return fail("auth.errors.generic");
  const { error } = await db.from("profiles").update({ name }).eq("id", userId);
  if (error) return fail("admin.errors.generic");
  // The login account carries the name too (emails, the welcome screen).
  await db.auth.admin.updateUserById(userId, { user_metadata: { name } }).catch(() => undefined);
  await audit(admin.id, "correct_name", "user", userId, { reason, from: before.name, to: name });
  refresh();
  return { ok: true };
}
