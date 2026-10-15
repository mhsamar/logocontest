import { describe, expect, it } from "vitest";
import { briefLinks, cleanBrief, linkKindOf, normalizeUrl, REQUIREMENTS, validateBrief, validateBriefStep, WIZARD_STEPS as S } from "@/lib/contests/brief";
import { validBrief } from "./fixtures";

describe("wizard validation (BLUEPRINT §8.1)", () => {
  it("accepts a complete brief", () => {
    expect(validateBrief(validBrief())).toEqual({});
  });

  it("C-01: brand name 2–60 characters", () => {
    expect(validateBriefStep(S.logo, { ...validBrief(), brandName: "A" })).toHaveProperty("brandName");
    expect(validateBriefStep(S.logo, { ...validBrief(), brandName: "  " })).toHaveProperty("brandName");
    expect(validateBriefStep(S.logo, { ...validBrief(), brandName: "x".repeat(61) })).toHaveProperty("brandName");
    expect(validateBriefStep(S.logo, { ...validBrief(), brandName: "চা ঘর" })).toEqual({});
  });

  it("C-02: business type from the list, description 20–300", () => {
    expect(validateBriefStep(S.business, { ...validBrief(), businessType: "" })).toHaveProperty("businessType");
    expect(validateBriefStep(S.business, { ...validBrief(), businessDescription: "too short" })).toHaveProperty("businessDescription");
    expect(validateBriefStep(S.business, { ...validBrief(), businessDescription: "x".repeat(301) })).toHaveProperty("businessDescription");
  });

  it("links: optional, each must be a real address; competitors optional (owner, 2026-10-15)", () => {
    expect(validateBriefStep(S.links, { ...validBrief(), links: [] })).toEqual({});
    expect(validateBriefStep(S.links, { ...validBrief(), links: [{ kind: "facebook", url: "facebook.com/rahimtea" }] })).toEqual({});
    expect(validateBriefStep(S.links, { ...validBrief(), links: [{ kind: "website", url: "not a link" }] })).toHaveProperty("links");
    expect(validateBriefStep(S.links, { ...validBrief(), links: [{ kind: "website", url: "not a link" }], noLinks: true })).toEqual({});
    expect(validateBriefStep(S.links, { ...validBrief(), links: Array(5).fill({ kind: "website", url: "a.com" }) })).toHaveProperty("links");
    expect(validateBriefStep(S.links, { ...validBrief(), links: [{ kind: "myspace" as never, url: "a.com" }] })).toHaveProperty("links");
    expect(validateBriefStep(S.links, { ...validBrief(), competitors: "x".repeat(301) })).toHaveProperty("competitors");
    expect(validateBriefStep(S.links, { ...validBrief(), competitors: "x".repeat(301), noCompetitors: true })).toEqual({});
    expect(normalizeUrl("facebook.com/x")).toBe("https://facebook.com/x");
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(linkKindOf("https://www.facebook.com/rahimtea")).toBe("facebook");
    expect(linkKindOf("instagram.com/x")).toBe("instagram");
    expect(linkKindOf("tiktok.com/@x")).toBe("tiktok");
    expect(linkKindOf("behealthy.bd")).toBe("website");
  });

  it('"Other" business type needs the type written in', () => {
    expect(validateBriefStep(S.business, { ...validBrief(), businessType: "other", businessTypeOther: "" })).toHaveProperty("businessTypeOther");
    expect(validateBriefStep(S.business, { ...validBrief(), businessType: "other", businessTypeOther: "Printing shop" })).toEqual({});
    expect(validateBriefStep(S.business, { ...validBrief(), businessType: "food", businessTypeOther: "" })).toEqual({});
  });

  it("C-04: at least one style", () => {
    expect(validateBriefStep(S.look, { ...validBrief(), styles: [] })).toHaveProperty("styles");
  });

  it("C-05: up to 5 hex colours, or let designers choose", () => {
    expect(validateBriefStep(S.look, { ...validBrief(), colors: [] })).toHaveProperty("colors");
    expect(validateBriefStep(S.look, { ...validBrief(), colors: [], letDesignersChoose: true })).toEqual({});
    expect(validateBriefStep(S.look, { ...validBrief(), colors: Array(6).fill("#000000") })).toHaveProperty("colors");
    expect(validateBriefStep(S.look, { ...validBrief(), colors: ["red"] })).toHaveProperty("colors");
  });

  it("C-06: likes at least 30 characters", () => {
    // Likes are no longer asked for (owner, 2026-10-08): empty is fine, only the length cap stays.
    expect(validateBriefStep(S.needs, { ...validBrief(), likes: "" })).toEqual({});
    expect(validateBriefStep(S.needs, { ...validBrief(), likes: "x".repeat(1001) })).toHaveProperty("likes");
  });

  it("cleanBrief trims text, keeps real links and drops what isn't asked", () => {
    const c = cleanBrief({ ...validBrief(), brandName: "  Rahim  ", letDesignersChoose: true, links: [{ kind: "website", url: "x.com" }], noLinks: true });
    expect(c.brandName).toBe("Rahim");
    expect(c.colors).toEqual([]);
    expect(c.links).toEqual([]);
    expect(c.websiteUrl).toBe("");
    const d = cleanBrief({ ...validBrief(), links: [{ kind: "facebook", url: "facebook.com/rahim" }, { kind: "website", url: "rahimtea.com.bd" }, { kind: "website", url: "" }], businessType: "food", businessTypeOther: "ignored", competitors: "  Tea Town  " });
    expect(d.links).toEqual([{ kind: "facebook", url: "https://facebook.com/rahim" }, { kind: "website", url: "https://rahimtea.com.bd/" }]);
    // The website (not the Facebook page) is the one kept for the logo checker.
    expect(d.websiteUrl).toBe("https://rahimtea.com.bd/");
    expect(d.businessTypeOther).toBe("");
    expect(d.competitors).toBe("Tea Town");
    expect(cleanBrief({ ...validBrief(), competitors: "Tea Town", noCompetitors: true }).competitors).toBe("");
  });

  it("older drafts with one website address still show it as a link", () => {
    expect(briefLinks({ links: [], websiteUrl: "facebook.com/rahim", noWebsite: false })).toEqual([{ kind: "facebook", url: "facebook.com/rahim" }]);
    expect(briefLinks({ links: [], websiteUrl: "", noWebsite: true })).toEqual([]);
  });
});

describe("brief details (owner, 2026-10-08)", () => {
  it("needs a target audience of 10 to 300 characters", () => {
    expect(validateBriefStep(S.business, { ...validBrief(), targetAudience: "kids" })).toHaveProperty("targetAudience");
    expect(validateBriefStep(S.business, { ...validBrief(), targetAudience: "x".repeat(301) })).toHaveProperty("targetAudience");
    expect(validateBriefStep(S.business, validBrief())).toEqual({});
  });
  it("keeps the short name optional and short", () => {
    expect(validateBriefStep(S.logo, { ...validBrief(), shortName: "" })).toEqual({});
    expect(validateBriefStep(S.logo, { ...validBrief(), shortName: "x".repeat(31) })).toHaveProperty("shortName");
  });
  it("accepts only known extras and requirements", () => {
    expect(validateBriefStep(S.needs, { ...validBrief(), deliverables: ["icon_only", "app_icons"] })).toEqual({});
    expect(validateBriefStep(S.needs, { ...validBrief(), deliverables: ["source_video" as never] })).toHaveProperty("deliverables");
    expect(validateBriefStep(S.needs, { ...validBrief(), requirements: ["home_mockup"] })).toEqual({});
    expect(validateBriefStep(S.needs, { ...validBrief(), requirements: ["anything" as never] })).toHaveProperty("requirements");
    expect(validateBriefStep(S.needs, { ...validBrief(), requirementsNote: "x".repeat(501) })).toHaveProperty("requirementsNote");
  });
  it("cleans the lists into a fixed order without unknown values or repeats", () => {
    const b = cleanBrief({ ...validBrief(), deliverables: ["app_icons", "icon_only", "app_icons", "bad" as never], requirements: ["home_mockup", "no_stock"], shortName: "  LCB  " });
    expect(b.deliverables).toEqual(["icon_only", "app_icons"]);
    expect(b.requirements).toEqual(["no_stock", "home_mockup"]);
    // The design tick-boxes (owner, 2026-10-15) come first.
    expect(cleanBrief({ ...validBrief(), requirements: ["home_mockup", "trust", "one_colour"] }).requirements).toEqual(["trust", "one_colour", "home_mockup"]);
    expect(REQUIREMENTS).toEqual(["trust", "simple", "no_effects", "strong_idea", "readable_small", "one_colour", "no_stock", "home_mockup"]);
    expect(b.shortName).toBe("LCB");
  });
});

describe("the wizard's 8 steps (owner, 2026-10-15)", () => {
  it("are numbered in order, with the brief on steps 2 to 6", () => {
    expect(S).toEqual({ you: 1, logo: 2, business: 3, links: 4, look: 5, needs: 6, prize: 7, review: 8 });
    // Each brief check belongs to exactly one step.
    expect(Object.keys(validateBriefStep(S.you, { ...validBrief(), brandName: "" }))).toEqual([]);
    expect(Object.keys(validateBriefStep(S.prize, { ...validBrief(), brandName: "" }))).toEqual([]);
  });
});
