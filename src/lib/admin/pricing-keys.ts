import type { SettingKey } from "@/lib/settings/registry";

/**
 * Admin › Pricing & fees (owner, 2026-10-22; A-28): every price and fee clients and designers pay, in one place, with
 * its own permission. Each section saves one settings group (saveSettings writes one group at a time). Pure: shared
 * by the page, the save action and the tests.
 */
export const PRICING_SECTIONS = [
  { id: "clientFee", group: "fees", keys: ["fees.client_service_fee_percent", "fees.client_service_fee_large_percent", "fees.client_service_fee_large_from"] },
  {
    id: "packages",
    group: "packages",
    keys: ["packages.economy_prize", "packages.standard_prize", "packages.pro_prize", "packages.premium_prize", "packages.elite_prize", "packages.custom_min_prize", "packages.custom_step", "packages.best_results_from"],
  },
  {
    id: "addons",
    group: "upgrades",
    keys: ["upgrades.all_free_from", "upgrades.promoted_price", "upgrades.blind_price", "upgrades.private_price", "upgrades.highlight_price", "upgrades.urgent_price", "upgrades.nda_price", "upgrades.extension_price_per_day", "upgrades.extension_days_options"],
  },
  { id: "designerFee", group: "fees", keys: ["fees.designer_tiers", "fees.counted_win_min_prize", "fees.counted_win_min_designers", "fees.counted_wins_max_per_client"] },
  { id: "dollars", group: "payments", keys: ["payments.usd_rate", "payments.usd_markup_percent"] },
] as const satisfies readonly { id: string; group: string; keys: readonly SettingKey[] }[];

export type PricingSectionId = (typeof PRICING_SECTIONS)[number]["id"];

/** Every setting the pricing page controls (people with the Pricing permission may save only these). */
export const PRICING_KEYS: ReadonlySet<string> = new Set(PRICING_SECTIONS.flatMap((s) => s.keys));

export type DesignerTier = { min_wins: number; rate_percent: number };

/**
 * Designer fee tiers must start at 0 wins and go up, each row once, with a fee from 0 to 100 (otherwise the wallet,
 * the How it works page and the fee itself go wrong). Null when fine, else what is wrong.
 */
export function tiersProblem(tiers: DesignerTier[]): "empty" | "start" | "order" | null {
  if (!tiers.length) return "empty";
  if (tiers[0].min_wins !== 0) return "start";
  for (let i = 1; i < tiers.length; i++) if (tiers[i].min_wins <= tiers[i - 1].min_wins) return "order";
  return null;
}
