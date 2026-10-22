import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { englishOnlyAlternates, hasBangla, localizedPath } from "@/lib/i18n/url";
import { contestIndexable, robotsUnless } from "@/lib/seo";
import { fillFacts, type SiteFacts } from "@/lib/seo/fill-facts";
import { faqPage, ldJson, organization, sameAsOf, service, website } from "@/lib/seo/jsonld";

/** Search launch (owner, 2026-10-21; SEO-PLAN.md): safe noindex, facts in taka with the fee, structured data. */
const facts: SiteFacts = {
  minPrize: 3000, minTotal: 3750, fee: 25, largeFee: 15, largeFrom: 30000, customStep: 500, defaultDays: 7, minDays: 3, maxDays: 30, judgingDays: 3,   packages: [{ key: "economy", prize: 3000, feePercent: 25, total: 3750 }],
  addonsFreeFrom: 25000, guaranteeOn: false, guaranteeDesigners: 3,
};

describe("search safety", () => {
  it("robotsUnless never sends an empty robots value", () => {
    expect(robotsUnless(true)).toEqual({});
    expect("robots" in robotsUnless(true)).toBe(false);
    expect(robotsUnless(false)).toEqual({ robots: { index: false, follow: true } });
  });

  it("test clients' contests stay out of search engines", () => {
    const live = { status: "open", isPrivate: false, isNda: false };
    expect(contestIndexable(live)).toBe(true);
    expect(contestIndexable({ ...live, clientIsTest: true })).toBe(false);
    expect(contestIndexable({ ...live, isPrivate: true })).toBe(false);
    expect(contestIndexable({ ...live, status: "draft" })).toBe(false);
  });

  it("tells Bangla text from English (a brief in English is offered in English only)", () => {
    expect(hasBangla("আমাদের রেস্টুরেন্টের জন্য একটি আধুনিক লোগো চাই, লাল আর সোনালি রঙে")).toBe(true);
    expect(hasBangla("We need a modern logo for our restaurant in red and gold colours")).toBe(false);
    expect(hasBangla("Logo for Dhaka Bites — ঢাকা বাইটস এর জন্য সুন্দর লোগো, আধুনিক আর সহজ")).toBe(true);
    expect(hasBangla("short")).toBe(false);
    // Short Bangla briefs count too (vowel signs are marks, not letters).
    expect(hasBangla("আমাদের দোকানের জন্য লোগো চাই")).toBe(true);
    expect(hasBangla(null)).toBe(false);
  });
});

describe("facts and addresses", () => {
  beforeEach(() => vi.stubEnv("SITE_URL", "https://logocontest.bd"));
  afterEach(() => vi.unstubAllEnvs());

  it("fills prices in taka with the fee, in each language's digits", () => {
    expect(fillFacts("From {minTotal} ({fee}% fee), {defaultDays} days, {year}", facts, "en", 2026)).toBe("From ৳3,750 (25% fee), 7 days, 2026");
    expect(fillFacts("মোট {minTotal} থেকে ({year})", facts, "bn", 2026)).toBe("মোট ৳৩,৭৫০ থেকে (২০২৬)");
    expect(fillFacts("{unknown} stays", facts, "en", 2026)).toBe("{unknown} stays");
  });

  it("English-only pages point both addresses to the English one", () => {
    expect(englishOnlyAlternates("/contest/x")).toEqual({ canonical: "https://logocontest.bd/contest/x", languages: { en: "https://logocontest.bd/contest/x", "x-default": "https://logocontest.bd/contest/x" } });
    expect(localizedPath("/logo-design-price", "bn")).toBe("/logo-design-price?lang=bn");
  });

  it("a service without a price table on its page carries no offers, and no inLanguage", () => {
    const s = service({ name: "Logo design", description: "d", path: "/logo-design", locale: "en" });
    expect("offers" in s).toBe(false);
    expect("inLanguage" in s).toBe(false);
  });

  it("structured data: one fixed id, only our own profiles, offers at the real total", () => {
    const org = organization({ logo: "https://logocontest.bd/brand/logo-icon.png", phone: "+8801700000000", sameAs: sameAsOf({ "social.facebook": "https://www.facebook.com/logocontest.bd/", "social.facebook_group": "https://www.facebook.com/groups/x", "social.youtube": "" }) });
    expect(org["@id"]).toBe("https://logocontest.bd/#organization");
    expect(org.sameAs).toEqual(["https://www.facebook.com/logocontest.bd/"]);
    expect(website().publisher).toEqual({ "@id": "https://logocontest.bd/#organization" });
    const s = service({ name: "Logo design", description: "d", path: "/logo-design-price", locale: "bn", offers: [{ name: "Starter", total: 3750 }] });
    expect(s.offers?.[0]).toMatchObject({ price: 3750, priceCurrency: "BDT", url: "https://logocontest.bd/logo-design-price?lang=bn" });
    expect(faqPage([{ q: "logo design koto taka?", a: "৳3,750" }], "en").mainEntity).toHaveLength(1);
    expect(ldJson({ x: "</script>" })).not.toContain("</script>");
    expect(JSON.stringify(org)).not.toContain("undefined");
  });
});
