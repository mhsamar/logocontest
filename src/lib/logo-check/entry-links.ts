import "server-only";
import { createHash } from "node:crypto";
import { getProSettings } from "@/lib/pro/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { badgeFor, sameFile, shouldFlag, type Badge, type CheckForBadge, type LevelRanges, type MatchLevel } from "./entry-rules";

/**
 * Logo check inside contests (owner, 2026-10-14): fingerprints, putting a designer's check on the entry they
 * send, the badge of each entry, and the High match flag for Admin › Copyright checker. Only the server writes
 * these; entries and checks have no write policies for signed-in users.
 */

const db = () => createAdminClient();

/** SHA-256 of the exact file, as 64 hex characters. */
export const sha256Hex = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** Admin › Pro plan: the % ranges of Low and Medium. */
export async function levelRanges(): Promise<LevelRanges> {
  const { settings } = await getProSettings();
  return { lowMax: settings.checkLowMax, mediumMax: settings.checkMediumMax };
}

export const BADGE_COLUMNS = "id, status, entry_id, file_sha256, score, level, report_id";
export const toBadgeCheck = (r: Record<string, unknown>): CheckForBadge => ({
  id: r.id as string,
  status: r.status as string,
  entryId: (r.entry_id as string | null) ?? null,
  fileSha256: (r.file_sha256 as string | null) ?? null,
  score: (r.score as number | null) ?? null,
  level: (r.level as MatchLevel | null) ?? null,
  reportId: (r.report_id as string | null) ?? null,
});

/** The badge of every entry (worked out now, never stored). */
export async function badgesFor(entries: { id: string; checkId: string | null; fileSha256: string | null }[]): Promise<Map<string, Badge>> {
  const ids = [...new Set(entries.map((e) => e.checkId).filter((x): x is string => !!x))];
  const { data } = ids.length ? await db().from("logo_checks").select(BADGE_COLUMNS).in("id", ids) : { data: [] };
  const checks = new Map((data ?? []).map((r) => [r.id as string, toBadgeCheck(r as Record<string, unknown>)]));
  return new Map(entries.map((e) => [e.id, badgeFor(e, e.checkId ? (checks.get(e.checkId) ?? null) : null)]));
}

/**
 * When an entry is sent: keep the fingerprint of its file, and put the designer's check on it only if the check
 * is theirs, for this contest, not failed, not on another entry, and about exactly this file. Never throws: a
 * problem here leaves the entry "Not checked".
 */
export async function linkEntryCheck(e: { entryId: string; designerId: string; contestId: string; fileSha256: string; checkId: string | null }): Promise<boolean> {
  try {
    await db().from("entries").update({ file_sha256: e.fileSha256 }).eq("id", e.entryId);
    if (!e.checkId || !/^[0-9a-f-]{36}$/i.test(e.checkId)) return false;
    const { data: k } = await db().from("logo_checks").select("id, source, requested_by, contest_id, file_sha256, status, entry_id").eq("id", e.checkId).maybeSingle();
    if (!k || k.source !== "pre_submit" || k.requested_by !== e.designerId || k.contest_id !== e.contestId || k.status === "failed" || k.entry_id) return false;
    if (!sameFile(k.file_sha256 as string | null, e.fileSha256)) return false;
    const { data: claimed } = await db().from("logo_checks").update({ entry_id: e.entryId }).eq("id", k.id).is("entry_id", null).select("id");
    if (!claimed?.length) return false;
    await db().from("entries").update({ check_id: k.id }).eq("id", e.entryId);
    await flagIfHigh(k.id as string);
    return true;
  } catch (err) {
    console.error("[logo-check] link entry:", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * A finished High match on a sent entry that still uses the checked file goes to Admin › Copyright checker
 * (once). Called when the entry is sent and when the check finishes, whichever comes last.
 */
export async function flagIfHigh(checkId: string): Promise<boolean> {
  const { data: k } = await db().from("logo_checks").select("id, status, level, score, entry_id, contest_id, file_sha256").eq("id", checkId).maybeSingle();
  if (!k || k.status !== "done" || !shouldFlag(k.level as MatchLevel | null) || !k.entry_id || !k.contest_id) return false;
  const { data: entry } = await db().from("entries").select("id, check_id, file_sha256").eq("id", k.entry_id).maybeSingle();
  if (!entry || entry.check_id !== k.id || !sameFile(entry.file_sha256 as string | null, k.file_sha256 as string | null)) return false;
  const { error } = await db()
    .from("logo_check_flags")
    .upsert({ check_id: k.id, entry_id: entry.id, contest_id: k.contest_id, score: (k.score as number | null) ?? 0 }, { onConflict: "check_id,entry_id", ignoreDuplicates: true });
  if (error) console.error("[logo-check] flag:", error.message);
  return !error;
}

/** The designer's report on an entry, when the badge is valid (for the winner's certificate). */
export async function validReportOf(entryId: string): Promise<{ reportId: string; level: MatchLevel; score: number } | null> {
  const { data: entry } = await db().from("entries").select("id, check_id, file_sha256").eq("id", entryId).maybeSingle();
  if (!entry?.check_id) return null;
  const { data: k } = await db().from("logo_checks").select(BADGE_COLUMNS).eq("id", entry.check_id).maybeSingle();
  const badge = badgeFor({ id: entry.id as string, checkId: entry.check_id as string, fileSha256: (entry.file_sha256 as string | null) ?? null }, k ? toBadgeCheck(k as Record<string, unknown>) : null);
  return badge.kind === "checked" ? { reportId: badge.reportId, level: badge.level, score: badge.score } : null;
}
