/**
 * Logo checker API cost (owner, 2026-10-14). Pure: the prices come from Settings › Logo checker costs (US cents, so
 * they stay whole numbers), and each check keeps its cost in USD and in taka at the rate of the day it ran.
 */

export type CheckerRates = {
  /** USD per Google Lens search. */
  lens: number;
  /** USD per Cloud Vision image. */
  vision: number;
  /** USD per input / output token of the AI model. */
  aiIn: number;
  aiOut: number;
  /** Taka per US dollar. */
  usdToBdt: number;
};

export function ratesFrom(s: { lensCentsPer1000: number; visionCentsPer1000: number; aiInCentsPerM: number; aiOutCentsPerM: number; usdToBdt: number }): CheckerRates {
  return {
    lens: s.lensCentsPer1000 / 100 / 1000,
    vision: s.visionCentsPer1000 / 100 / 1000,
    aiIn: s.aiInCentsPerM / 100 / 1_000_000,
    aiOut: s.aiOutCentsPerM / 100 / 1_000_000,
    usdToBdt: s.usdToBdt,
  };
}

/** One AI call, priced with the admin's rates. */
export const aiCost = (r: { tokens: { in: number; out: number } }, rates: Pick<CheckerRates, "aiIn" | "aiOut">) => r.tokens.in * rates.aiIn + r.tokens.out * rates.aiOut;

/** The two web searches; one that didn't run costs nothing. */
export const searchCost = (lens: { ran: boolean }, vision: { ran: boolean }, rates: Pick<CheckerRates, "lens" | "vision">) => (lens.ran ? rates.lens : 0) + (vision.ran ? rates.vision : 0);

/** USD → taka, to the paisa. */
export const toBdt = (usd: number, rates: Pick<CheckerRates, "usdToBdt">) => Math.round(usd * rates.usdToBdt * 100) / 100;

/** The settings the rates come from (server code passes getSettings' answer here). */
export const RATE_KEYS = ["checker.cost_lens_cents_per_1000", "checker.cost_vision_cents_per_1000", "checker.cost_ai_in_cents_per_m", "checker.cost_ai_out_cents_per_m", "checker.usd_to_bdt"] as const;

export async function checkerRates(): Promise<CheckerRates> {
  const { getSettings } = await import("@/lib/settings");
  const s = await getSettings([...RATE_KEYS]);
  return ratesFrom({
    lensCentsPer1000: s["checker.cost_lens_cents_per_1000"],
    visionCentsPer1000: s["checker.cost_vision_cents_per_1000"],
    aiInCentsPerM: s["checker.cost_ai_in_cents_per_m"],
    aiOutCentsPerM: s["checker.cost_ai_out_cents_per_m"],
    usdToBdt: s["checker.usd_to_bdt"],
  });
}
