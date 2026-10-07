/**
 * Client charge (BLUEPRINT §7.1):
 *   service_fee = round(prize × fee%)
 *   total       = prize + service_fee + upgrades
 * All amounts are whole taka. Every number comes from settings.
 */
import type { Order, PackageKey, UpgradeKey } from "./brief";
import { UPGRADES } from "./brief";

export type PricingConfig = {
  serviceFeePercent: number;
  packagePrizes: Record<Exclude<PackageKey, "custom">, number>;
  customMin: number;
  customStep: number;
  upgradePrices: Record<UpgradeKey, number>;
  durationOptions: number[];
  defaultDuration: number;
};

export type Price = {
  prize: number;
  serviceFee: number;
  upgrades: { key: UpgradeKey; price: number }[];
  upgradesTotal: number;
  total: number;
};

export type OrderError = "custom_min" | "custom_step" | "custom_missing" | "duration";

export function serviceFee(prize: number, percent: number): number {
  return Math.round((prize * percent) / 100);
}

export function validateOrder(order: Order, cfg: PricingConfig): OrderError | null {
  if (!cfg.durationOptions.includes(order.durationDays)) return "duration";
  if (order.package !== "custom") return null;
  const amount = order.customPrize;
  if (amount === null || !Number.isInteger(amount)) return "custom_missing";
  if (amount < cfg.customMin) return "custom_min";
  if (amount % cfg.customStep !== 0) return "custom_step";
  return null;
}

export function prizeFor(order: Order, cfg: PricingConfig): number {
  return order.package === "custom" ? (order.customPrize ?? 0) : cfg.packagePrizes[order.package];
}

/** Price breakdown. Throws on an invalid order — call validateOrder first in UI code. */
export function calculatePrice(order: Order, cfg: PricingConfig): Price {
  const error = validateOrder(order, cfg);
  if (error) throw new Error(`Invalid order: ${error}`);
  const prize = prizeFor(order, cfg);
  const fee = serviceFee(prize, cfg.serviceFeePercent);
  const upgrades = UPGRADES.filter((k) => order.upgrades[k]).map((key) => ({ key, price: cfg.upgradePrices[key] }));
  const upgradesTotal = upgrades.reduce((sum, u) => sum + u.price, 0);
  return { prize, serviceFee: fee, upgrades, upgradesTotal, total: prize + fee + upgradesTotal };
}

export function defaultOrder(cfg: PricingConfig): Order {
  return {
    package: "standard",
    customPrize: null,
    durationDays: cfg.defaultDuration,
    upgrades: { blind: false, private: false, promoted: false },
  };
}
