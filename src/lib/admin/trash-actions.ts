"use server";

import { refresh } from "next/cache";
import type { MessageKey } from "@/lib/i18n/translate";
import { adminUser, audit, cleanReason, superAdmin, UUID } from "./core";
import { openRefundClaim, purgeContest, purgeUser, restoreContest, restoreUser, trashContest, trashUser, type TrashError } from "./trash";

/** Admin › Trash (owner, 2026-10-14): Delete (to the Trash, with a reason), Restore, and Erase now (Super admin). */

type Result = { ok: true } | { ok: false; error: MessageKey };
type Fields = Record<string, string>;
const fail = (error: MessageKey): Result => ({ ok: false, error });
const trashFail = (e: TrashError): Result => fail(`admin.trash.errors.${e}`);

export async function deleteContest(contestId: string, f: Fields): Promise<Result> {
  const admin = await adminUser("contests.manage");
  if (!admin || !UUID.test(contestId)) return fail("auth.errors.generic");
  const reason = cleanReason(f.reason);
  if (!reason) return fail("admin.errors.reason");
  const res = await trashContest(contestId, admin.id, reason);
  if (!res.ok) return trashFail(res.error);
  await audit(admin.id, "trash_contest", "contest", contestId, { reason });
  refresh();
  return { ok: true };
}

/** The reason kept for a one-click delete from the Contests or Users list (owner, 2026-10-18). */
const QUICK_REASON = "Deleted from the list with one click";

/** One click from Admin › Contests (owner, 2026-10-18): straight to the Trash, Undo in the toast. Same rules as Delete. */
export async function quickDeleteContest(contestId: string): Promise<Result> {
  const admin = await adminUser("contests.manage");
  if (!admin || !UUID.test(contestId)) return fail("auth.errors.generic");
  const res = await trashContest(contestId, admin.id, QUICK_REASON);
  if (!res.ok) return trashFail(res.error);
  await audit(admin.id, "trash_contest", "contest", contestId, { reason: QUICK_REASON, quick: true });
  refresh();
  return { ok: true };
}

export async function restoreContestFromTrash(contestId: string): Promise<Result> {
  // Contests · manage (the one-click delete's Undo) or Trash · manage (owner, 2026-10-20).
  const admin = (await adminUser("contests.manage")) ?? (await adminUser("trash.manage"));
  if (!admin || !UUID.test(contestId)) return fail("auth.errors.generic");
  const res = await restoreContest(contestId);
  if (!res.ok) return trashFail(res.error);
  await audit(admin.id, "restore_contest", "contest", contestId, {});
  refresh();
  return { ok: true };
}

export async function eraseContestNow(contestId: string): Promise<Result> {
  const owner = await superAdmin();
  if (!owner || !UUID.test(contestId)) return fail("auth.errors.generic");
  if (await openRefundClaim("contest_id", contestId)) return trashFail("refundClaim");
  await audit(owner.id, "erase_contest", "contest", contestId, {});
  await purgeContest(contestId);
  refresh();
  return { ok: true };
}

export async function deleteUser(userId: string, f: Fields): Promise<Result> {
  const admin = await adminUser("users.manage");
  if (!admin || !UUID.test(userId)) return fail("auth.errors.generic");
  const reason = cleanReason(f.reason);
  if (!reason) return fail("admin.errors.reason");
  const res = await trashUser(userId, admin.id, reason);
  if (!res.ok) return trashFail(res.error);
  await audit(admin.id, "trash_user", "user", userId, { reason });
  refresh();
  return { ok: true };
}

/** One click from Admin › Users (owner, 2026-10-18). Same rules as Delete: never admins, yourself, or accounts with live work or money. */
export async function quickDeleteUser(userId: string): Promise<Result> {
  const admin = await adminUser("users.manage");
  if (!admin || !UUID.test(userId)) return fail("auth.errors.generic");
  const res = await trashUser(userId, admin.id, QUICK_REASON);
  if (!res.ok) return trashFail(res.error);
  await audit(admin.id, "trash_user", "user", userId, { reason: QUICK_REASON, quick: true });
  refresh();
  return { ok: true };
}

export async function restoreUserFromTrash(userId: string): Promise<Result> {
  const admin = (await adminUser("users.manage")) ?? (await adminUser("trash.manage"));
  if (!admin || !UUID.test(userId)) return fail("auth.errors.generic");
  const res = await restoreUser(userId);
  if (!res.ok) return trashFail(res.error);
  await audit(admin.id, "restore_user", "user", userId, {});
  refresh();
  return { ok: true };
}

export async function eraseUserNow(userId: string): Promise<Result> {
  const owner = await superAdmin();
  if (!owner || !UUID.test(userId) || userId === owner.id) return fail("auth.errors.generic");
  if (await openRefundClaim("client_id", userId)) return trashFail("refundClaim");
  await audit(owner.id, "erase_user", "user", userId, {});
  await purgeUser(userId);
  refresh();
  return { ok: true };
}
