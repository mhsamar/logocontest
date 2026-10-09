/**
 * Lifecycle rules (BLUEPRINT §2, §6, §7.5). Pure functions, so the money and the timing are easy to test;
 * the 15-minute job (run.ts) reads the database and calls these.
 */
import { feeRateFor, type FeeTier } from "@/lib/wallet/fees";

export type SplitEntry = { designerId: string; status: string; createdAt: Date };
export type Share = { designerId: string; share: number; feeRate: number; fee: number; credit: number };

/**
 * No-result split (§7.5): equal shares per designer (not per entry, ratings don't matter) among designers
 * with an active or winning entry, minus any designer whose entry was forfeited. Leftover taka go 1 each
 * to the designers who entered first. Each share pays that designer's normal fee tier.
 */
export function splitPrize(prize: number, entries: SplitEntry[], countedWins: (designerId: string) => number, tiers: readonly FeeTier[]): Share[] {
  const forfeited = new Set(entries.filter((e) => e.status === "forfeited").map((e) => e.designerId));
  const firstEntry = new Map<string, number>();
  for (const e of entries) {
    if (!["active", "winner"].includes(e.status) || forfeited.has(e.designerId)) continue;
    const t = e.createdAt.getTime();
    if (!firstEntry.has(e.designerId) || t < firstEntry.get(e.designerId)!) firstEntry.set(e.designerId, t);
  }
  const designers = [...firstEntry.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([id]) => id);
  if (designers.length === 0 || prize <= 0) return [];
  const base = Math.floor(prize / designers.length);
  const leftover = prize - base * designers.length;
  return designers.map((designerId, i) => {
    const share = base + (i < leftover ? 1 : 0);
    const feeRate = feeRateFor(countedWins(designerId), tiers);
    const fee = Math.round((share * feeRate) / 100);
    return { designerId, share, feeRate, fee, credit: share - fee };
  });
}

/** Judging-day reminders that are due now and not yet sent (§6: days 1, 3, 5 after the contest ends). */
export function dueReminders(endedAt: Date, now: Date, days: readonly number[], sent: ReadonlySet<string>): number[] {
  const elapsed = (now.getTime() - endedAt.getTime()) / 86_400_000;
  return days.filter((d) => elapsed >= d - 1 && !sent.has(reminderKind(d)));
}

export const reminderKind = (day: number) => `judging_reminder_${day}`;
export const ENDING_SOON = "ending_soon";

/** Whether the "ends soon" notice is due: within the notice window before the end, contest still running. */
export function endingSoonDue(endsAt: Date, now: Date, noticeHours: number): boolean {
  const ms = endsAt.getTime() - now.getTime();
  return ms > 0 && ms <= noticeHours * 3_600_000;
}
