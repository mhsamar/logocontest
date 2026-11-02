import { describe, expect, it } from "vitest";
import { DEFAULT_PRO_SETTINGS, planPrice, priceQuote, proMonthsOf, PRO_PLANS } from "@/lib/pro/rules";

// Owner, 2026-11-02: Pro for 1 month (৳199, renewed each month), 6 months (৳1000) or 12 months (৳1500) at once.

const s = { ...DEFAULT_PRO_SETTINGS, priceBdt: 199, price6Bdt: 1000, price12Bdt: 1500, offerEnabled: true, offerPriceBdt: 99, promoCode: "HALF", promoPriceBdt: 100, trialDays: 7 };

describe("Pro plans", () => {
  it("three plans, monthly by default and for anything unknown", () => {
    expect(PRO_PLANS).toEqual([1, 6, 12]);
    expect([proMonthsOf("6"), proMonthsOf(12), proMonthsOf("3"), proMonthsOf(undefined), proMonthsOf("x")]).toEqual([6, 12, 1, 1, 1]);
    expect([planPrice(s, 1), planPrice(s, 6), planPrice(s, 12)]).toEqual([199, 1000, 1500]);
  });

  it("6 and 12 months cost their own price; the monthly plan's trial, offer and promo price stay monthly", () => {
    expect(priceQuote(s, { firstTime: true, months: 6 })).toEqual({ amount: 1000, list: 1000, reason: "list", trialDays: 0 });
    expect(priceQuote(s, { firstTime: false, promo: "HALF", months: 12 })).toEqual({ amount: 1500, list: 1500, reason: "list", trialDays: 0 });
    expect(priceQuote(s, { firstTime: true, months: 1 }).reason).toBe("trial");
    expect(priceQuote(s, { firstTime: false, promo: "HALF" })).toMatchObject({ amount: 100, reason: "promo" });
  });
});
