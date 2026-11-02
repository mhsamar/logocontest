import { describe, expect, it } from "vitest";
import { addSuggestion, feedbackSuggestions, feedbackTone } from "@/lib/handover/feedback-suggestions";
import en from "@/lib/i18n/messages/en";
import bn from "@/lib/i18n/messages/bn";

const ctx = { brand: "MyAdvocate", business: "Legal", style: "Modern" };
const get = (msgs: unknown, key: string) => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], msgs);

describe("approval feedback suggestions", () => {
  it("follows the rating", () => {
    expect([0, 1, 2, 3, 4, 5].map(feedbackTone)).toEqual(["high", "low", "low", "mid", "high", "high"]);
    expect(feedbackSuggestions(5, ctx)[0].key).toBe("handover.review.suggest.high.fitsBrand");
    expect(feedbackSuggestions(3, ctx)[0].key).toBe("handover.review.suggest.mid.goodBrand");
    expect(feedbackSuggestions(1, ctx)[0].key).toBe("handover.review.suggest.low.notQuite");
  });

  it("leaves out lines whose detail the brief lacks, and shows at most four", () => {
    const keys = feedbackSuggestions(5, { brand: "X", business: null, style: null }).map((s) => s.key);
    expect(keys).not.toContain("handover.review.suggest.high.business");
    expect(keys).not.toContain("handover.review.suggest.high.style");
    expect(feedbackSuggestions(5, ctx)).toHaveLength(4);
  });

  it("has every line in English and Bangla", () => {
    for (const stars of [1, 3, 5])
      for (const s of feedbackSuggestions(stars, ctx, 10)) {
        expect(typeof get(en, s.key)).toBe("string");
        expect(typeof get(bn, s.key)).toBe("string");
      }
  });

  it("adds a line once, after the text already there", () => {
    expect(addSuggestion("", "Great.")).toBe("Great.");
    expect(addSuggestion("Thanks. ", "Great.")).toBe("Thanks. Great.");
    expect(addSuggestion("Thanks. Great.", "Great.")).toBe("Thanks. Great.");
  });
});
