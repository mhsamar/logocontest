import { describe, expect, it } from "vitest";
import {
  CLIENT_FEE_CHOICES,
  contestAmountsWithFee,
  DESIGNER_FEE_CHOICES,
  feeWithCode,
  gatewayMethod,
  isManual,
  isMethodKey,
  isTxnId,
  legacyMethod,
  normalizeMobile,
  normalizePromo,
  normalizeTxn,
  proPriceWithCode,
  PROMO_CODE,
  qaCodeFrom,
  randomPromoCode,
  showMobile,
} from "@/lib/payments/manual-rules";

const bytes = (...v: number[]) => Uint8Array.from(v);

describe("payment methods (owner, 2026-10-14)", () => {
  it("bKash Personal and Merchant are manual; the bKash API and SSLCommerz are gateways", () => {
    expect(isManual("bkash_personal")).toBe(true);
    expect(isManual("bkash_merchant")).toBe(true);
    expect(isManual("bkash_api")).toBe(false);
    expect(isManual("sslcommerz")).toBe(false);
    expect(isMethodKey("paypal")).toBe(false);
    expect(gatewayMethod("bkash_api")).toBe("bkash");
    expect(gatewayMethod("sslcommerz")).toBe("card");
    expect(legacyMethod("bkash")).toBe("bkash_api");
    expect(legacyMethod("card")).toBe("sslcommerz");
    expect(legacyMethod("bkash_personal")).toBe("bkash_personal");
  });

  it("transaction IDs: spaces and lower case are fixed; 8 to 14 letters and digits", () => {
    expect(normalizeTxn(" 9ab3 cd5-efg ")).toBe("9AB3CD5EFG");
    expect(isTxnId("9AB3CD5EFG")).toBe(true);
    expect(isTxnId("ABC123")).toBe(false);
    expect(isTxnId("9AB3CD5EFG12345")).toBe(false);
    expect(isTxnId("9AB3-CD5EF")).toBe(false);
  });

  it("Bangladesh mobile numbers in any common form", () => {
    expect(normalizeMobile("01677713493")).toBe("+8801677713493");
    expect(normalizeMobile("8801712028511")).toBe("+8801712028511");
    expect(normalizeMobile("+880 1712-028511")).toBe("+8801712028511");
    expect(normalizeMobile("01277713493")).toBeNull();
    expect(normalizeMobile("12345")).toBeNull();
    expect(showMobile("+8801677713493")).toBe("01677-713493");
    expect(showMobile(null)).toBe("");
  });

  it("QA transaction IDs start with QA, are 10 characters and pass as a transaction ID", () => {
    const code = qaCodeFrom(bytes(0, 1, 2, 3, 31, 32, 63, 255));
    expect(code).toMatch(/^QA[A-Z2-9]{8}$/);
    expect(code).toHaveLength(10);
    expect(isTxnId(code)).toBe(true);
    expect(() => qaCodeFrom(bytes(1, 2))).toThrow();
  });
});

describe("promo codes (owner, 2026-10-14)", () => {
  it("client codes set the fee to 20/15/10/5/0%; designer codes to 15/10/5/0%", () => {
    expect([...CLIENT_FEE_CHOICES]).toEqual([20, 15, 10, 5, 0]);
    expect([...DESIGNER_FEE_CHOICES]).toEqual([15, 10, 5, 0]);
  });

  it("a fee code never raises the fee", () => {
    expect(feeWithCode(25, 10)).toBe(10);
    expect(feeWithCode(15, 20)).toBe(15);
    expect(feeWithCode(25, 0)).toBe(0);
  });

  it("the contest total follows the code's fee", () => {
    expect(contestAmountsWithFee({ prize: 5000, upgrades: 500 }, 10)).toEqual({ serviceFee: 500, total: 6000 });
    expect(contestAmountsWithFee({ prize: 5000, upgrades: 0 }, 0)).toEqual({ serviceFee: 0, total: 5000 });
    expect(contestAmountsWithFee({ prize: 3333, upgrades: 0 }, 15)).toEqual({ serviceFee: 500, total: 3833 });
  });

  it("Pro discount: percent off, whole taka, never below zero", () => {
    expect(proPriceWithCode(500, 20)).toBe(400);
    expect(proPriceWithCode(499, 25)).toBe(374);
    expect(proPriceWithCode(500, 100)).toBe(0);
    expect(proPriceWithCode(500, 150)).toBe(0);
    expect(proPriceWithCode(500, -10)).toBe(500);
  });

  it("codes: typed in any case, 4 to 24 capital letters, digits or dashes", () => {
    expect(normalizePromo(" welcome10 ")).toBe("WELCOME10");
    expect(PROMO_CODE.test("WELCOME10")).toBe(true);
    expect(PROMO_CODE.test("EID-7K2M9QXA")).toBe(true);
    expect(PROMO_CODE.test("ABC")).toBe(false);
    expect(PROMO_CODE.test("WELCOME 10")).toBe(false);
  });

  it("random one-time codes: 8 characters after an optional prefix", () => {
    const b = bytes(5, 6, 7, 8, 9, 10, 11, 12);
    expect(randomPromoCode(b)).toMatch(/^[A-Z2-9]{8}$/);
    expect(randomPromoCode(b, "eid!")).toMatch(/^EID-[A-Z2-9]{8}$/);
    expect(PROMO_CODE.test(randomPromoCode(b, "LONGPREFIX99"))).toBe(true);
  });
});
