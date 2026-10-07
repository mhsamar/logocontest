import "server-only";
import { getSettings } from "@/lib/settings";
import type { PricingConfig } from "./pricing";

export async function getPricingConfig(): Promise<PricingConfig> {
  const s = await getSettings([
    "fees.client_service_fee_percent",
    "packages.economy_prize",
    "packages.standard_prize",
    "packages.premium_prize",
    "packages.custom_min_prize",
    "packages.custom_step",
    "upgrades.blind_price",
    "upgrades.private_price",
    "upgrades.promoted_price",
    "timers.contest_duration_options_days",
    "timers.contest_duration_default_days",
  ]);
  return {
    serviceFeePercent: s["fees.client_service_fee_percent"],
    packagePrizes: {
      economy: s["packages.economy_prize"],
      standard: s["packages.standard_prize"],
      premium: s["packages.premium_prize"],
    },
    customMin: s["packages.custom_min_prize"],
    customStep: s["packages.custom_step"],
    upgradePrices: {
      blind: s["upgrades.blind_price"],
      private: s["upgrades.private_price"],
      promoted: s["upgrades.promoted_price"],
    },
    durationOptions: s["timers.contest_duration_options_days"],
    defaultDuration: s["timers.contest_duration_default_days"],
  };
}
