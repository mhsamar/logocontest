/** Month maths for the monthly prizes and the leaderboard (BLUEPRINT §11), in Asia/Dhaka time. Pure, so they are tested. */

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
