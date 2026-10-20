"use server";

import { refresh } from "next/cache";
import type { MessageKey } from "@/lib/i18n/translate";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminUser, audit, UUID } from "./core";
import { restoreContest, trashContest } from "./trash";
import { isUnpaidOutcome } from "./unpaid-notes";

/**
 * Admin › Unpaid contests (owner, 2026-10-20): call notes, and Delete (to the Trash, with Undo) for contests that were
 * never paid. Unpaid contests · manage; only drafts and contests waiting for payment, never a paid one.
 */

type Result = { ok: true } | { ok: false; error: MessageKey };
const fail = (error: MessageKey): Result => ({ ok: false, error });
const UNPAID = ["draft", "pending_payment"];
const REASON = "Unpaid: deleted from Admin › Unpaid contests";

async function unpaidContest(contestId: string) {
  const { data } = await createAdminClient().from("contests").select("id, status, deleted_from_status").eq("id", contestId).maybeSingle();
  return data as { id: string; status: string; deleted_from_status: string | null } | null;
}

/** "Note the call": what the client said, and a short note. */
export async function addUnpaidNote(contestId: string, f: Record<string, string>): Promise<Result> {
  const admin = await adminUser("unpaid.manage");
  if (!admin || !UUID.test(contestId) || !isUnpaidOutcome(f.outcome ?? "")) return fail("auth.errors.generic");
  const note = (f.note ?? "").replace(/\s+/g, " ").trim().slice(0, 500) || null;
  const { error } = await createAdminClient().from("unpaid_notes").insert({ contest_id: contestId, admin_id: admin.id, outcome: f.outcome, note });
  if (error) return fail(/does not exist|schema cache|Could not find/i.test(error.message) ? "admin.unpaid.notes.notReady" : "admin.errors.generic");
  await audit(admin.id, "unpaid_note", "contest", contestId, { outcome: f.outcome, note });
  refresh();
  return { ok: true };
}

/** "Delete": the unpaid contest goes to the Trash (restore there for 90 days, or Undo right away). */
export async function deleteUnpaidContest(contestId: string): Promise<Result> {
  const admin = await adminUser("unpaid.manage");
  if (!admin || !UUID.test(contestId)) return fail("auth.errors.generic");
  const c = await unpaidContest(contestId);
  if (!c || !UNPAID.includes(c.status)) return fail("admin.unpaid.notes.notUnpaid");
  const res = await trashContest(contestId, admin.id, REASON);
  if (!res.ok) return fail(`admin.trash.errors.${res.error}`);
  await audit(admin.id, "trash_contest", "contest", contestId, { reason: REASON, from: "unpaid" });
  refresh();
  return { ok: true };
}

/** Undo of Delete: only for a contest that was unpaid when it was deleted. */
export async function restoreUnpaidContest(contestId: string): Promise<Result> {
  const admin = await adminUser("unpaid.manage");
  if (!admin || !UUID.test(contestId)) return fail("auth.errors.generic");
  const c = await unpaidContest(contestId);
  if (!c || c.status !== "deleted" || !UNPAID.includes(c.deleted_from_status ?? "")) return fail("admin.trash.errors.notInTrash");
  const res = await restoreContest(contestId);
  if (!res.ok) return fail(`admin.trash.errors.${res.error}`);
  await audit(admin.id, "restore_contest", "contest", contestId, { from: "unpaid" });
  refresh();
  return { ok: true };
}
