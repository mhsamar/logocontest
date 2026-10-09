import "server-only";
import { getSettings } from "@/lib/settings";
import type { PricingConfig } from "./pricing";

export async function getPricingConfig(): Promise<PricingConfig> {
  const s = await getSettings([
    "fees.client_service_fee_percent",
    "fees.client_service_fee_large_percent",
    "fees.client_service_fee_large_from",
    "packages.economy_prize",
    "packages.standard_prize",
    "packages.pro_prize",
    "packages.premium_prize",
    "packages.elite_prize",
    "packages.custom_min_prize",
    "packages.custom_step",
    "upgrades.blind_price",
    "upgrades.private_price",
    "upgrades.promoted_price",
    "upgrades.logo_scan_price",
    "upgrades.highlight_price",
    "upgrades.urgent_price",
    "upgrades.nda_price",
    "timers.contest_duration_options_days",
    "timers.contest_duration_min_days",
    "timers.contest_duration_max_days",
    "timers.contest_duration_default_days",
  ]);
  return {
    serviceFeePercent: s["fees.client_service_fee_percent"],
    largeFeePercent: s["fees.client_service_fee_large_percent"],
    largeFeeFrom: s["fees.client_service_fee_large_from"],
    packagePrizes: {
      economy: s["packages.economy_prize"],
      standard: s["packages.standard_prize"],
      pro: s["packages.pro_prize"],
      premium: s["packages.premium_prize"],
      elite: s["packages.elite_prize"],
    },
    customMin: s["packages.custom_min_prize"],
    customStep: s["packages.custom_step"],
    upgradePrices: {
      blind: s["upgrades.blind_price"],
      private: s["upgrades.private_price"],
      promoted: s["upgrades.promoted_price"],
      logo_scan: s["upgrades.logo_scan_price"],
      highlight: s["upgrades.highlight_price"],
      urgent: s["upgrades.urgent_price"],
      nda: s["upgrades.nda_price"],
    },
    durationOptions: s["timers.contest_duration_options_days"],
    durationMin: s["timers.contest_duration_min_days"],
    durationMax: s["timers.contest_duration_max_days"],
    defaultDuration: s["timers.contest_duration_default_days"],
  };
}
