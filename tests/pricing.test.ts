import { describe, expect, it } from "vitest";
import { noUpgrades, type Order, type UpgradeKey } from "@/lib/contests/brief";
import { activeUpgrades, calculatePrice, feePercentFor, serviceFee, validateOrder, type PricingConfig } from "@/lib/contests/pricing";
import { SETTINGS } from "@/lib/settings/registry";

// The config the app builds from the seeded settings defaults.
const cfg: PricingConfig = {
  serviceFeePercent: SETTINGS["fees.client_service_fee_percent"].default,
  largeFeePercent: SETTINGS["fees.client_service_fee_large_percent"].default,
  largeFeeFrom: SETTINGS["fees.client_service_fee_large_from"].default,
  packagePrizes: {
    economy: SETTINGS["packages.economy_prize"].default,
    standard: SETTINGS["packages.standard_prize"].default,
    pro: SETTINGS["packages.pro_prize"].default,
    premium: SETTINGS["packages.premium_prize"].default,
    elite: SETTINGS["packages.elite_prize"].default,
  },
  customMin: SETTINGS["packages.custom_min_prize"].default,
  customStep: SETTINGS["packages.custom_step"].default,
  upgradePrices: {
    blind: SETTINGS["upgrades.blind_price"].default,
    private: SETTINGS["upgrades.private_price"].default,
    promoted: SETTINGS["upgrades.promoted_price"].default,
    logo_scan: SETTINGS["upgrades.logo_scan_price"].default,
    highlight: SETTINGS["upgrades.highlight_price"].default,
    urgent: SETTINGS["upgrades.urgent_price"].default,
    nda: SETTINGS["upgrades.nda_price"].default,
  },
  durationOptions: [...SETTINGS["timers.contest_duration_options_days"].default],
  durationMin: SETTINGS["timers.contest_duration_min_days"].default,
  durationMax: SETTINGS["timers.contest_duration_max_days"].default,
  defaultDuration: SETTINGS["timers.contest_duration_default_days"].default,
};

const order = (over: Partial<Order> = {}): Order => ({
  package: "standard",
  customPrize: null,
  durationDays: 7,
  upgrades: noUpgrades(),
  ...over,
});

const withUpgrades = (...keys: UpgradeKey[]) => ({ ...noUpgrades(), ...Object.fromEntries(keys.map((k) => [k, true])) });

describe("client price (BLUEPRINT §7.1)", () => {
  it.each([
    // Owner, 2026-10-08: 25% service fee.
    ["economy", 3000, 750, 3750],
    ["standard", 5000, 1250, 6250],
    ["pro", 8000, 2000, 10000],
    ["premium", 12000, 3000, 15000],
    ["elite", 15000, 3750, 18750],
  ] as const)("%s: prize %i + fee %i = %i", (pkg, prize, fee, total) => {
    const p = calculatePrice(order({ package: pkg }), cfg);
    expect(p).toMatchObject({ prize, serviceFee: fee, upgradesTotal: 0, total });
  });

  it("adds each upgrade at its price", () => {
    expect(calculatePrice(order({ upgrades: withUpgrades("blind") }), cfg).total).toBe(7250);
    expect(calculatePrice(order({ upgrades: withUpgrades("private") }), cfg).total).toBe(7250);
    expect(calculatePrice(order({ upgrades: withUpgrades("promoted") }), cfg).total).toBe(7250);
    expect(calculatePrice(order({ upgrades: withUpgrades("logo_scan") }), cfg).total).toBe(6750);
    expect(calculatePrice(order({ upgrades: withUpgrades("highlight") }), cfg).total).toBe(6750);
    expect(calculatePrice(order({ upgrades: withUpgrades("urgent") }), cfg).total).toBe(6750);
    expect(calculatePrice(order({ upgrades: withUpgrades("nda") }), cfg).total).toBe(7750);
    const some = calculatePrice(order({ package: "premium", upgrades: withUpgrades("blind", "private", "promoted") }), cfg);
    expect(some).toMatchObject({ prize: 12000, serviceFee: 3000, upgradesTotal: 3000, total: 18000 });
    expect(some.upgrades.map((u) => u.key)).toEqual(["promoted", "blind", "private"]);
  });

  it("includes Private with NDA without charging it again (owner, 2026-10-08)", () => {
    const p = calculatePrice(order({ upgrades: withUpgrades("nda", "private") }), cfg);
    expect(p.upgrades.map((u) => u.key)).toEqual(["nda"]);
    expect(p.upgradesTotal).toBe(1500);
    expect(activeUpgrades(order({ upgrades: withUpgrades("nda") })).private).toBe(true);
    expect(activeUpgrades(order({ upgrades: withUpgrades("blind") })).private).toBe(false);
  });

  it("allows any whole number of days from 3 to 30", () => {
    for (const d of [3, 4, 11, 30]) expect(validateOrder(order({ durationDays: d }), cfg)).toBeNull();
    for (const d of [2, 31, 7.5]) expect(validateOrder(order({ durationDays: d }), cfg)).toBe("duration");
  });

  it("prices a custom prize, rounding the fee to whole taka", () => {
    expect(calculatePrice(order({ package: "custom", customPrize: 3500 }), cfg)).toMatchObject({ serviceFee: 875, total: 4375 });
    expect(calculatePrice(order({ package: "custom", customPrize: 7500 }), cfg)).toMatchObject({ serviceFee: 1875, total: 9375 });
    // round(prize × rate) to whole taka, if the step setting ever allows odd prizes
    expect(serviceFee(3333, 20)).toBe(667);
    expect(serviceFee(3332, 20)).toBe(666);
    expect(serviceFee(3002, 25)).toBe(751); // 750.5 rounds up
  });

  it("charges 15% instead of 25% when the prize is above ৳30,000 (owner, 2026-10-08)", () => {
    expect(calculatePrice(order({ package: "custom", customPrize: 30000 }), cfg)).toMatchObject({ feePercent: 25, serviceFee: 7500, total: 37500 });
    expect(calculatePrice(order({ package: "custom", customPrize: 30500 }), cfg)).toMatchObject({ feePercent: 15, serviceFee: 4575, total: 35075 });
    expect(calculatePrice(order({ package: "custom", customPrize: 35000 }), cfg)).toMatchObject({ feePercent: 15, serviceFee: 5250, total: 40250 });
    expect(feePercentFor(30000, cfg)).toBe(25);
    expect(feePercentFor(30001, cfg)).toBe(15);
  });

  it("ignores the custom amount for fixed packages", () => {
    expect(calculatePrice(order({ package: "economy", customPrize: 99999 }), cfg).prize).toBe(3000);
  });

  it("follows settings, not hard-coded numbers", () => {
    const changed = { ...cfg, serviceFeePercent: 20, packagePrizes: { ...cfg.packagePrizes, standard: 8000 } };
    expect(calculatePrice(order(), changed)).toMatchObject({ prize: 8000, serviceFee: 1600, total: 9600 });
  });
});

describe("custom amount and duration validation", () => {
  it.each([
    [3000, null],
    [3500, null],
    [20000, null],
    [2500, "custom_min"],
    [0, "custom_min"],
    [3200, "custom_step"],
    [3499, "custom_step"],
    [null, "custom_missing"],
    [3500.5, "custom_missing"],
  ])("custom %s → %s", (amount, expected) => {
    expect(validateOrder(order({ package: "custom", customPrize: amount }), cfg)).toBe(expected);
  });

  it("only accepts durations within the settings range", () => {
    expect(validateOrder(order({ durationDays: 6 }), cfg)).toBeNull();
    expect(validateOrder(order({ durationDays: 6 }), { ...cfg, durationMin: 7 })).toBe("duration");
    expect(validateOrder(order({ durationDays: 30 }), { ...cfg, durationMax: 21 })).toBe("duration");
  });

  it("refuses to price an invalid order", () => {
    expect(() => calculatePrice(order({ package: "custom", customPrize: 100 }), cfg)).toThrow();
  });
});

describe("AI copyright checker in the order (owner, 2026-10-10)", () => {
  const free = { ...cfg, checkerFreeFrom: 8000 };
  it("is not charged when the prize is at or over the free limit", () => {
    const big = calculatePrice(order({ package: "custom", customPrize: 8000, upgrades: withUpgrades("logo_scan") }), free);
    expect(big.upgrades.map((u) => u.key)).not.toContain("logo_scan");
  });
  it("is charged below the free limit", () => {
    const small = calculatePrice(order({ package: "custom", customPrize: 7000, upgrades: withUpgrades("logo_scan") }), free);
    expect(small.upgrades).toEqual([{ key: "logo_scan", price: cfg.upgradePrices.logo_scan }]);
  });
});
