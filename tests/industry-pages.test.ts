import { describe, expect, it } from "vitest";
import { INDUSTRY_CONTENT } from "@/lib/landing/content/industries";
import { INDUSTRIES } from "@/lib/landing/industries";
import { isLocalizedPath, localizedPath } from "@/lib/i18n/lang-path";
import { fillFacts, type SiteFacts } from "@/lib/seo/fill-facts";
import { BUSINESS_TYPES } from "@/lib/contests/brief";

/** Logo design by business (owner, 2026-11-03): /logo-design/<slug>, Bangla plain and English under /en. */
const facts: SiteFacts = {
  minPrize: 3000, minTotal: 3750, fee: 25, largeFee: 15, largeFrom: 30000, customStep: 500, defaultDays: 7, minDays: 3, maxDays: 30, judgingDays: 3, packages: [{ key: "economy", prize: 3000, feePercent: 25, total: 3750 }],
  addonsFreeFrom: 25000, guaranteeOn: true, guaranteeDesigners: 3,
};

/** Every string in a page's copy. */
const texts = (v: unknown): string[] => (typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(texts) : v && typeof v === "object" ? Object.values(v).flatMap(texts) : []);

describe("business logo pages", () => {
  it("every business has its words, at its own address, for a real business type", () => {
    for (const i of INDUSTRIES) {
      const c = INDUSTRY_CONTENT[i.slug];
      expect(c.slug).toBe(`logo-design/${i.slug}`);
      expect(BUSINESS_TYPES).toContain(i.type);
      expect(isLocalizedPath(`/logo-design/${i.slug}`)).toBe(true);
      expect(localizedPath(`/logo-design/${i.slug}`, "en")).toBe(`/en/logo-design/${i.slug}`);
    }
  });

  it("titles and descriptions fit search results; every placeholder is a real one; both languages match", () => {
    for (const i of INDUSTRIES) {
      const c = INDUSTRY_CONTENT[i.slug];
      for (const locale of ["en", "bn"] as const) {
        const copy = c[locale];
        const fill = (s: string) => fillFacts(s, facts, locale, 2026);
        expect(fill(copy.title).length, `${i.slug} ${locale} title`).toBeLessThanOrEqual(65);
        expect(fill(copy.description).length, `${i.slug} ${locale} description`).toBeLessThanOrEqual(165);
        expect(copy.examplesHeading).toBeTruthy();
        for (const t of texts(copy)) expect(fill(t), `${i.slug} ${locale}: ${t.slice(0, 60)}`).not.toMatch(/\{[^}]*\}/);
      }
      expect(c.bn.sections.map((s) => s.kind)).toEqual(c.en.sections.map((s) => s.kind));
      expect(c.en.sections.some((s) => s.kind === "faq")).toBe(true);
    }
  });
});

describe("business logo pages are listed", () => {
  it("in the sitemap and in llms.txt", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["src/app/sitemap.ts", "src/app/llms.txt/route.ts"]) expect(readFileSync(f, "utf8")).toContain("INDUSTRIES.map((i) =>");
  });
});
