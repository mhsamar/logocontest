import { describe, expect, it } from "vitest";
import { aiCost, ratesFrom, searchCost, toBdt } from "@/lib/logo-check/costs";

// The default prices in Settings › Logo checker costs (owner, 2026-10-14).
const rates = ratesFrom({ lensCentsPer1000: 400, visionCentsPer1000: 350, aiInCentsPerM: 30, aiOutCentsPerM: 250, usdToBdt: 122 });

describe("Logo checker API cost (owner, 2026-10-14)", () => {
  it("turns the admin's prices (US cents) into USD per call and per token", () => {
    expect(rates.lens).toBeCloseTo(0.004, 10);
    expect(rates.vision).toBeCloseTo(0.0035, 10);
    expect(rates.aiIn).toBeCloseTo(0.3 / 1_000_000, 15);
    expect(rates.aiOut).toBeCloseTo(2.5 / 1_000_000, 15);
  });

  it("prices an AI call from its tokens, and a search only when it ran", () => {
    expect(aiCost({ tokens: { in: 10_000, out: 2_000 } }, rates)).toBeCloseTo(0.003 + 0.005, 10);
    expect(searchCost({ ran: true }, { ran: true }, rates)).toBeCloseTo(0.0075, 10);
    expect(searchCost({ ran: false }, { ran: true }, rates)).toBeCloseTo(0.0035, 10);
  });

  it("shows the cost in taka to the paisa, at the admin's rate", () => {
    expect(toBdt(0.0125, rates)).toBe(1.53);
    expect(toBdt(0.0125, { usdToBdt: 120 })).toBe(1.5);
    expect(toBdt(0, rates)).toBe(0);
  });
});
