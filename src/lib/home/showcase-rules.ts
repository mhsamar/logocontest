/*
 * Home showcase (owner, 2026-11-20; Design/logocontest-home-showcase): the pure rules. Which designs may show, how the
 * logo wall and the contest cards are picked, and the "300+" count. No database here, so the tests pin every rule.
 */

/** Statuses of a design anyone sees on the contest page (entries/rules SHOWN_STATUSES). */
const SHOWN = new Set(["active", "winner", "forfeited"]);
/** While a contest is open or judged, a Pro designer's hidden design stays hidden (entries/rules stillHidden). */
const HIDING = new Set(["open", "judging"]);

export const WALL_ROWS = 3;
export const WALL_PER_ROW = 16;
/** At most this many designs of one contest in one wall row, so the wall looks varied. */
export const WALL_PER_CONTEST = 2;
export const LIVE_CARDS = 3;
export const LIVE_LOGOS = 11;
export const FEATURED_LOGOS = 23;
export const MORE_FINISHED = 4;

/** A contest as the showcase reads it; only contests that already passed the database filters reach here. */
export type SContest = {
  id: string;
  slug: string;
  brand: string;
  businessType: string;
  status: string;
  isPrivate: boolean;
  isNda: boolean;
  isBlind: boolean;
  homeShow: boolean;
  ownerIsTest: boolean;
  service: string | null;
  prize: number;
  startsAt: string | null;
  endsAt: string | null;
  completedAt: string | null;
  winnerEntryId: string | null;
};

export type SEntry = {
  id: string;
  number: number;
  status: string;
  isHidden: boolean;
  homeHidden: boolean;
  createdAt: string;
  contestId: string;
  designerId: string;
  designerActive: boolean;
  designerIsTest: boolean;
};

/**
 * A contest the showcase may use: public (never blind, private or NDA), not a test client's, a logo contest, on the
 * public list (not cancelled or in the Trash) and not switched off by the team ("হোমে দেখাবে").
 */
export function contestAllowed(c: SContest): boolean {
  const publicStatus = ["open", "judging", "winner_selected", "handover", "completed", "no_result"].includes(c.status);
  return publicStatus && !c.isPrivate && !c.isNda && !c.isBlind && c.homeShow && !c.ownerIsTest && (c.service ?? "logo") === "logo";
}

/**
 * A design the showcase may show: in an allowed contest, shown on the contest page today (active, winner or
 * forfeited; never held, rejected, removed or withdrawn), not a Pro designer's design still hidden, not hidden from
 * home by the team, not under an open report, and by an active, real designer.
 */
export function entryAllowed(e: SEntry, c: SContest | undefined, reported: Set<string>): boolean {
  if (!c || !contestAllowed(c)) return false;
  if (!SHOWN.has(e.status) || e.homeHidden || reported.has(e.id)) return false;
  if (e.isHidden && HIDING.has(c.status)) return false;
  return e.designerActive && !e.designerIsTest;
}

/** "300+": the count rounded down to the nearest 50, with a plus; under 50 the exact number, without one. */
export function roundedCount(n: number): { n: number; plus: boolean } {
  if (n < 50) return { n: Math.max(0, n), plus: false };
  return { n: Math.floor(n / 50) * 50, plus: true };
}

/** A number from a text, the same every time (FNV-1a), for the day's shuffle. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The list in the day's order: the same all day for everyone, a new order the next day. */
export function dailyShuffle<T extends { id: string }>(list: T[], day: string): T[] {
  return [...list].sort((a, b) => hash(`${day}:${a.id}`) - hash(`${day}:${b.id}`) || a.id.localeCompare(b.id));
}

/**
 * The logo wall: three rows of up to 16, from winners and the newest designs mixed, in the day's order; at most two
 * designs of one contest per row and never the same design twice. `pool` is already allowed and has pictures.
 */
export function pickWall<T extends { id: string; contestId: string; status: string; createdAt: string }>(pool: T[], day: string): T[][] {
  const winners = pool.filter((e) => e.status === "winner");
  const recent = [...pool].filter((e) => e.status !== "winner").sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, WALL_ROWS * WALL_PER_ROW * 2);
  const order = dailyShuffle([...winners, ...recent], day);
  const rows: T[][] = Array.from({ length: WALL_ROWS }, () => []);
  const used = new Set<string>();
  for (const e of order) {
    if (used.has(e.id)) continue;
    // The emptiest row that still has room for this contest.
    const row = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.length < WALL_PER_ROW && r.filter((x) => x.contestId === e.contestId).length < WALL_PER_CONTEST)
      .sort((a, b) => a.r.length - b.r.length || a.i - b.i)[0];
    if (!row) continue;
    row.r.push(e);
    used.add(e.id);
  }
  return rows.filter((r) => r.length > 0);
}

const time = (v: string | null) => (v ? new Date(v).getTime() : 0);

/** Pinned contests first (in the pinned order, only those still allowed), then the rest by `score`, highest first. */
export function pinnedThenBest<T extends { id: string }>(list: T[], pins: string[], score: (x: T) => number, limit: number): T[] {
  const byId = new Map(list.map((x) => [x.id, x]));
  const picked = pins.map((id) => byId.get(id)).filter((x): x is T => Boolean(x));
  const rest = list.filter((x) => !picked.includes(x)).sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
  return [...new Set([...picked, ...rest])].slice(0, Math.max(0, limit));
}

/** Live: open and still running; with Pro early access, not one that opened after `hideNewerThan`. */
export function isLive(c: SContest, now: Date, hideNewerThan: Date | null): boolean {
  if (c.status !== "open" || !c.endsAt || time(c.endsAt) <= now.getTime()) return false;
  return !(hideNewerThan && c.startsAt && time(c.startsAt) > hideNewerThan.getTime());
}

/** Finished: completed, with a winner. */
export const isFinished = (c: SContest) => c.status === "completed" && Boolean(c.winnerEntryId);

/**
 * The large finished contest: the pinned one, else the one with the most designs among those finished in the last
 * 90 days (or ever, when none finished that recently).
 */
export function pickFeatured(finished: SContest[], pin: string, designs: (id: string) => number, now: Date): SContest | null {
  const pinned = finished.find((c) => c.id === pin);
  if (pinned) return pinned;
  const recent = finished.filter((c) => now.getTime() - time(c.completedAt) <= 90 * 86_400_000);
  return pinnedThenBest(recent.length ? recent : finished, [], (c) => designs(c.id), 1)[0] ?? null;
}

/** The contest's length in whole days, from start to end (at least 1). */
export function contestDays(c: Pick<SContest, "startsAt" | "endsAt">): number {
  if (!c.startsAt || !c.endsAt) return 0;
  return Math.max(1, Math.round((time(c.endsAt) - time(c.startsAt)) / 86_400_000));
}

/** The grid's designs: the winner always in, then by design number; at most `limit`. */
export function gridEntries<T extends { id: string; number: number }>(list: T[], winnerId: string | null, limit: number): T[] {
  const sorted = [...list].sort((a, b) => a.number - b.number);
  const top = sorted.slice(0, limit);
  const winner = winnerId ? sorted.find((e) => e.id === winnerId) : undefined;
  if (!winner || top.includes(winner)) return top;
  return [...top.slice(0, Math.max(0, limit - 1)), winner].sort((a, b) => a.number - b.number);
}

/** The day in Dhaka (YYYY-MM-DD), for the wall's daily order. */
export const dhakaDay = (now: Date) => new Date(now.getTime() + 6 * 3_600_000).toISOString().slice(0, 10);
