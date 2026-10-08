import { describe, expect, it } from "vitest";
import { cleanBrief, CONTACT_CHECKED_FIELDS, findBriefContact, normalizeUrl, validateBrief, validateBriefStep } from "@/lib/contests/brief";
import { validBrief } from "./fixtures";

describe("wizard validation (BLUEPRINT §8.1)", () => {
  it("accepts a complete brief", () => {
    expect(validateBrief(validBrief())).toEqual({});
  });

  it("C-01: brand name 2–60 characters", () => {
    expect(validateBriefStep(1, { ...validBrief(), brandName: "A" })).toHaveProperty("brandName");
    expect(validateBriefStep(1, { ...validBrief(), brandName: "  " })).toHaveProperty("brandName");
    expect(validateBriefStep(1, { ...validBrief(), brandName: "x".repeat(61) })).toHaveProperty("brandName");
    expect(validateBriefStep(1, { ...validBrief(), brandName: "চা ঘর" })).toEqual({});
  });

  it("C-02: business type from the list, description 20–300", () => {
    expect(validateBriefStep(2, { ...validBrief(), businessType: "" })).toHaveProperty("businessType");
    expect(validateBriefStep(2, { ...validBrief(), businessDescription: "too short" })).toHaveProperty("businessDescription");
    expect(validateBriefStep(2, { ...validBrief(), businessDescription: "x".repeat(301) })).toHaveProperty("businessDescription");
  });

  it("C-03: link is optional but must be valid when given", () => {
    expect(validateBriefStep(3, { ...validBrief(), websiteUrl: "" })).toEqual({});
    expect(validateBriefStep(3, { ...validBrief(), websiteUrl: "facebook.com/rahimtea" })).toEqual({});
    expect(validateBriefStep(3, { ...validBrief(), websiteUrl: "not a link" })).toHaveProperty("websiteUrl");
    expect(validateBriefStep(3, { ...validBrief(), websiteUrl: "not a link", noWebsite: true })).toEqual({});
    expect(normalizeUrl("facebook.com/x")).toBe("https://facebook.com/x");
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
  });

  it("C-04: at least one style", () => {
    expect(validateBriefStep(4, { ...validBrief(), styles: [] })).toHaveProperty("styles");
  });

  it("C-05: up to 5 hex colours, or let designers choose", () => {
    expect(validateBriefStep(5, { ...validBrief(), colors: [] })).toHaveProperty("colors");
    expect(validateBriefStep(5, { ...validBrief(), colors: [], letDesignersChoose: true })).toEqual({});
    expect(validateBriefStep(5, { ...validBrief(), colors: Array(6).fill("#000000") })).toHaveProperty("colors");
    expect(validateBriefStep(5, { ...validBrief(), colors: ["red"] })).toHaveProperty("colors");
  });

  it("C-06: likes at least 30 characters", () => {
    // Likes are no longer asked for (owner, 2026-10-08): empty is fine, only the length cap stays.
    expect(validateBriefStep(6, { ...validBrief(), likes: "" })).toEqual({});
    expect(validateBriefStep(6, { ...validBrief(), likes: "x".repeat(1001) })).toHaveProperty("likes");
  });

  it("cleanBrief trims text and drops colours when designers choose", () => {
    const c = cleanBrief({ ...validBrief(), brandName: "  Rahim  ", letDesignersChoose: true, websiteUrl: "x.com", noWebsite: true });
    expect(c.brandName).toBe("Rahim");
    expect(c.colors).toEqual([]);
    expect(c.websiteUrl).toBe("");
  });
});

describe("brief details (owner, 2026-10-08)", () => {
  it("needs a target audience of 10 to 300 characters", () => {
    expect(validateBriefStep(2, { ...validBrief(), targetAudience: "kids" })).toHaveProperty("targetAudience");
    expect(validateBriefStep(2, { ...validBrief(), targetAudience: "x".repeat(301) })).toHaveProperty("targetAudience");
    expect(validateBriefStep(2, validBrief())).toEqual({});
  });
  it("keeps the short name optional and short", () => {
    expect(validateBriefStep(1, { ...validBrief(), shortName: "" })).toEqual({});
    expect(validateBriefStep(1, { ...validBrief(), shortName: "x".repeat(31) })).toHaveProperty("shortName");
  });
  it("accepts only known extras and requirements", () => {
    expect(validateBriefStep(5, { ...validBrief(), deliverables: ["icon_only", "app_icons"] })).toEqual({});
    expect(validateBriefStep(5, { ...validBrief(), deliverables: ["source_video" as never] })).toHaveProperty("deliverables");
    expect(validateBriefStep(6, { ...validBrief(), requirements: ["home_mockup"] })).toEqual({});
    expect(validateBriefStep(6, { ...validBrief(), requirements: ["anything" as never] })).toHaveProperty("requirements");
    expect(validateBriefStep(6, { ...validBrief(), requirementsNote: "x".repeat(501) })).toHaveProperty("requirementsNote");
  });
  it("cleans the lists into a fixed order without unknown values or repeats", () => {
    const b = cleanBrief({ ...validBrief(), deliverables: ["app_icons", "icon_only", "app_icons", "bad" as never], requirements: ["home_mockup", "no_stock"], shortName: "  LCB  " });
    expect(b.deliverables).toEqual(["icon_only", "app_icons"]);
    expect(b.requirements).toEqual(["no_stock", "home_mockup"]);
    expect(b.shortName).toBe("LCB");
  });
});

describe("brief contact filter (UI-JOURNEY C-06, BLUEPRINT §10)", () => {
  it("passes a normal brief", () => {
    expect(findBriefContact(validBrief(), [])).toBeNull();
  });

  it("names the first field with contact details, in wizard step order", () => {
    expect(findBriefContact({ ...validBrief(), requirementsNote: "Call me on 01712 345 678" }, [])).toBe("requirementsNote");
    expect(findBriefContact({ ...validBrief(), slogan: "inbox us on facebook", targetAudience: "mail me at a@b.com" }, [])).toBe("slogan");
    expect(findBriefContact({ ...validBrief(), businessDescription: "We sell tea at Rahim Corner every evening" }, ["rahim corner"])).toBe("businessDescription");
  });

  it("maps every checked field to a brief step", () => {
    for (const step of Object.values(CONTACT_CHECKED_FIELDS)) expect([1, 2, 3, 4, 5, 6]).toContain(step);
  });
});
