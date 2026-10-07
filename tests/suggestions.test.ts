import { describe, expect, it } from "vitest";
import { BUSINESS_TYPES, LIMITS, validateBriefStep, type Brief } from "@/lib/contests/brief";
import { descriptionSuggestions, dislikesSuggestions, likesSuggestions } from "@/lib/contests/suggestions";
import bn from "@/lib/i18n/messages/bn";
import en from "@/lib/i18n/messages/en";
import { createTranslator } from "@/lib/i18n/translate";
import { validBrief } from "./fixtures";

const translators = { en: createTranslator("en", en), bn: createTranslator("bn", bn) };

describe("C-02 / C-06 suggestions", () => {
  for (const [lang, t] of Object.entries(translators)) {
    for (const type of BUSINESS_TYPES) {
      it(`${lang} · ${type}: five valid suggestions per box`, () => {
        for (const brandName of ["Rahim Tea House", "x".repeat(LIMITS.brandName.max)]) {
          const brief: Brief = { ...validBrief(), brandName, businessType: type };
          const desc = descriptionSuggestions(brief, t);
          const likes = likesSuggestions(brief, t);
          const dislikes = dislikesSuggestions(brief, t);
          expect(desc).toHaveLength(5);
          expect(likes).toHaveLength(5);
          expect(dislikes).toHaveLength(5);
          // Picking any suggestion must pass the step's validation.
          for (const d of desc) expect(validateBriefStep(2, { ...brief, businessDescription: d })).toEqual({});
          for (const l of likes) expect(validateBriefStep(6, { ...brief, likes: l })).toEqual({});
          for (const s of [...desc, ...likes, ...dislikes]) expect(s).not.toMatch(/\{\w+\}/);
        }
      });
    }
  }

  it("uses the client's own answers", () => {
    const t = translators.en;
    const brief: Brief = { ...validBrief(), brandName: "Nodi Tea", businessType: "food", colors: ["#8b0000"], usedOn: ["signboard"] };
    expect(descriptionSuggestions(brief, t)[0]).toContain("Nodi Tea");
    expect(descriptionSuggestions(brief, t)[0]).toContain("restaurant");
    const likes = likesSuggestions(brief, t);
    expect(likes.join(" ")).toContain("#8B0000");
    expect(likes.join(" ")).toContain("Signboard");
  });

  it("falls back gracefully before a business type is chosen", () => {
    const brief: Brief = { ...validBrief(), businessType: "" };
    expect(descriptionSuggestions(brief, translators.en)[0]).toContain("local business");
  });
});
