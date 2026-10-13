/**
 * Logo check inside contests (owner, 2026-10-14; Design/logo-check/LOGO-CHECK-HANDOFF.md). Pure: used by the
 * server, the pages and the tests. A designer checks the logo before sending it; the result goes on the entry
 * automatically and only while the entry still uses the exact file that was checked (SHA-256 fingerprint).
 */

export type MatchLevel = "low" | "medium" | "high";
/** Admin › Pro plan: Low is 0–lowMax %, Medium up to mediumMax %, High above. */
export type LevelRanges = { lowMax: number; mediumMax: number };
export const DEFAULT_LEVEL_RANGES: LevelRanges = { lowMax: 20, mediumMax: 60 };

export function levelFor(score: number, r: LevelRanges): MatchLevel {
  if (score <= r.lowMax) return "low";
  if (score <= r.mediumMax) return "medium";
  return "high";
}

/** High matches go to Admin › Copyright checker. */
export const shouldFlag = (level: MatchLevel | null | undefined) => level === "high";

/** Report IDs: LC-XXXX-XXXX from 32 letters and digits that can't be mixed up (no I, O, 0, 1). */
export const REPORT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const REPORT_ID = /^LC-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
export const isReportId = (v: unknown): v is string => typeof v === "string" && REPORT_ID.test(v);

/** 8 random bytes → LC-XXXX-XXXX (32 letters, so each byte picks one evenly). */
export function reportIdFrom(bytes: Uint8Array): string {
  if (bytes.length < 8) throw new Error("8 bytes needed");
  const c = Array.from(bytes.slice(0, 8), (b) => REPORT_ALPHABET[b % 32]).join("");
  return `LC-${c.slice(0, 4)}-${c.slice(4)}`;
}

/** "a3f9…c21e": the start and end of a fingerprint, for people to compare. */
export const shortSha = (sha: string) => `${sha.slice(0, 4)}…${sha.slice(-4)}`;

export type CheckForBadge = {
  id: string;
  status: string;
  /** The entry the server put this check on (set when the entry was sent). */
  entryId: string | null;
  fileSha256: string | null;
  score: number | null;
  level: MatchLevel | null;
  reportId: string | null;
};
export type EntryForBadge = { id: string; checkId: string | null; fileSha256: string | null };
export type Badge = { kind: "checked"; level: MatchLevel; score: number; reportId: string } | { kind: "none" };

/** Same exact file: both fingerprints are there and equal. */
export const sameFile = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && a === b;

/**
 * The badge on an entry. It is worked out every time, never stored: the check must be finished, be the one the
 * server put on this entry, and have the same fingerprint as the entry's file. Anything else is "Not checked".
 */
export function badgeFor(entry: EntryForBadge, check: CheckForBadge | null): Badge {
  if (!check || !entry.checkId || check.id !== entry.checkId || check.entryId !== entry.id) return { kind: "none" };
  if (check.status !== "done" || !check.level || check.score === null || !check.reportId) return { kind: "none" };
  if (!sameFile(entry.fileSha256, check.fileSha256)) return { kind: "none" };
  return { kind: "checked", level: check.level, score: check.score, reportId: check.reportId };
}

/** The public verify page: is this report still about the file the entry uses? */
export const verifyState = (checkSha: string | null, entrySha: string | null): "valid" | "changed" => (sameFile(checkSha, entrySha) ? "valid" : "changed");

/**
 * The client checks an entry with their own checker. A report for the same file is reused (no check used);
 * a report about an older file is taken off the entry first, then a new check runs.
 */
export function reuseDecision(existing: { fileSha256: string | null } | null, sha: string): "new" | "reuse" | "detach" {
  if (!existing) return "new";
  // Checks made before fingerprints existed: entry files never change, so it is the same file.
  if (!existing.fileSha256) return "reuse";
  return existing.fileSha256 === sha ? "reuse" : "detach";
}

// ---------------------------------------------------------------------------------------------------------
// The client's judging page
// ---------------------------------------------------------------------------------------------------------

/** Pro first is the default. The checker result never changes the default order. */
export const JUDGING_SORTS = ["pro", "newest", "top", "lowest"] as const;
export type JudgingSort = (typeof JUDGING_SORTS)[number];
export const isJudgingSort = (v: unknown): v is JudgingSort => (JUDGING_SORTS as readonly unknown[]).includes(v);

type Sortable = { number: number; pro: boolean; rating: number | null; badge: Badge };

const levelRank = (b: Badge) => (b.kind === "none" ? 3 : b.level === "low" ? 0 : b.level === "medium" ? 1 : 2);

/**
 * pro: Pro entries first, newest first inside each group. newest: newest first, Pro and Basic mixed.
 * top: the client's highest stars first. lowest: Low → Medium → High → Not checked (lower % first inside a level).
 */
export function sortForJudging<T extends Sortable>(list: readonly T[], sort: JudgingSort): T[] {
  return [...list].sort((a, b) => {
    if (sort === "pro") return Number(b.pro) - Number(a.pro) || b.number - a.number;
    if (sort === "top") return (b.rating ?? 0) - (a.rating ?? 0) || b.number - a.number;
    if (sort === "lowest") {
      const r = levelRank(a.badge) - levelRank(b.badge);
      if (r) return r;
      const s = (a.badge.kind === "checked" ? a.badge.score : 0) - (b.badge.kind === "checked" ? b.badge.score : 0);
      return s || b.number - a.number;
    }
    return b.number - a.number;
  });
}

/** Checked / Not checked come before the client's own filters (owner, 2026-10-14). */
export const JUDGING_FILTERS = ["all", "checked", "unchecked", "shortlisted", "unrated", "rejected"] as const;
export type JudgingFilter = (typeof JUDGING_FILTERS)[number];

type Filterable = { status: string; isShortlisted: boolean; rating: number | null; badge: Badge };

export function matchesFilter(e: Filterable, f: JudgingFilter): boolean {
  if (f === "rejected") return e.status === "rejected";
  if (e.status === "rejected") return false;
  if (f === "checked") return e.badge.kind === "checked";
  if (f === "unchecked") return e.badge.kind === "none";
  if (f === "shortlisted") return e.isShortlisted;
  if (f === "unrated") return !e.rating && e.status === "active";
  return true;
}

export function filterCounts(list: readonly Filterable[]): Record<JudgingFilter, number> {
  return Object.fromEntries(JUDGING_FILTERS.map((f) => [f, list.filter((e) => matchesFilter(e, f)).length])) as Record<JudgingFilter, number>;
}

// ---------------------------------------------------------------------------------------------------------
// Closest results: a source name, a link and the similarity, never a copy of someone else's logo
// ---------------------------------------------------------------------------------------------------------

export type ClosestResult = { name: string; url: string | null; similarity: number };

export function closestResults(matches: { title: string | null; site: string | null; pageUrl: string | null; similarity: number }[], keep = 3): ClosestResult[] {
  return [...matches]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, keep)
    .map((m) => ({ name: (m.site || m.title || "").slice(0, 120) || "—", url: m.pageUrl && /^https:\/\//i.test(m.pageUrl) ? m.pageUrl : null, similarity: m.similarity }));
}
