import { describe, expect, it } from "vitest";
import type { Order } from "@/lib/contests/brief";
import { calculatePrice, serviceFee, validateOrder, type PricingConfig } from "@/lib/contests/pricing";
import { SETTINGS } from "@/lib/settings/registry";

// The config the app builds from the seeded settings defaults.
const cfg: PricingConfig = {
  serviceFeePercent: SETTINGS["fees.client_service_fee_percent"].default,
  packagePrizes: {
    economy: SETTINGS["packages.economy_prize"].default,
    standard: SETTINGS["packages.standard_prize"].default,
    premium: SETTINGS["packages.premium_prize"].default,
  },
  customMin: SETTINGS["packages.custom_min_prize"].default,
  customStep: SETTINGS["packages.custom_step"].default,
  upgradePrices: {
    blind: SETTINGS["upgrades.blind_price"].default,
    private: SETTINGS["upgrades.private_price"].default,
    promoted: SETTINGS["upgrades.promoted_price"].default,
  },
  durationOptions: [...SETTINGS["timers.contest_duration_options_days"].default],
  defaultDuration: SETTINGS["timers.contest_duration_default_days"].default,
};

const order = (over: Partial<Order> = {}): Order => ({
  package: "standard",
  customPrize: null,
  durationDays: 7,
  upgrades: { blind: false, private: false, promoted: false },
  ...over,
});

describe("client price (BLUEPRINT §7.1)", () => {
  it.each([
    ["economy", 3000, 600, 3600],
    ["standard", 5000, 1000, 6000],
    ["premium", 10000, 2000, 12000],
  ] as const)("%s: prize %i + fee %i = %i", (pkg, prize, fee, total) => {
    const p = calculatePrice(order({ package: pkg }), cfg);
    expect(p).toMatchObject({ prize, serviceFee: fee, upgradesTotal: 0, total });
  });

  it("adds each upgrade at its price", () => {
    expect(calculatePrice(order({ upgrades: { blind: true, private: false, promoted: false } }), cfg).total).toBe(7000);
    expect(calculatePrice(order({ upgrades: { blind: false, private: true, promoted: false } }), cfg).total).toBe(7000);
    expect(calculatePrice(order({ upgrades: { blind: false, private: false, promoted: true } }), cfg).total).toBe(7000);
    const all = calculatePrice(order({ package: "premium", upgrades: { blind: true, private: true, promoted: true } }), cfg);
    expect(all).toMatchObject({ prize: 10000, serviceFee: 2000, upgradesTotal: 3000, total: 15000 });
    expect(all.upgrades.map((u) => u.key)).toEqual(["blind", "private", "promoted"]);
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

  it("only accepts durations from settings", () => {
    expect(validateOrder(order({ durationDays: 5 }), cfg)).toBeNull();
    expect(validateOrder(order({ durationDays: 10 }), cfg)).toBeNull();
    expect(validateOrder(order({ durationDays: 6 }), cfg)).toBe("duration");
  });

  it("refuses to price an invalid order", () => {
    expect(() => calculatePrice(order({ package: "custom", customPrize: 100 }), cfg)).toThrow();
  });
});
