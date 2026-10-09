"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { can } from "@/lib/auth/policies";
import { getCurrentUser } from "@/lib/auth/session";
import { blockedTerms } from "@/lib/contests/community";
import { isSupabaseConfigured } from "@/lib/env";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import { findContactDetails } from "@/lib/moderation/contact-filter";
import { getImageModerator } from "@/lib/moderation/images";
import { getSetting } from "@/lib/settings";
import { notify } from "@/lib/notifications";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSignedAgreement } from "@/lib/agreements/queries";
import { passesNda } from "@/lib/contests/nda";
import { DECLARATION_KEYS } from "./declarations";
import { differenceHash, ENTRY_IMAGE_TYPES, hammingDistance, imageSize, NEAR_DUPLICATE_DISTANCE, previewImage } from "./images";
import { ENTRY_FILES_BUCKET, hasEntryIn } from "./queries";
import { REPORT_MAX_LINKS, REPORT_NOTE_MAX, REPORT_REASONS } from "./report-reasons";
import { canSeeEntry, entryScope } from "./rules";

type Fail = { ok: false; error: { key: MessageKey; params?: MessageParams } };
const fail = (key: MessageKey, params?: MessageParams): Fail => ({ ok: false, error: { key, params } });
const UUID = /^[0-9a-f-]{36}$/i;

/** An open contest that still accepts designs, or null. */
async function openContest(contestId: string) {
  if (!UUID.test(contestId)) return null;
  const { data } = await createAdminClient().from("contests").select("id, slug, status, ends_at, client_id, brand_name, is_nda").eq("id", contestId).maybeSingle();
  if (!data || data.status !== "open" || (data.ends_at && new Date(data.ends_at) <= new Date())) return null;
  return { id: data.id as string, slug: data.slug as string, ownerId: data.client_id as string, brand: data.brand_name as string, isNda: Boolean(data.is_nda) };
}

const originalPattern = (contestId: string, userId: string) => new RegExp(`^originals/${contestId}/${userId}/[0-9a-f-]{36}\\.(jpg|png|webp)$`);

/** D-04 step 1: a one-time upload link for one mockup (the browser uploads straight to storage). */
export async function prepareEntryImageUpload(input: { contestId: string; type: string; size: number }): Promise<{ ok: true; path: string; token: string } | Fail> {
  if (!isSupabaseConfigured()) return fail("auth.errors.notConfigured");
  const user = await getCurrentUser();
  if (!can(user, "entry.submit")) return fail("submit.errors.designersOnly");
  const contest = await openContest(input.contestId);
  if (!contest) return fail("submit.errors.closed");
  if (!(await passesNda(contest, user))) return fail("contest.nda.required");
  if (!(await hasSignedAgreement(user!.id))) return fail("agreement.errors.required");
  const ext = ENTRY_IMAGE_TYPES[input.type];
  if (!ext) return fail("submit.errors.type");
  const mb = await getSetting("limits.entry_image_max_mb");
  if (input.size <= 0 || input.size > mb * 1024 * 1024) return fail("submit.errors.fileSize", { mb });
  const upload = await getFileStorage().createUploadUrl(ENTRY_FILES_BUCKET, `originals/${contest.id}/${user!.id}/${randomUUID()}.${ext}`);
  return { ok: true, ...upload };
}

/** A mockup removed before submitting is deleted at once. */
export async function discardEntryImage(contestId: string, path: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !UUID.test(contestId) || !originalPattern(contestId, user.id).test(path)) return;
  const { count } = await createAdminClient().from("entry_images").select("id", { count: "exact", head: true }).eq("original_path", path);
  if (count) return; // already part of a submitted design
  await getFileStorage().remove(ENTRY_FILES_BUCKET, [path]).catch(() => {});
}

export type SubmitInput = { contestId: string; paths: string[]; declarations: string[] };

/**
 * D-04 step 2: checks every mockup again on the server (exactly N×N, not nude),
 * numbers the design, makes clean previews and flags near-duplicates.
 */
export async function submitEntry(input: SubmitInput): Promise<{ ok: true; number: number; slug: string } | Fail> {
  if (!isSupabaseConfigured()) return fail("auth.errors.notConfigured");
  const user = await getCurrentUser();
  if (!can(user, "entry.submit")) return fail("submit.errors.designersOnly");
  const contest = await openContest(input.contestId);
  if (!contest) return fail("submit.errors.closed");
  if (!(await passesNda(contest, user))) return fail("contest.nda.required");
  if (!(await hasSignedAgreement(user!.id))) return fail("agreement.errors.required");

  const [minImages, maxImages, px, previewPx, maxPerDesigner] = await Promise.all([
    getSetting("limits.entry_min_images"),
    getSetting("limits.entry_max_images"),
    getSetting("limits.entry_image_min_px"),
    getSetting("limits.entry_preview_max_px"),
    getSetting("limits.max_entries_per_designer"),
  ]);
  const paths = [...new Set(input.paths)];
  if (paths.length < minImages) return fail("submit.errors.minImages", { min: minImages });
  if (paths.length > maxImages) return fail("submit.errors.maxImages", { max: maxImages });
  const pattern = originalPattern(contest.id, user!.id);
  if (!paths.every((p) => pattern.test(p))) return fail("auth.errors.generic");
  if (!DECLARATION_KEYS.every((k) => input.declarations.includes(k))) return fail("submit.errors.declarations");

  const db = createAdminClient();
  if (maxPerDesigner > 0) {
    const { count } = await db.from("entries").select("id", { count: "exact", head: true }).eq("contest_id", contest.id).eq("designer_id", user!.id).neq("status", "removed");
    if ((count ?? 0) >= maxPerDesigner) return fail("submit.errors.tooMany", { max: maxPerDesigner });
  }

  // Check every file before anything is saved.
  const storage = getFileStorage();
  const moderator = getImageModerator();
  const files: { path: string; bytes: Uint8Array; hash: string }[] = [];
  for (const [i, path] of paths.entries()) {
    let bytes: Uint8Array;
    try {
      bytes = await storage.download(ENTRY_FILES_BUCKET, path);
    } catch {
      return fail("submit.errors.missing", { n: i + 1 });
    }
    const size = await imageSize(bytes);
    if (!size) return fail("submit.errors.unreadable", { n: i + 1 });
    if (size.width !== px || size.height !== px) return fail("submit.errors.notSquare", { n: i + 1, px });
    const mime = Object.entries(ENTRY_IMAGE_TYPES).find(([, ext]) => path.endsWith(`.${ext}`))![0];
    const verdict = await moderator.check(bytes, mime);
    if (!verdict.allowed) {
      await storage.remove(ENTRY_FILES_BUCKET, [path]).catch(() => {});
      return fail(verdict.reason === "error" ? "submit.errors.checkFailed" : "submit.errors.notAllowed", { n: i + 1 });
    }
    files.push({ path, bytes, hash: await differenceHash(bytes) });
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  const now = new Date().toISOString();
  const { data: entry, error } = await db
    .from("entries")
    .insert({
      contest_id: contest.id,
      designer_id: user!.id,
      number: 0, // set by the entries_set_number trigger
      declarations: { version: 1, accepted: [...DECLARATION_KEYS] },
      declared_ip: ip,
      declared_at: now,
    })
    .select("id, number")
    .single();
  if (error || !entry) return fail("auth.errors.generic");

  // Near-duplicates of other designers' mockups in this contest, for admins.
  const { data: others } = await db
    .from("entry_images")
    .select("phash, entry:entries!entry_id!inner(id, contest_id, designer_id)")
    .not("phash", "is", null)
    .eq("entry.contest_id", contest.id)
    .neq("entry.designer_id", user!.id);
  const known = (others ?? [])
    .map((o) => ({ hash: o.phash as string, entry: (Array.isArray(o.entry) ? o.entry[0] : o.entry) as { id: string } | null }))
    .filter((o) => o.entry);

  const previews: string[] = [];
  try {
    const rows = [];
    for (const [position, f] of files.entries()) {
      const preview = await previewImage(f.bytes, previewPx);
      const previewPath = `previews/${contest.id}/${entry.id}/${position}-${randomUUID()}.jpg`;
      const { error: upError } = await db.storage.from(ENTRY_FILES_BUCKET).upload(previewPath, preview, { contentType: "image/jpeg" });
      if (upError) throw new Error(upError.message);
      previews.push(previewPath);
      const dup = known.find((k) => hammingDistance(k.hash, f.hash) <= NEAR_DUPLICATE_DISTANCE);
      rows.push({ entry_id: entry.id, position, original_path: f.path, preview_path: previewPath, phash: f.hash, duplicate_of_entry_id: dup?.entry?.id ?? null });
    }
    const { error: imgError } = await db.from("entry_images").insert(rows);
    if (imgError) throw new Error(imgError.message);
  } catch (e) {
    console.error("[entries] submit failed:", e instanceof Error ? e.message : e);
    await db.from("entries").delete().eq("id", entry.id);
    await storage.remove(ENTRY_FILES_BUCKET, previews).catch(() => {});
    return fail("auth.errors.generic");
  }

  await notify([contest.ownerId], "entry_new", { brand: contest.brand, number: entry.number }, `/dashboard/contests/${contest.slug}?entry=${entry.number}`, user!.id);
  refresh();
  return { ok: true, number: entry.number, slug: contest.slug };
}

// ---------------------------------------------------------------------------
// Design comments (BLUEPRINT §10, owner 2026-10-08)
// ---------------------------------------------------------------------------

export type EntryCommentState = { status: "idle" | "ok" | "error"; error?: { key: MessageKey; params?: MessageParams } };
const commentFail = (key: MessageKey, params?: MessageParams): EntryCommentState => ({ status: "error", error: { key, params } });

export async function postEntryComment(_prev: EntryCommentState, formData: FormData): Promise<EntryCommentState> {
  if (!isSupabaseConfigured()) return commentFail("auth.errors.notConfigured");
  const user = await getCurrentUser();
  const entryId = String(formData.get("entryId") ?? "");
  if (!user || !UUID.test(entryId)) return commentFail("auth.errors.generic");

  const db = createAdminClient();
  const { data } = await db
    .from("entries")
    .select("id, number, status, designer_id, contest:contests!contest_id(id, slug, brand_name, client_id, is_blind, is_private, is_nda, status, winner_is_public)")
    .eq("id", entryId)
    .maybeSingle();
  const c =
    data &&
    ((Array.isArray(data.contest) ? data.contest[0] : data.contest) as {
      id: string;
      slug: string;
      brand_name: string;
      client_id: string;
      is_blind: boolean;
      is_private: boolean;
      is_nda: boolean;
      status: string;
      winner_is_public: boolean;
    } | null);
  if (!data || !c) return commentFail("auth.errors.generic");
  const canSeeBrief = await passesNda({ id: c.id, isNda: Boolean(c.is_nda), ownerId: c.client_id }, user);
  const scope = entryScope({ ownerId: c.client_id, isBlind: c.is_blind, canSeeBrief, status: c.status, winnerIsPublic: c.winner_is_public }, user);
  if (!canSeeEntry(scope, { status: data.status, designerId: data.designer_id })) return commentFail("auth.errors.generic");
  const allowed = can(user, "entry.comment", {
    contestOwnerId: c.client_id,
    isBlind: c.is_blind,
    entryDesignerId: data.designer_id,
    viewerHasEntry: user.role === "designer" ? await hasEntryIn(c.id, user.id) : false,
  });
  if (!allowed) return commentFail("entry.comments.notAllowed");

  const body = String(formData.get("body") ?? "").replace(/\r\n/g, "\n").trim();
  const max = Math.min(2000, await getSetting("limits.contest_comment_max_length"));
  if (!body) return commentFail("contest.comments.emptyBody");
  if (body.length > max) return commentFail("contest.comments.tooLong", { max });
  if (findContactDetails(body, await blockedTerms())) return commentFail("contest.comments.contact");

  const { error } = await db.from("entry_comments").insert({ entry_id: entryId, user_id: user.id, body });
  if (error) return commentFail("auth.errors.generic");
  const n = { brand: c.brand_name, number: data.number as number };
  await notify([c.client_id], "entry_comment", n, `/dashboard/contests/${c.slug}?entry=${data.number}`, user.id);
  await notify([data.designer_id], "entry_comment", n, `/contest/${c.slug}?tab=entries&entry=${data.number}`, user.id);
  refresh();
  return { status: "ok" };
}

/** Authors can delete their own comment. */
export async function deleteEntryComment(commentId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user || !UUID.test(commentId)) return false;
  const { data } = await createAdminClient()
    .from("entry_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (data) refresh();
  return Boolean(data);
}

// ---------------------------------------------------------------------------
// Reports (flags) on designs (BLUEPRINT §10, owner 2026-10-08)
// ---------------------------------------------------------------------------

const reportImagePattern = (userId: string) => new RegExp(`^flags/${userId}/[0-9a-f-]{36}\\.(jpg|png|webp)$`);

/** Optional evidence: an image of the similar logo, uploaded straight to storage. */
export async function prepareReportImageUpload(input: { type: string; size: number }): Promise<{ ok: true; path: string; token: string } | Fail> {
  if (!isSupabaseConfigured()) return fail("auth.errors.notConfigured");
  const user = await getCurrentUser();
  if (!user || user.status !== "active") return fail("auth.errors.generic");
  const ext = ENTRY_IMAGE_TYPES[input.type];
  if (!ext) return fail("submit.errors.type");
  const mb = await getSetting("limits.entry_image_max_mb");
  if (input.size <= 0 || input.size > mb * 1024 * 1024) return fail("submit.errors.fileSize", { mb });
  const upload = await getFileStorage().createUploadUrl(ENTRY_FILES_BUCKET, `flags/${user.id}/${randomUUID()}.${ext}`);
  return { ok: true, ...upload };
}

export type ReportInput = { entryId: string; reason: string; note: string; links: string[]; imagePath: string | null };

export async function reportEntry(input: ReportInput): Promise<{ ok: true } | Fail> {
  if (!isSupabaseConfigured()) return fail("auth.errors.notConfigured");
  const user = await getCurrentUser();
  if (!user || user.status !== "active") return fail("entry.report.login");
  if (!UUID.test(input.entryId)) return fail("auth.errors.generic");
  if (!(REPORT_REASONS as readonly string[]).includes(input.reason)) return fail("entry.report.pickReason");

  const db = createAdminClient();
  const { data } = await db
    .from("entries")
    .select("id, status, designer_id, contest:contests!contest_id(id, client_id, is_blind, is_private, is_nda, status, winner_is_public)")
    .eq("id", input.entryId)
    .maybeSingle();
  const c =
    data &&
    ((Array.isArray(data.contest) ? data.contest[0] : data.contest) as { id: string; client_id: string; is_blind: boolean; is_private: boolean; is_nda: boolean; status: string; winner_is_public: boolean } | null);
  if (!data || !c) return fail("auth.errors.generic");
  if (data.designer_id === user.id) return fail("entry.report.own");
  const canSeeBrief = await passesNda({ id: c.id, isNda: Boolean(c.is_nda), ownerId: c.client_id }, user);
  const scope = entryScope({ ownerId: c.client_id, isBlind: c.is_blind, canSeeBrief, status: c.status, winnerIsPublic: c.winner_is_public }, user);
  if (!canSeeEntry(scope, { status: data.status, designerId: data.designer_id })) return fail("auth.errors.generic");

  const note = input.note.replace(/\r\n/g, "\n").trim();
  if (note.length > REPORT_NOTE_MAX) return fail("contest.comments.tooLong", { max: REPORT_NOTE_MAX });
  const links = [...new Set(input.links.map((l) => l.trim()).filter(Boolean))];
  if (links.length > REPORT_MAX_LINKS) return fail("entry.report.tooManyLinks", { max: REPORT_MAX_LINKS });
  const validLink = (l: string) => {
    try {
      const u = new URL(l);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  };
  if (!links.every(validLink)) return fail("entry.report.badLink");

  let imagePath: string | null = null;
  if (input.imagePath) {
    if (!reportImagePattern(user.id).test(input.imagePath) || !(await getFileStorage().exists(ENTRY_FILES_BUCKET, input.imagePath))) return fail("auth.errors.generic");
    imagePath = input.imagePath;
  }
  // A copy flag needs something to compare with (BLUEPRINT §10).
  if (input.reason === "copied" && links.length === 0 && !imagePath) return fail("entry.report.needEvidence");

  const { error } = await db.from("reports").insert({
    reporter_id: user.id,
    entry_id: data.id,
    reason: input.reason,
    note: note || null,
    evidence_image_path: imagePath,
    evidence_urls: links,
  });
  if (error) return fail(error.code === "23505" ? "entry.report.already" : "auth.errors.generic");
  return { ok: true };
}
