import "server-only";
import { cache } from "react";
import { getPricingConfig } from "@/lib/contests/pricing-config";
import { feePercentFor, prizeWithFee } from "@/lib/contests/pricing";
import { getSettings } from "@/lib/settings";
import type { SiteFacts } from "./fill-facts";

/**
 * The site's facts for text written for search engines and AI tools (owner, 2026-10-21; SEO-PLAN.md §2.4): always in
 * taka and always the total a client really pays (prize + service fee), from the live settings. Never type a price
 * into such text; use these.
 */

export const PACKAGE_KEYS = ["economy", "standard", "pro", "premium", "elite"] as const;
export type PackageKey = (typeof PACKAGE_KEYS)[number];

export const siteFacts = cache(async (): Promise<SiteFacts> => {
  const [pricing, s] = await Promise.all([getPricingConfig(), getSettings(["timers.judging_window_days"])]);
  const fee = { serviceFeePercent: pricing.serviceFeePercent, largeFeePercent: pricing.largeFeePercent, largeFeeFrom: pricing.largeFeeFrom };
  const minPrize = Math.min(pricing.customMin, ...PACKAGE_KEYS.map((k) => pricing.packagePrizes[k]));
  return {
    minPrize,
    minTotal: prizeWithFee(minPrize, fee),
    fee: pricing.serviceFeePercent,
    largeFee: pricing.largeFeePercent,
    largeFrom: pricing.largeFeeFrom,
    customStep: pricing.customStep,
    defaultDays: pricing.defaultDuration,
    minDays: pricing.durationMin,
    maxDays: pricing.durationMax,
    judgingDays: s["timers.judging_window_days"],
    packages: PACKAGE_KEYS.map((key) => {
      const prize = pricing.packagePrizes[key];
      return { key, prize, feePercent: feePercentFor(prize, fee), total: prizeWithFee(prize, fee) };
    }),
    guaranteeOn: false,
    guaranteeDesigners: 3,
  };
});

export { fillFacts, type SiteFacts } from "./fill-facts";
