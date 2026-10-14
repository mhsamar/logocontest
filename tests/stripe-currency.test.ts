import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { BDT, currencyForCountry, formatPrice, formatUsdCents, toUsdCents } from "@/lib/currency/rules";
import { methodCurrency } from "@/lib/payments/manual-rules";
import { sessionPaid, stripeForm, toSession, verifyStripeSignature } from "@/lib/payments/stripe-rules";

describe("US dollar prices for visitors from abroad (owner, 2026-10-14)", () => {
  it("Bangladesh and unknown countries see taka; everyone else sees dollars", () => {
    expect(currencyForCountry("BD")).toBe("BDT");
    expect(currencyForCountry("bd")).toBe("BDT");
    expect(currencyForCountry(null)).toBe("BDT");
    expect(currencyForCountry("US")).toBe("USD");
    expect(currencyForCountry("GB")).toBe("USD");
  });

  it("taka → US cents at the rate, with the markup, never below 50 cents", () => {
    expect(toUsdCents(6100, 122)).toBe(5000);
    expect(toUsdCents(5000, 122)).toBe(4098);
    expect(toUsdCents(6100, 122, 3)).toBe(5150);
    expect(toUsdCents(10, 122)).toBe(50);
    expect(toUsdCents(0, 122)).toBe(0);
  });

  it("shows $41 or $40.98; taka visitors still see ৳", () => {
    expect(formatUsdCents(4100, "en")).toBe("$41");
    expect(formatUsdCents(4098, "en")).toBe("$40.98");
    expect(formatPrice(5000, "en", { code: "USD", rate: 122, markup: 0 })).toBe("$40.98");
    expect(formatPrice(5000, "en", BDT)).toBe("৳5,000");
  });

  it("Stripe is the dollar method; every other method takes taka", () => {
    expect(methodCurrency("stripe")).toBe("USD");
    expect(methodCurrency("bkash_personal")).toBe("BDT");
    expect(methodCurrency("sslcommerz")).toBe("BDT");
  });
});

describe("Stripe webhook and checkout", () => {
  const secret = "whsec_test_123";
  const body = JSON.stringify({ type: "checkout.session.completed" });
  const sign = (t: number, b = body, s = secret) => `t=${t},v1=${createHmac("sha256", s).update(`${t}.${b}`).digest("hex")}`;

  it("accepts Stripe's signature and refuses a wrong, changed or old one", () => {
    const now = 1_800_000_000;
    expect(verifyStripeSignature(body, sign(now), secret, now)).toBe(true);
    expect(verifyStripeSignature(body, sign(now, body, "whsec_other"), secret, now)).toBe(false);
    expect(verifyStripeSignature(`${body} `, sign(now), secret, now)).toBe(false);
    expect(verifyStripeSignature(body, sign(now - 600), secret, now)).toBe(false);
    expect(verifyStripeSignature(body, null, secret, now)).toBe(false);
  });

  it("encodes nested fields the way Stripe's API takes them", () => {
    const f = stripeForm({ mode: "payment", metadata: { payment_id: "p1" }, line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: 4098 } }], skip: undefined });
    expect(f.get("mode")).toBe("payment");
    expect(f.get("metadata[payment_id]")).toBe("p1");
    expect(f.get("line_items[0][price_data][unit_amount]")).toBe("4098");
    expect(f.has("skip")).toBe(false);
  });

  it("a session paid in the payer's own currency is checked against the dollars we asked for", () => {
    const s = toSession({ id: "cs_2", status: "complete", payment_status: "paid", amount_total: 52634, currency: "bdt", currency_conversion: { source_currency: "usd", amount_total: 410 }, metadata: { payment_id: "p2", kind: "pro" } });
    expect(sessionPaid(s, 410)).toBe(true);
  });

  it("a session counts as paid only for exactly the dollars we asked for", () => {
    const s = toSession({ id: "cs_1", status: "complete", payment_status: "paid", amount_total: 4098, currency: "usd", payment_intent: "pi_1", metadata: { payment_id: "p1", kind: "contest" } });
    expect(s.paymentId).toBe("p1");
    expect(s.kind).toBe("contest");
    expect(sessionPaid(s, 4098)).toBe(true);
    expect(sessionPaid(s, 4100)).toBe(false);
    expect(sessionPaid({ ...s, paymentStatus: "unpaid" }, 4098)).toBe(false);
    expect(sessionPaid({ ...s, currency: "eur" }, 4098)).toBe(false);
  });
});
