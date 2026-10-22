/**
 * The monthly race (owner, 2026-10-11; BLUEPRINT §11, Design/rewards/REWARDS-HANDOFF.md §A). Pure, so every rule is
 * tested; race.ts reads the database and calls these.
 *
 * - Smartphone: the client who ran the most contests that month. A contest counts when it is paid and went live
 *   that month (Asia/Dhaka), unless an admin cancelled it; one that ended without a winner still counts.
 *   Equal: the bigger total prize money wins.
 * - Mystery gift box: the designer who won the most contests that month (the month the winner was picked); a win
 *   that was cancelled (files never sent) or ended with no result does not count. Equal: whoever earned more.
 * - Admins, staff, banned and test accounts never take part; in test mode only test accounts do.
 */
import { payoutFor } from "@/lib/wallet/fees";
import { monthKey, monthRange, previousMonth } from "./rules";

export type RacePerson = { id: string; role: "client" | "designer" | "admin"; status: string; isTest: boolean; abroad?: boolean };

/**
 * Who is in the race. Test mode counts only test accounts, so a test close never touches real people. The smartphone
 * and gift box are for Bangladesh only (owner, 2026-10-14): an account visiting mostly from abroad is out.
 */
export function inRace(p: RacePerson | undefined, testMode: boolean): boolean {
  if (!p || p.role === "admin" || p.status === "banned" || p.abroad) return false;
  return testMode ? p.isTest : !p.isTest;
}

/** More of the month's visits came from outside Bangladesh than from it. No country known: in Bangladesh. */
export const visitsAbroad = (v: { bd: number; abroad: number } | undefined) => Boolean(v && v.abroad > v.bd);

export type RaceContest = { contestId: string; clientId: string; prize: number; startsAt: Date; status: string; paid: boolean; /** A money-back claim waits, was approved or paid (owner, 2026-10-21). */ moneyBack?: boolean };
export type RacePayment = { clientId: string; amount: number; paidAt: Date };
export type RaceWin = { contestId: string; designerId: string; prize: number; feeRate: number; pickedAt: Date; status: string };
export type RaceEntry = { contestId: string; designerId: string; createdAt: Date; status: string };

export type ClientStanding = { id: string; contests: number; prizeTotal: number; spent: number; firstAt: Date };
export type DesignerStanding = { id: string; wins: number; earned: number; joined: number; firstWinAt: Date };

const within = (d: Date, r: { start: Date; end: Date }) => d >= r.start && d < r.end;

/** Wins that hold: the winner was picked and the win wasn't cancelled or ended with no result. */
export const COUNTED_WIN_STATUSES = ["awaiting_files", "submitted", "revision_requested", "approved"];

/** Clients in the race for a month, best first: most contests, then most prize money, then who started first. */
export function rankClients(
  month: string,
  contests: RaceContest[],
  payments: RacePayment[],
  people: Map<string, RacePerson>,
  testMode = false,
): ClientStanding[] {
  const range = monthRange(month);
  const by = new Map<string, ClientStanding>();
  for (const c of contests) {
    if (!c.paid || c.status === "cancelled" || c.moneyBack || !within(c.startsAt, range) || !inRace(people.get(c.clientId), testMode)) continue;
    const s = by.get(c.clientId) ?? { id: c.clientId, contests: 0, prizeTotal: 0, spent: 0, firstAt: c.startsAt };
    s.contests += 1;
    s.prizeTotal += c.prize;
    if (c.startsAt < s.firstAt) s.firstAt = c.startsAt;
    by.set(c.clientId, s);
  }
  // What each client paid this month (contests, add-ons, extensions): shown to admins only.
  for (const p of payments) {
    const s = by.get(p.clientId);
    if (s && within(p.paidAt, range)) s.spent += p.amount;
  }
  return [...by.values()].sort((a, b) => b.contests - a.contests || b.prizeTotal - a.prizeTotal || a.firstAt.getTime() - b.firstAt.getTime() || a.id.localeCompare(b.id));
}

/** Designers with a win in the month, best first: most wins, then most earned, then who won first. */
export function rankDesigners(month: string, wins: RaceWin[], entries: RaceEntry[], people: Map<string, RacePerson>, testMode = false): DesignerStanding[] {
  const range = monthRange(month);
  const by = new Map<string, DesignerStanding>();
  for (const w of wins) {
    if (!COUNTED_WIN_STATUSES.includes(w.status) || !within(w.pickedAt, range) || !inRace(people.get(w.designerId), testMode)) continue;
    const s = by.get(w.designerId) ?? { id: w.designerId, wins: 0, earned: 0, joined: 0, firstWinAt: w.pickedAt };
    s.wins += 1;
    // What the designer gets for the win: the prize minus the fee locked when they were picked.
    s.earned += payoutFor(w.prize, w.feeRate).credit;
    if (w.pickedAt < s.firstWinAt) s.firstWinAt = w.pickedAt;
    by.set(w.designerId, s);
  }
  // Contests joined this month (submitted at least one design that wasn't withdrawn or removed).
  const joined = new Map<string, Set<string>>();
  for (const e of entries) {
    if (!by.has(e.designerId) || !within(e.createdAt, range) || e.status === "withdrawn" || e.status === "removed") continue;
    joined.set(e.designerId, (joined.get(e.designerId) ?? new Set()).add(e.contestId));
  }
  for (const [id, set] of joined) by.get(id)!.joined = set.size;
  return [...by.values()].sort((a, b) => b.wins - a.wins || b.earned - a.earned || a.firstWinAt.getTime() - b.firstWinAt.getTime() || a.id.localeCompare(b.id));
}

/** The month's winner: the first in the list, or null when nobody qualified. */
export const winnerOf = <T,>(ranked: T[]): T | null => ranked[0] ?? null;

/** Days left in the month, counting today (Asia/Dhaka); 0 once the month is over. */
export function daysLeft(month: string, now: Date): number {
  const { end } = monthRange(month);
  const ms = end.getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

/**
 * True on the last day of the month (Dhaka). The scheduled close fires at 23:59 on days 28–31 and checks this, so it
 * only closes the month on its real last day.
 */
export function isLastDayOfMonth(now: Date): boolean {
  const local = new Date(now.getTime() + 6 * 3600 * 1000);
  const tomorrow = new Date(local.getTime() + 86_400_000);
  return tomorrow.getUTCDate() === 1;
}

/**
 * The month the scheduled close may close right now, or null (owner, 2026-10-11): the current month from 23:55 on its
 * last day (the job fires at 23:59 Dhaka), so a stray call earlier in the day closes nothing.
 */
export function closableMonth(now: Date): string | null {
  const local = new Date(now.getTime() + 6 * 3600 * 1000);
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  return isLastDayOfMonth(now) && minutes >= 23 * 60 + 55 ? monthKey(now) : null;
}

/**
 * The safety net, run by the 15-minute job: on the 1st (Dhaka), last month if the 23:59 close didn't happen. Only on
 * the 1st, so months before the prizes started are never closed.
 */
export function missedMonth(now: Date): string | null {
  const local = new Date(now.getTime() + 6 * 3600 * 1000);
  return local.getUTCDate() === 1 ? previousMonth(monthKey(now)) : null;
}
