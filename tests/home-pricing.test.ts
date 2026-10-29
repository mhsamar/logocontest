import { describe, expect, it } from "vitest";
import { cardFor, feeRule, packageCards, payKinds, payStep, payWording } from "@/lib/home/pricing-cards";

// Admin › Pricing as on 2026-10-29: 25%, or 20% for prizes above ৳50,000; 10 free AI checks per contest.
const cfg = {
  serviceFeePercent: 25,
  largeFeePercent: 20,
  largeFeeFrom: 50_000,
  packagePrizes: { economy: 3000, standard: 5000, pro: 8000, premium: 12_000, elite: 15_000 },
};

describe("home pricing cards (owner, 2026-10-29)", () => {
  it("shows Economy, Standard and Premium with each prize's fee, total and free checks", () => {
    expect(packageCards(cfg, 10)).toEqual([
      { key: "economy", prize: 3000, feePercent: 25, fee: 750, total: 3750, checks: 10 },
      { key: "standard", prize: 5000, feePercent: 25, fee: 1250, total: 6250, checks: 10 },
      { key: "premium", prize: 12_000, feePercent: 25, fee: 3000, total: 15_000, checks: 10 },
    ]);
  });

  it("uses the lower fee only above the large-prize threshold", () => {
    expect(cardFor("premium", 60_000, cfg, 10)).toEqual({ key: "premium", prize: 60_000, feePercent: 20, fee: 12_000, total: 72_000, checks: 10 });
    // Exactly at the threshold is not above it.
    expect(cardFor("premium", 50_000, cfg, 10)).toMatchObject({ feePercent: 25, fee: 12_500, total: 62_500 });
  });

  it("gives every card the same checks whatever the prize (owner, 2026-10-29), and none when the setting is 0", () => {
    expect(cardFor("economy", 3500, cfg, 10).checks).toBe(10);
    expect(cardFor("economy", 900, cfg, 10).checks).toBe(10);
    expect(cardFor("standard", 5000, cfg, 0).checks).toBe(0);
  });

  it("states the large-prize rate in the fee rule only when it differs", () => {
    expect(feeRule(cfg)).toEqual({ fee: 25, largeFee: 20, largeFrom: 50_000 });
    expect(feeRule({ ...cfg, largeFeePercent: 25 })).toEqual({ fee: 25, largeFee: null, largeFrom: 50_000 });
  });
});

describe("home pricing: how to pay", () => {
  it("mentions card only while a card method is open", () => {
    expect(payKinds(["bkash_personal"])).toEqual({ bkash: true, card: false, manual: true, auto: false });
    expect(payWording(payKinds(["bkash_personal"]))).toBe("bkash");
    expect(payWording(payKinds(["bkash_merchant", "sslcommerz"]))).toBe("bkashCard");
    // Visitors from abroad: only Stripe.
    expect(payKinds(["stripe"])).toEqual({ bkash: false, card: true, manual: false, auto: true });
    expect(payWording(payKinds(["stripe"]))).toBe("card");
  });

  it("asks for a transaction ID only for manual bKash, and says nothing when no method is open", () => {
    expect(payKinds(["bkash_api"]).manual).toBe(false);
    expect(payWording(payKinds([]))).toBeNull();
    expect(payWording(payKinds(["bangla_qr"]))).toBeNull();
    // After paying: a bKash number alone is approved from the ID; with a card too, both are said (review, 2026-10-29).
    expect(payStep(payKinds(["bkash_personal"]))).toBe("manual");
    expect(payStep(payKinds(["sslcommerz", "bkash_api"]))).toBe("auto");
    expect(payStep(payKinds(["bkash_merchant", "sslcommerz"]))).toBe("mixed");
    expect(payStep(payKinds([]))).toBeNull();
  });
});
