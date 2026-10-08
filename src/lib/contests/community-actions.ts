"use server";

import { refresh } from "next/cache";
import { can } from "@/lib/auth/policies";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import { findContactDetails } from "@/lib/moderation/contact-filter";
import { contestDesignerIds, notify } from "@/lib/notifications";
import { getSetting } from "@/lib/settings";
import { PUBLIC_STATUSES } from "./browse";
import { blockedTerms, contestForAction, deleteOwnComment, insertComment, setSaved } from "./community";

export type CommentFormState = { status: "idle" | "ok" | "error"; error?: { key: MessageKey; params?: MessageParams } };

const fail = (key: MessageKey, params?: MessageParams): CommentFormState => ({ status: "error", error: { key, params } });

/** P-03 Comments tab: post a public comment (contest client or designers only). */
export async function postComment(_prev: CommentFormState, formData: FormData): Promise<CommentFormState> {
  if (!isSupabaseConfigured()) return fail("auth.errors.notConfigured");
  const user = await getCurrentUser();
  const contest = await contestForAction(String(formData.get("contestId") ?? ""));
  if (!contest || !(PUBLIC_STATUSES as readonly string[]).includes(contest.status)) return fail("auth.errors.generic");
  if (!can(user, "contest.comment", { contestOwnerId: contest.ownerId })) return fail("contest.comments.notAllowed");

  const body = String(formData.get("body") ?? "").replace(/\r\n/g, "\n").trim();
  const max = Math.min(2000, await getSetting("limits.contest_comment_max_length"));
  if (!body) return fail("contest.comments.emptyBody");
  if (body.length > max) return fail("contest.comments.tooLong", { max });
  if (findContactDetails(body, await blockedTerms())) return fail("contest.comments.contact");

  await insertComment(contest.id, user!.id, body);
  await notify([contest.ownerId, ...(await contestDesignerIds(contest.id))], "contest_comment", { brand: contest.brand }, `/contest/${contest.slug}?tab=comments`, user!.id);
  refresh();
  return { status: "ok" };
}

/** Authors can delete their own comment. */
export async function deleteComment(commentId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const slug = await deleteOwnComment(commentId, user.id);
  if (slug) refresh();
  return Boolean(slug);
}

/** Heart on the list and the contest page (designers only). Returns the new saved state. */
export async function toggleSaved(contestId: string, saved: boolean): Promise<{ ok: boolean; saved: boolean }> {
  const user = await getCurrentUser();
  if (!can(user, "contest.save")) return { ok: false, saved: !saved };
  const contest = await contestForAction(contestId);
  if (!contest || !(PUBLIC_STATUSES as readonly string[]).includes(contest.status)) return { ok: false, saved: !saved };
  await setSaved(user!.id, contest.id, saved);
  return { ok: true, saved };
}
