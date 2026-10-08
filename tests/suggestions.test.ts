import { describe, expect, it } from "vitest";
import { BUSINESS_TYPES, LIMITS, validateBriefStep, type Brief } from "@/lib/contests/brief";
import { audienceSuggestions, descriptionSuggestions } from "@/lib/contests/suggestions";
import bn from "@/lib/i18n/messages/bn";
import en from "@/lib/i18n/messages/en";
import { createTranslator } from "@/lib/i18n/translate";
import { validBrief } from "./fixtures";

const translators = { en: createTranslator("en", en), bn: createTranslator("bn", bn) };

describe("C-02 suggestions", () => {
  for (const [lang, t] of Object.entries(translators)) {
    for (const type of BUSINESS_TYPES) {
      it(`${lang} · ${type}: five valid suggestions`, () => {
        for (const brandName of ["Rahim Tea House", "x".repeat(LIMITS.brandName.max)]) {
          const brief: Brief = { ...validBrief(), brandName, businessType: type };
          const desc = descriptionSuggestions(brief, t);
          expect(desc).toHaveLength(5);
          // Picking any suggestion must pass the step's validation.
          for (const d of desc) expect(validateBriefStep(2, { ...brief, businessDescription: d })).toEqual({});
          const aud = audienceSuggestions(brief, t);
          expect(aud).toHaveLength(5);
          for (const a of aud) expect(validateBriefStep(2, { ...brief, targetAudience: a })).not.toHaveProperty("targetAudience");
          for (const s of [...desc, ...aud]) expect(s).not.toMatch(/\{\w+\}/);
        }
      });
    }
  }

  it("uses the client's own answers", () => {
    const t = translators.en;
    const brief: Brief = { ...validBrief(), brandName: "Nodi Tea", businessType: "food" };
    expect(descriptionSuggestions(brief, t)[0]).toContain("Nodi Tea");
    expect(descriptionSuggestions(brief, t)[0]).toContain("restaurant");
  });

  it("builds target audiences from the description (owner, 2026-10-08)", () => {
    const t = translators.en;
    const online = audienceSuggestions({ ...validBrief(), businessType: "food", businessDescription: "Homemade pickles from Mirpur, Dhaka, sold on Facebook with home delivery." }, t);
    expect(online[0]).toContain("Dhaka");
    expect(online[0]).toContain("order on Facebook or online");
    const shop = audienceSuggestions({ ...validBrief(), businessType: "beauty", businessDescription: "A beauty salon in Sylhet for brides and working women." }, t);
    expect(shop[0]).toContain("Sylhet");
    expect(shop[0]).toContain("visit our shop");
    expect(shop[2]).toContain("Women aged");
    const nowhere = audienceSuggestions({ ...validBrief(), businessType: "education", businessDescription: "A coaching centre for HSC students." }, t);
    expect(nowhere[0]).toContain("Bangladesh");
    expect(nowhere[1]).toContain("Students");
    expect(audienceSuggestions({ ...validBrief(), businessDescription: "ঢাকার একটি অনলাইন দোকান" }, translators.bn)[0]).toContain("ঢাকা");
  });

  it("falls back gracefully before a business type is chosen", () => {
    const brief: Brief = { ...validBrief(), businessType: "" };
    expect(descriptionSuggestions(brief, translators.en)[0]).toContain("local business");
  });
});
