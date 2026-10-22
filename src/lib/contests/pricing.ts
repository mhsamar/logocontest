/**
 * Client charge (BLUEPRINT §7.1):
 *   service_fee = round(prize × fee%), fee% = the normal rate, or the lower rate when the prize is above a threshold
 *   total       = prize + service_fee + upgrades (every add-on is free from a prize threshold; owner, 2026-10-22)
 * All amounts are whole taka. Every number comes from settings (Admin › Pricing).
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
  /** The AI copyright checker (add-on key `logo_scan`) is free from this prize (owner, 2026-10-10). */
  checkerFreeFrom?: number;
  /** Every add-on is free with a prize of at least this (owner, 2026-10-22); 0 or missing = never. Extra days stay paid. */
  addonsFreeFrom?: number;
  /** "Best results from" note on the prize step (owner, 2026-10-16); 0 or missing = no note. */
  bestResultsFrom?: number;
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
  /** The chosen add-ons that cost nothing because of the prize (owner, 2026-10-22). */
  freeUpgrades: UpgradeKey[];
  /** This prize makes every add-on free. */
  addonsFree: boolean;
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

/** Every add-on is free with this prize (owner, 2026-10-22: from ৳25,000, Admin › Pricing; 0 = never). */
export function addonsFreeFor(prize: number, cfg: Pick<PricingConfig, "addonsFreeFrom">): boolean {
  const from = cfg.addonsFreeFrom ?? 0;
  return from > 0 && prize >= from;
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

export function prizeFor(order: Order, cfg: Pick<PricingConfig, "packagePrizes">): number {
  return order.package === "custom" ? (order.customPrize ?? 0) : cfg.packagePrizes[order.package];
}

/** Price breakdown. Throws on an invalid order — call validateOrder first in UI code. */
export function calculatePrice(order: Order, cfg: PricingConfig): Price {
  const error = validateOrder(order, cfg);
  if (error) throw new Error(`Invalid order: ${error}`);
  const prize = prizeFor(order, cfg);
  const feePercent = feePercentFor(prize, cfg);
  const fee = serviceFee(prize, feePercent);
  const addonsFree = addonsFreeFor(prize, cfg);
  const chosen = chosenUpgrades(order, cfg);
  const upgrades = addonsFree ? [] : chosen.map((key) => ({ key, price: cfg.upgradePrices[key] }));
  const upgradesTotal = upgrades.reduce((sum, u) => sum + u.price, 0);
  return { prize, feePercent, serviceFee: fee, upgrades, freeUpgrades: addonsFree ? chosen : [], addonsFree, upgradesTotal, total: prize + fee + upgradesTotal };
}

/** NDA includes Private (owner, 2026-10-08): Private is switched on and not charged on top. */
export function includedByNda(order: Order, key: UpgradeKey): boolean {
  return key === "private" && Boolean(order.upgrades.nda);
}

/** The AI copyright checker comes with prizes at or over the free limit (owner, 2026-10-10). */
export function includedByPrize(order: Order, key: UpgradeKey, cfg?: Pick<PricingConfig, "checkerFreeFrom" | "packagePrizes">): boolean {
  if (key !== "logo_scan" || cfg?.checkerFreeFrom === undefined) return false;
  const prize = order.package === "custom" ? (order.customPrize ?? 0) : cfg.packagePrizes[order.package];
  return prize >= cfg.checkerFreeFrom;
}

/** The add-ons the client chose that have a price of their own, in display order. */
export function chosenUpgrades(order: Order, cfg?: Pick<PricingConfig, "checkerFreeFrom" | "packagePrizes">): UpgradeKey[] {
  // The AI logo checker is never charged (owner, 2026-10-14), even on an older draft that has it ticked.
  return UPGRADES.filter((k) => k !== "logo_scan" && order.upgrades[k] && !includedByNda(order, k) && !includedByPrize(order, k, cfg));
}

/** The add-ons the client pays for, in display order: none when the prize makes every add-on free. */
export function chargedUpgrades(order: Order, cfg?: Pick<PricingConfig, "checkerFreeFrom" | "packagePrizes" | "addonsFreeFrom">): UpgradeKey[] {
  if (cfg && addonsFreeFor(prizeFor(order, cfg), cfg)) return [];
  return chosenUpgrades(order, cfg);
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
