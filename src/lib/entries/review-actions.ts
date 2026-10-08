"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import type { MessageKey } from "@/lib/i18n/translate";
import { getLogoScanner, type ScanResult } from "@/lib/moderation/logo-scan";
import { contestDesignerIds, notify } from "@/lib/notifications";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { ENTRY_FILES_BUCKET } from "./queries";
import { REJECT_REASONS } from "./review-options";

/** The client's review tools (UI-JOURNEY C-13b, C-15; owner 2026-10-08). */

type Result = { ok: true } | { ok: false; error: MessageKey };
const UUID = /^[0-9a-f-]{36}$/i;

/** The entry and its contest, only when the signed-in user is that contest's client. */
async function ownEntry(entryId: string) {
  if (!isSupabaseConfigured() || !UUID.test(entryId)) return null;
  const user = await getCurrentUser();
  if (!user || user.role !== "client" || user.status !== "active") return null;
  const { data } = await createAdminClient()
    .from("entries")
    .select("id, number, status, designer_id, contest:contests!contest_id(id, slug, brand_name, client_id, status, logo_scan)")
    .eq("id", entryId)
    .maybeSingle();
  const c = data && ((Array.isArray(data.contest) ? data.contest[0] : data.contest) as { id: string; slug: string; brand_name: string; client_id: string; status: string; logo_scan: boolean } | null);
  if (!data || !c || c.client_id !== user.id) return null;
  return { user, entry: data as { id: string; number: number; status: string; designer_id: string }, contest: c };
}

/** 1–5 stars; 0 clears the rating. */
export async function rateEntry(entryId: string, rating: number): Promise<Result> {
  const own = await ownEntry(entryId);
  if (!own) return { ok: false, error: "auth.errors.generic" };
  if (!Number.isInteger(rating) || rating < 0 || rating > 5) return { ok: false, error: "auth.errors.generic" };
  const { error } = await createAdminClient().from("entries").update({ rating: rating || null }).eq("id", entryId);
  if (error) return { ok: false, error: "auth.errors.generic" };
  if (rating) await notify([own.entry.designer_id], "entry_rated", { brand: own.contest.brand_name, number: own.entry.number, stars: rating }, `/contest/${own.contest.slug}?tab=entries&entry=${own.entry.number}`);
  refresh();
  return { ok: true };
}

export async function setShortlist(entryId: string, on: boolean): Promise<Result> {
  const own = await ownEntry(entryId);
  if (!own) return { ok: false, error: "auth.errors.generic" };
  const { error } = await createAdminClient().from("entries").update({ is_shortlisted: on }).eq("id", entryId);
  if (error) return { ok: false, error: "auth.errors.generic" };
  refresh();
  return { ok: true };
}

/** BLUEPRINT §8.3: "AI" and "copied" also open a report for the admin. */
export async function rejectEntry(entryId: string, reason: string, note: string): Promise<Result> {
  const own = await ownEntry(entryId);
  if (!own) return { ok: false, error: "auth.errors.generic" };
  if (!(REJECT_REASONS as readonly string[]).includes(reason)) return { ok: false, error: "manage.reject.pickReason" };
  if (own.entry.status !== "active") return { ok: false, error: "manage.reject.notActive" };
  if (!["open", "judging"].includes(own.contest.status)) return { ok: false, error: "manage.closed" };
  const cleanNote = note.trim().slice(0, 500) || null;
  const db = createAdminClient();
  const { error } = await db
    .from("entries")
    .update({ status: "rejected", reject_reason: reason, reject_note: cleanNote, rejected_at: new Date().toISOString(), is_shortlisted: false })
    .eq("id", entryId)
    .eq("status", "active");
  if (error) return { ok: false, error: "auth.errors.generic" };
  await notify([own.entry.designer_id], "entry_rejected", { brand: own.contest.brand_name, number: own.entry.number }, `/contest/${own.contest.slug}?tab=entries&entry=${own.entry.number}`);
  if (reason === "ai" || reason === "copied") {
    await db.from("reports").insert({ reporter_id: own.user.id, entry_id: entryId, reason, note: cleanNote }).then(
      () => undefined,
      () => undefined,
    );
  }
  refresh();
  return { ok: true };
}

/** C-16: the contest closes at once (owner, 2026-10-08). */
export async function pickWinner(entryId: string): Promise<Result> {
  const own = await ownEntry(entryId);
  if (!own) return { ok: false, error: "auth.errors.generic" };
  if (own.entry.status !== "active") return { ok: false, error: "manage.winner.notActive" };
  const { error } = await createAdminClient().rpc("pick_winner", { p_contest_id: own.contest.id, p_entry_id: entryId });
  if (error) return { ok: false, error: "manage.closed" };
  const n = { brand: own.contest.brand_name, number: own.entry.number };
  const link = `/contest/${own.contest.slug}?tab=entries&entry=${own.entry.number}`;
  await notify([own.entry.designer_id], "winner_picked", n, link);
  await notify((await contestDesignerIds(own.contest.id)).filter((id) => id !== own.entry.designer_id), "contest_closed", n, link);
  refresh();
  return { ok: true };
}

/** Logo Scan of the design's cover (the original upload, not the resized preview). */
export async function scanEntry(entryId: string): Promise<{ ok: true; result: ScanResult } | { ok: false; error: MessageKey }> {
  const own = await ownEntry(entryId);
  if (!own) return { ok: false, error: "auth.errors.generic" };
  if (!own.contest.logo_scan) return { ok: false, error: "manage.scan.locked" };
  const db = createAdminClient();
  const { data: img } = await db.from("entry_images").select("original_path").eq("entry_id", entryId).order("position").limit(1).maybeSingle();
  if (!img) return { ok: false, error: "auth.errors.generic" };
  let result: ScanResult;
  try {
    const bytes = await getFileStorage().download(ENTRY_FILES_BUCKET, img.original_path as string);
    result = await getLogoScanner().scan(bytes);
  } catch (e) {
    console.error("[logo-scan] failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: "manage.scan.failed" };
  }
  await db.from("logo_scans").insert({
    entry_id: entryId,
    requested_by: own.user.id,
    driver: result.driver,
    full_matches: result.full,
    partial_matches: result.partial,
    similar_images: result.similar,
    pages: result.pages,
  });
  refresh();
  return { ok: true, result };
}
