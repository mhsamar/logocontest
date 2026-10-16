import { describe, expect, it } from "vitest";
import { bioIdeas } from "@/lib/profile/bio-ideas";
import { createTranslator } from "@/lib/i18n/translate";
import en from "@/lib/i18n/messages/en";
import bn from "@/lib/i18n/messages/bn";

describe("bioIdeas (owner, 2026-10-16)", () => {
  const t = createTranslator("en", en);
  it("starts with bios made from the designer's own skills, tools and years", () => {
    const list = bioIdeas({ name: "Anika Jaman", skills: ["logo", "brand"], tools: ["illustrator"], years: 4, max: 300 }, t, "en");
    expect(list[0]).toContain("4 years");
    expect(list.some((x) => x.includes("Anika here"))).toBe(true);
    expect(list.every((x) => x.length <= 300)).toBe(true);
  });
  it("leaves out what the designer hasn't filled in, and anything too long", () => {
    const list = bioIdeas({ name: "", skills: [], tools: [], years: null, max: 300 }, t, "en");
    expect(list).toHaveLength(5);
    expect(bioIdeas({ name: "A", skills: ["logo"], tools: [], years: 1, max: 60 }, t, "en").every((x) => x.length <= 60)).toBe(true);
  });
  it("works in Bangla", () => {
    expect(bioIdeas({ name: "Anika", skills: ["logo"], tools: [], years: 3, max: 300 }, createTranslator("bn", bn), "bn")[0]).toContain("৩");
  });
});
