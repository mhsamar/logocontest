import { describe, expect, it } from "vitest";
import { ADMIN_AREAS, PRESETS } from "@/lib/admin/permissions";
import { PRICING_KEYS, PRICING_SECTIONS, tiersProblem } from "@/lib/admin/pricing-keys";
import { fillFacts, type SiteFacts } from "@/lib/seo/fill-facts";
import { SETTINGS, type SettingKey } from "@/lib/settings/registry";
import en from "@/lib/i18n/messages/en";

// Admin › Pricing & fees (owner, 2026-10-22; A-28).

describe("the pricing page", () => {
  it("saves each section as one settings group (saveSettings writes one group at a time)", () => {
    for (const s of PRICING_SECTIONS) for (const k of s.keys) expect(SETTINGS[k as SettingKey].group).toBe(s.group);
  });

  it("covers every fee, package and add-on price", () => {
    const priced = (Object.keys(SETTINGS) as SettingKey[]).filter((k) => /^(fees\.|packages\.|upgrades\.(?!logo_scan_price|logo_check_free_from))/.test(k));
    for (const k of priced) expect(PRICING_KEYS.has(k), k).toBe(true);
    expect(PRICING_KEYS.has("guarantee.enabled")).toBe(false);
  });

  it("has a plain name for every field, and its own permission (view-only for Managers)", () => {
    const names = Object.keys(en.admin.pricing.fields);
    expect(names.length).toBe(PRICING_KEYS.size - 1); // the designer fee rows have their own editor
    expect(ADMIN_AREAS.pricing).toEqual({ manage: true });
    expect(PRESETS.manager).toContain("pricing.view");
    expect(PRESETS.manager).not.toContain("pricing.manage");
  });

  it("refuses designer fee rows that don't start at 0 wins or don't go up", () => {
    expect(tiersProblem([{ min_wins: 0, rate_percent: 15 }, { min_wins: 10, rate_percent: 10 }])).toBeNull();
    expect(tiersProblem([])).toBe("empty");
    expect(tiersProblem([{ min_wins: 1, rate_percent: 15 }])).toBe("start");
    expect(tiersProblem([{ min_wins: 0, rate_percent: 15 }, { min_wins: 0, rate_percent: 10 }])).toBe("order");
    expect(tiersProblem([{ min_wins: 0, rate_percent: 15 }, { min_wins: 20, rate_percent: 10 }, { min_wins: 10, rate_percent: 5 }])).toBe("order");
  });
});

describe("texts follow the free add-ons rule", () => {
  const facts: SiteFacts = { minPrize: 3000, minTotal: 3750, fee: 25, largeFee: 20, largeFrom: 50000, customStep: 500, defaultDays: 7, minDays: 3, maxDays: 30, judgingDays: 3, packages: [], addonsFreeFrom: 25000, guaranteeOn: false, guaranteeDesigners: 3 };
  const text = "Add-ons cost extra{?a:, except that every add-on is free with a prize of {addonsFreeFrom} or more}{!a: (always)}.";

  it("shows the free line only while add-ons are free from a prize", () => {
    expect(fillFacts(text, facts, "en", 2026)).toBe("Add-ons cost extra, except that every add-on is free with a prize of ৳25,000 or more.");
    expect(fillFacts(text, { ...facts, addonsFreeFrom: 0 }, "en", 2026)).toBe("Add-ons cost extra (always).");
    expect(fillFacts("{addonsFreeFrom}", facts, "bn", 2026)).toBe("৳২৫,০০০");
  });
});
