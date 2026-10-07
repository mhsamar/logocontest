import { describe, expect, it } from "vitest";
import { cleanBrief, normalizeUrl, validateBrief, validateBriefStep } from "@/lib/contests/brief";
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
    expect(validateBriefStep(6, { ...validBrief(), likes: "short" })).toHaveProperty("likes");
  });

  it("cleanBrief trims text and drops colours when designers choose", () => {
    const c = cleanBrief({ ...validBrief(), brandName: "  Rahim  ", letDesignersChoose: true, websiteUrl: "x.com", noWebsite: true });
    expect(c.brandName).toBe("Rahim");
    expect(c.colors).toEqual([]);
    expect(c.websiteUrl).toBe("");
  });
});
