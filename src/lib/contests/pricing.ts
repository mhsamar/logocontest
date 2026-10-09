/**
 * Client charge (BLUEPRINT §7.1):
 *   service_fee = round(prize × fee%), fee% = 25%, or 15% when the prize is above ৳30,000 (settings)
 *   total       = prize + service_fee + upgrades
 * All amounts are whole taka. Every number comes from settings.
 */
import type { Order, PackageKey, UpgradeKey } from "./brief";
import { noUpgrades, UPGRADES } from "./brief";

export type PricingConfig = {
  serviceFeePercent: number;
  /** Lower fee for big prizes (owner, 2026-10-08): prizes above largeFeeFrom pay largeFeePercent. */
  largeFeePercent: number;
  largeFeeFrom: number;
  packagePrizes: Record<Exclude<PackageKey, "custom">, number>;
  customMin: number;
  customStep: number;
  upgradePrices: Record<UpgradeKey, number>;
  /** Quick-pick chips; any whole number of days from durationMin to durationMax is allowed (owner, 2026-10-08). */
  durationOptions: number[];
  durationMin: number;
  durationMax: number;
  defaultDuration: number;
};

export type Price = {
  prize: number;
  /** The fee percent used for this prize. */
  feePercent: number;
  serviceFee: number;
  upgrades: { key: UpgradeKey; price: number }[];
  upgradesTotal: number;
  total: number;
};

export type OrderError = "custom_min" | "custom_step" | "custom_missing" | "duration";

export function serviceFee(prize: number, percent: number): number {
  return Math.round((prize * percent) / 100);
}

/** The service fee percent for this prize: the normal rate, or the lower one above the threshold. */
export function feePercentFor(prize: number, cfg: Pick<PricingConfig, "serviceFeePercent" | "largeFeePercent" | "largeFeeFrom">): number {
  return prize > cfg.largeFeeFrom ? cfg.largeFeePercent : cfg.serviceFeePercent;
}

/** What the client pays for this prize before add-ons. */
export function prizeWithFee(prize: number, cfg: Pick<PricingConfig, "serviceFeePercent" | "largeFeePercent" | "largeFeeFrom">): number {
  return prize + serviceFee(prize, feePercentFor(prize, cfg));
}

export function validateOrder(order: Order, cfg: PricingConfig): OrderError | null {
  const d = order.durationDays;
  if (!Number.isInteger(d) || d < cfg.durationMin || d > cfg.durationMax) return "duration";
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
  const feePercent = feePercentFor(prize, cfg);
  const fee = serviceFee(prize, feePercent);
  const upgrades = chargedUpgrades(order).map((key) => ({ key, price: cfg.upgradePrices[key] }));
  const upgradesTotal = upgrades.reduce((sum, u) => sum + u.price, 0);
  return { prize, feePercent, serviceFee: fee, upgrades, upgradesTotal, total: prize + fee + upgradesTotal };
}

/** NDA includes Private (owner, 2026-10-08): Private is switched on and not charged on top. */
export function includedByNda(order: Order, key: UpgradeKey): boolean {
  return key === "private" && Boolean(order.upgrades.nda);
}

/** The add-ons the client pays for, in display order. */
export function chargedUpgrades(order: Order): UpgradeKey[] {
  return UPGRADES.filter((k) => order.upgrades[k] && !includedByNda(order, k));
}

/** The add-ons that will be on: the chosen ones plus Private when NDA is chosen. */
export function activeUpgrades(order: Order): Record<UpgradeKey, boolean> {
  const on = { ...noUpgrades(), ...order.upgrades };
  if (on.nda) on.private = true;
  return on;
}

export function defaultOrder(cfg: PricingConfig): Order {
  return {
    package: "standard",
    customPrize: null,
    durationDays: cfg.defaultDuration,
    upgrades: noUpgrades(),
  };
}
