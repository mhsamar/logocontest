/** Monthly Winner and leaderboard rules (BLUEPRINT §11, owner 2026-10-09). Pure, so they are tested. */

const DHAKA_OFFSET_MS = 6 * 3600 * 1000; // Bangladesh has no daylight saving

/** "2026-10" for a moment, in Bangladesh time. */
export function monthKey(d: Date): string {
  const local = new Date(d.getTime() + DHAKA_OFFSET_MS);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The month as [start, end) instants. */
export function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1) - DHAKA_OFFSET_MS), end: new Date(Date.UTC(y, m, 1) - DHAKA_OFFSET_MS) };
}

export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export const isMonthKey = (v: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/** The last n months, newest first, starting from the given one. */
export function recentMonths(from: string, n: number): string[] {
  const out = [from];
  while (out.length < n) out.push(previousMonth(out.at(-1)!));
  return out;
}

export type LikedDesign = { entryId: string; likes: number; rating: number | null; finishedAt: Date };

/**
 * Leaderboard and Monthly Winner order (owner, 2026-10-09): most likes, then the client's star rating,
 * then the contest that finished first.
 */
export function rankDesigns<T extends LikedDesign>(designs: T[]): T[] {
  return [...designs].sort((a, b) => b.likes - a.likes || (b.rating ?? 0) - (a.rating ?? 0) || a.finishedAt.getTime() - b.finishedAt.getTime());
}

/** Who may like a winning design: a signed-in, active designer who didn't make it. */
export function canLike(viewer: { id: string; role: string; status: string } | null, designerId: string): boolean {
  return Boolean(viewer && viewer.role === "designer" && viewer.status === "active" && viewer.id !== designerId);
}
