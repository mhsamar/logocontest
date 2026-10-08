import { describe, expect, it } from "vitest";
import { noUpgrades, type Order, type UpgradeKey } from "@/lib/contests/brief";
import { activeUpgrades, calculatePrice, serviceFee, validateOrder, type PricingConfig } from "@/lib/contests/pricing";
import { SETTINGS } from "@/lib/settings/registry";

// The config the app builds from the seeded settings defaults.
const cfg: PricingConfig = {
  serviceFeePercent: SETTINGS["fees.client_service_fee_percent"].default,
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
    ["economy", 3000, 600, 3600],
    ["standard", 5000, 1000, 6000],
    ["pro", 8000, 1600, 9600],
    ["premium", 12000, 2400, 14400],
    ["elite", 15000, 3000, 18000],
  ] as const)("%s: prize %i + fee %i = %i", (pkg, prize, fee, total) => {
    const p = calculatePrice(order({ package: pkg }), cfg);
    expect(p).toMatchObject({ prize, serviceFee: fee, upgradesTotal: 0, total });
  });

  it("adds each upgrade at its price", () => {
    expect(calculatePrice(order({ upgrades: withUpgrades("blind") }), cfg).total).toBe(7000);
    expect(calculatePrice(order({ upgrades: withUpgrades("private") }), cfg).total).toBe(7000);
    expect(calculatePrice(order({ upgrades: withUpgrades("promoted") }), cfg).total).toBe(7000);
    expect(calculatePrice(order({ upgrades: withUpgrades("logo_scan") }), cfg).total).toBe(6500);
    expect(calculatePrice(order({ upgrades: withUpgrades("highlight") }), cfg).total).toBe(6500);
    expect(calculatePrice(order({ upgrades: withUpgrades("urgent") }), cfg).total).toBe(6500);
    expect(calculatePrice(order({ upgrades: withUpgrades("nda") }), cfg).total).toBe(7500);
    const some = calculatePrice(order({ package: "premium", upgrades: withUpgrades("blind", "private", "promoted") }), cfg);
    expect(some).toMatchObject({ prize: 12000, serviceFee: 2400, upgradesTotal: 3000, total: 17400 });
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
    expect(calculatePrice(order({ package: "custom", customPrize: 3500 }), cfg)).toMatchObject({ serviceFee: 700, total: 4200 });
    expect(calculatePrice(order({ package: "custom", customPrize: 7500 }), cfg)).toMatchObject({ serviceFee: 1500, total: 9000 });
    // round(prize × 0.20) to whole taka, if the step setting ever allows odd prizes
    expect(serviceFee(3333, 20)).toBe(667);
    expect(serviceFee(3332, 20)).toBe(666);
    expect(serviceFee(3002, 25)).toBe(751); // 750.5 rounds up
  });

  it("ignores the custom amount for fixed packages", () => {
    expect(calculatePrice(order({ package: "economy", customPrize: 99999 }), cfg).prize).toBe(3000);
  });

  it("follows settings, not hard-coded numbers", () => {
    const changed = { ...cfg, serviceFeePercent: 25, packagePrizes: { ...cfg.packagePrizes, standard: 8000 } };
    expect(calculatePrice(order(), changed)).toMatchObject({ prize: 8000, serviceFee: 2000, total: 10000 });
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
