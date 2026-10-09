"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { blockedTerms } from "@/lib/contests/community";
import { isSupabaseConfigured } from "@/lib/env";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import { findContactDetails } from "@/lib/moderation/contact-filter";
import { notify } from "@/lib/notifications";
import { getSetting, getSettings } from "@/lib/settings";
import { getFileStorage } from "@/lib/storage";
import { HANDOVER_FILES_BUCKET } from "./options";
import { createAdminClient } from "@/lib/supabase/admin";
import { payoutFor } from "@/lib/wallet/fees";
import { acceptsFile, countWords, extensionOf, isHandoverType, MAX_EXTRA_FILES, type HandoverFileType } from "./options";

type Fail = { ok: false; error: { key: MessageKey; params?: MessageParams } };
const fail = (key: MessageKey, params?: MessageParams): Fail => ({ ok: false, error: { key, params } });
const UUID = /^[0-9a-f-]{36}$/i;

type HandoverRow = { id: string; contest_id: string; designer_id: string; status: string; prize: number; fee_rate: number; contest: { slug: string; brand_name: string; client_id: string } | null };

async function loadHandover(id: string): Promise<HandoverRow | null> {
  if (!UUID.test(id)) return null;
  const { data } = await createAdminClient()
    .from("handovers")
    .select("id, contest_id, designer_id, status, prize, fee_rate, contest:contests!contest_id(slug, brand_name, client_id)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const c = Array.isArray(data.contest) ? data.contest[0] : data.contest;
  return { ...(data as unknown as HandoverRow), contest: c ?? null };
}

/** The winner's own handover while files can still be changed. */
async function editableForWinner(id: string) {
  const user = await getCurrentUser();
  const h = await loadHandover(id);
  if (!user || user.status !== "active" || !h || h.designer_id !== user.id) return null;
  if (h.status !== "awaiting_files" && h.status !== "revision_requested") return null;
  return { user, h };
}

const pathPattern = (h: HandoverRow) => new RegExp(`^handover/${h.contest_id}/${h.id}/(ai|eps|svg|pdf|png|jpg|extra)-[0-9a-f-]{36}\\.[a-z0-9]{2,4}$`);

/** D-09: a one-time upload link for one final file (the browser uploads straight to storage). */
export async function prepareHandoverUpload(input: { handoverId: string; fileType: string; name: string; size: number }): Promise<{ ok: true; path: string; token: string } | Fail> {
  if (!isSupabaseConfigured()) return fail("auth.errors.notConfigured");
  const own = await editableForWinner(input.handoverId);
  if (!own) return fail("handover.errors.closed");
  if (!isHandoverType(input.fileType) || !acceptsFile(input.fileType, input.name)) return fail("handover.errors.type");
  const mb = await getSetting("limits.handover_file_max_mb");
  if (!(input.size > 0) || input.size > mb * 1024 * 1024) return fail("handover.errors.size", { mb });
  if (input.fileType === "extra") {
    const { count } = await createAdminClient().from("handover_files").select("id", { count: "exact", head: true }).eq("handover_id", own.h.id).eq("file_type", "extra");
    if ((count ?? 0) >= MAX_EXTRA_FILES) return fail("handover.errors.tooMany", { max: MAX_EXTRA_FILES });
  }
  const path = `handover/${own.h.contest_id}/${own.h.id}/${input.fileType}-${randomUUID()}.${extensionOf(input.name)}`;
  return { ok: true, ...(await getFileStorage().createUploadUrl(HANDOVER_FILES_BUCKET, path)) };
}

/** D-09: records an uploaded file; a new file for a required type replaces the old one. */
export async function recordHandoverFile(input: { handoverId: string; fileType: string; path: string; name: string; size: number }): Promise<{ ok: true } | Fail> {
  const own = await editableForWinner(input.handoverId);
  if (!own) return fail("handover.errors.closed");
  const type = input.fileType as HandoverFileType;
  if (!isHandoverType(type) || !pathPattern(own.h).test(input.path) || !input.path.includes(`/${type}-`)) return fail("handover.errors.type");
  const storage = getFileStorage();
  if (!(await storage.exists(HANDOVER_FILES_BUCKET, input.path))) return fail("handover.errors.upload");
  const db = createAdminClient();
  if (type !== "extra") {
    const { data: old } = await db.from("handover_files").select("id, path").eq("handover_id", own.h.id).eq("file_type", type);
    if (old?.length) {
      await db.from("handover_files").delete().in("id", old.map((o) => o.id as string));
      await storage.remove(HANDOVER_FILES_BUCKET, old.map((o) => o.path as string)).catch(() => {});
    }
  }
  const { error } = await db.from("handover_files").insert({ handover_id: own.h.id, file_type: type, path: input.path, original_name: input.name.slice(0, 200), size_bytes: Math.round(input.size) });
  if (error) return fail("handover.errors.upload");
  refresh();
  return { ok: true };
}

export async function removeHandoverFile(fileId: string): Promise<{ ok: true } | Fail> {
  if (!UUID.test(fileId)) return fail("auth.errors.generic");
  const db = createAdminClient();
  const { data: file } = await db.from("handover_files").select("id, path, handover_id").eq("id", fileId).maybeSingle();
  if (!file) return fail("auth.errors.generic");
  const own = await editableForWinner(file.handover_id as string);
  if (!own) return fail("handover.errors.closed");
  await db.from("handover_files").delete().eq("id", fileId);
  await getFileStorage().remove(HANDOVER_FILES_BUCKET, [file.path as string]).catch(() => {});
  refresh();
  return { ok: true };
}

/** D-09: the winner sends the files and accepts the copyright transfer. */
export async function submitHandover(input: { handoverId: string; fontsNote: string; agreed: boolean }): Promise<{ ok: true } | Fail> {
  const own = await editableForWinner(input.handoverId);
  if (!own) return fail("handover.errors.closed");
  if (!input.agreed) return fail("handover.errors.agreement");
  const fonts = input.fontsNote.trim().slice(0, 500);
  if (fonts && findContactDetails(fonts, await blockedTerms())) return fail("contest.comments.contact");
  const days = await getSetting("timers.client_response_days");
  const { error } = await createAdminClient().rpc("submit_handover", { p_handover_id: own.h.id, p_designer_id: own.user.id, p_fonts_note: fonts, p_review_days: days });
  if (error) return fail(error.code === "23514" ? "handover.errors.missing" : "handover.errors.closed");
  await notify([own.h.contest?.client_id], "handover_submitted", { brand: own.h.contest?.brand_name }, `/dashboard/contests/${own.h.contest?.slug}`, own.user.id);
  refresh();
  return { ok: true };
}

/** The contest's client, for review actions. */
async function forClient(id: string) {
  const user = await getCurrentUser();
  const h = await loadHandover(id);
  if (!user || user.status !== "active" || !h || h.contest?.client_id !== user.id) return null;
  return { user, h };
}

/** C-17: the client asks for a change (a note is required). */
export async function requestHandoverRevision(input: { handoverId: string; note: string }): Promise<{ ok: true } | Fail> {
  const own = await forClient(input.handoverId);
  if (!own) return fail("auth.errors.generic");
  const note = input.note.replace(/\r\n/g, "\n").trim();
  if (note.length < 10 || note.length > 1000) return fail("handover.errors.note");
  if (findContactDetails(note, await blockedTerms())) return fail("contest.comments.contact");
  const max = await getSetting("limits.max_revision_requests");
  const { error } = await createAdminClient().rpc("request_handover_revision", { p_handover_id: own.h.id, p_client_id: own.user.id, p_note: note, p_max: max });
  if (error) return fail("handover.errors.noMoreChanges");
  await notify([own.h.designer_id], "handover_revision", { brand: own.h.contest?.brand_name }, `/dashboard/handover/${own.h.contest?.slug}`, own.user.id);
  refresh();
  return { ok: true };
}

/** C-17: the client approves with stars and feedback; the designer is paid once the copy-claim days are over. */
export async function approveHandover(input: { handoverId: string; rating: number; feedback: string }): Promise<{ ok: true } | Fail> {
  const own = await forClient(input.handoverId);
  if (!own) return fail("auth.errors.generic");
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) return fail("handover.errors.rating");
  const s = await getSettings(["limits.approval_feedback_max_words", "fees.counted_win_min_prize", "fees.counted_win_min_designers", "fees.counted_wins_max_per_client"]);
  const feedback = input.feedback.replace(/\r\n/g, "\n").trim();
  const words = countWords(feedback);
  if (words === 0 || words > s["limits.approval_feedback_max_words"]) return fail("handover.errors.feedback", { max: s["limits.approval_feedback_max_words"] });
  if (findContactDetails(feedback, await blockedTerms())) return fail("contest.comments.contact");
  const { data, error } = await createAdminClient().rpc("approve_handover", {
    p_handover_id: own.h.id,
    p_client_id: own.user.id,
    p_rating: input.rating,
    p_feedback: feedback,
    p_min_prize: s["fees.counted_win_min_prize"],
    p_min_designers: s["fees.counted_win_min_designers"],
    p_max_per_client: s["fees.counted_wins_max_per_client"],
  });
  if (error) return fail("handover.errors.closed");
  // Paid now when the copy-claim days are already over; otherwise held until they are (§7.3).
  const paid = (data as { amount?: number } | null)?.amount;
  const amount = paid ?? payoutFor(own.h.prize, own.h.fee_rate).credit;
  await notify([own.h.designer_id], paid ? "handover_approved" : "handover_approved_held", { brand: own.h.contest?.brand_name, amount }, "/dashboard/wallet", own.user.id);
  refresh();
  return { ok: true };
}
