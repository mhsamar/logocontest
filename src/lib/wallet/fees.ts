/**
 * Designer fee tiers (BLUEPRINT §7.2; owner 2026-10-08: 15% to start, 10% after 10 counted wins,
 * 5% after 50). Pure functions, so the numbers are easy to test; the tiers come from settings.
 */
export type FeeTier = { min_wins: number; rate_percent: number };

const sorted = (tiers: readonly FeeTier[]) => [...tiers].sort((a, b) => a.min_wins - b.min_wins);

/** The fee rate for a designer who has this many counted wins before this one. */
export function feeRateFor(countedWins: number, tiers: readonly FeeTier[]): number {
  let rate = sorted(tiers)[0]?.rate_percent ?? 0;
  for (const tier of sorted(tiers)) if (countedWins >= tier.min_wins) rate = tier.rate_percent;
  return rate;
}

/** The next cheaper tier and how many more counted wins it takes, or null at the lowest fee. */
export function nextTier(countedWins: number, tiers: readonly FeeTier[]): { tier: FeeTier; winsToGo: number } | null {
  const next = sorted(tiers).find((t) => t.min_wins > countedWins);
  return next ? { tier: next, winsToGo: next.min_wins - countedWins } : null;
}

/** What the winner receives: prize minus the fee, rounded to whole taka (same rounding as the database). */
export function payoutFor(prize: number, ratePercent: number): { fee: number; credit: number } {
  const fee = Math.round((prize * ratePercent) / 100);
  return { fee, credit: prize - fee };
}
