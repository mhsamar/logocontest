import { describe, expect, it } from "vitest";
import { feeRateFor, nextTier, payoutFor } from "@/lib/wallet/fees";
import { SETTINGS } from "@/lib/settings/registry";

const tiers = SETTINGS["fees.designer_tiers"].default;

describe("designer fee tiers (owner, 2026-10-08)", () => {
  it("charges 15% for the first 10 wins, 10% from win 11, 5% from win 51", () => {
    expect(feeRateFor(0, tiers)).toBe(15);
    expect(feeRateFor(9, tiers)).toBe(15);
    expect(feeRateFor(10, tiers)).toBe(10);
    expect(feeRateFor(49, tiers)).toBe(10);
    expect(feeRateFor(50, tiers)).toBe(5);
    expect(feeRateFor(300, tiers)).toBe(5);
  });

  it("shows the next cheaper tier", () => {
    expect(nextTier(3, tiers)).toEqual({ tier: { min_wins: 10, rate_percent: 10 }, winsToGo: 7 });
    expect(nextTier(10, tiers)).toEqual({ tier: { min_wins: 50, rate_percent: 5 }, winsToGo: 40 });
    expect(nextTier(50, tiers)).toBeNull();
  });

  it("pays the prize minus the fee in whole taka", () => {
    expect(payoutFor(5000, 15)).toEqual({ fee: 750, credit: 4250 });
    expect(payoutFor(12000, 10)).toEqual({ fee: 1200, credit: 10800 });
    expect(payoutFor(3333, 15)).toEqual({ fee: 500, credit: 2833 });
  });

  it("follows the tiers in settings, in any order", () => {
    expect(feeRateFor(6, [{ min_wins: 5, rate_percent: 3 }, { min_wins: 0, rate_percent: 8 }])).toBe(3);
  });
});
