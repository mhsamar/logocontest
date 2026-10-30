import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { cleanBrief, emptyBrief, validateBrief, validateBriefV2, type Brief } from "@/lib/contests/brief";
import { applyDefaults, BRIEF_SECTIONS, newCompletion, sectionsChanged, SEED } from "@/lib/onboarding/brief-defaults";
import { hasBangla } from "@/lib/i18n/url";
import en from "@/lib/i18n/messages/en";
import bn from "@/lib/i18n/messages/bn";

vi.mock("server-only", () => ({}));
const { briefLanguageText, defaultSections } = await import("@/lib/contests/browse");

// Onboarding v2 Phase B (owner, 2026-10-29; client-onboarding-v2-spec.md §3): designers see a "Brief: default" tag on
// the parts the client didn't change, an empty description shows nothing, and Edit details works on a v2 contest.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("which brief parts are still defaults", () => {
  it("every part of a fresh v2 brief; the parts the client changed are theirs", () => {
    expect(defaultSections(newCompletion())).toEqual([...BRIEF_SECTIONS]);
    expect(defaultSections({ v: 2, edited: ["look"], acceptedAt: null })).toEqual(["business", "links", "needs"]);
    expect(defaultSections({ v: 2, edited: [...BRIEF_SECTIONS], acceptedAt: null })).toEqual([]);
  });

  it("none for an old wizard's contest, or once the client kept the brief as it is", () => {
    expect(defaultSections(null)).toEqual([]);
    expect(defaultSections({ v: 2, edited: [], acceptedAt: "2026-10-29T08:00:00Z" })).toEqual([]);
  });

  it("the contest page reads the mark with the brief, and still opens before migration 0079", () => {
    const b = read("src/lib/contests/browse.ts");
    expect(b).toContain("`${columns}, brief_completion`");
    expect(b).toContain('if (error && MISSING_COLUMN.test(error.code ?? "")) ({ data, error } = await read(false));');
    expect(b).toContain("defaults: defaultSections(parseCompletion(data.brief_completion)),");
  });
});

describe("designers' tag", () => {
  const c = read("src/components/contests/contest-brief.tsx");
  it("each block carries its part's tag (About for the business or its links)", () => {
    expect(c).toContain('tag={tagFor("business", "links")}');
    for (const block of ["styles", "colors"]) expect(c).toContain(`<Block title={t("contest.brief.${block}")} tag={tagFor("look")}>`);
    // A v2 client isn't asked for the feel: always the default for designers (owner, 2026-10-30).
    expect(c).toContain('<Block title={t("contest.brief.feel")} tag={brief.v2 && !withDescription ? tag : tagFor("look")}>');
    for (const block of ["usedOn", "needs", "requirements"]) expect(c).toContain(`<Block title={t("contest.brief.${block}")} tag={tagFor("needs")}>`);
    expect(c).toContain('{ label: t("wizardV2.tag.label"), hint: t("wizardV2.tag.hint") }');
  });

  it("is only shown where the page asks for it (the client's own page passes none)", () => {
    expect(c).toContain("defaults = [],");
    expect(c).toContain("defaults?: readonly BriefSection[];");
    expect(read("src/app/contest/[slug]/page.tsx")).toContain("defaults={contest.brief.defaults} />");
  });

  it("has its words in both languages", () => {
    for (const m of [en, bn]) {
      expect(m.wizardV2.tag.label).toBeTruthy();
      expect(m.wizardV2.tag.hint).toBeTruthy();
    }
  });
});

describe("an empty description", () => {
  it("leaves no empty paragraph on the contest page or the browse card", () => {
    expect(read("src/app/contest/[slug]/page.tsx")).toContain("contest.brief.description.trim() ? <p");
    expect(read("src/components/contests/browse-cards.tsx")).toContain("{hidden || c.description ? <p");
    // The list row already left it out.
    expect(read("src/components/contests/contest-row.tsx")).toContain("{contest.description && <p");
  });

  it("the language then comes from the name, slogan and customers", () => {
    expect(briefLanguageText({ description: "  Tea for families  ", brandName: "রহিম চা", slogan: null, targetAudience: null })).toBe("Tea for families");
    expect(briefLanguageText({ description: "", brandName: "রহিম চা", slogan: null, targetAudience: bn.wizard.suggest.audiences.food })).toBe(`রহিম চা ${bn.wizard.suggest.audiences.food}`);
    // A Bangla client's v2 contest (defaults in Bangla) stays offered in Bangla; an English one in English only.
    expect(hasBangla(briefLanguageText({ description: "", brandName: "রহিম চা", slogan: "", targetAudience: bn.wizard.suggest.audiences.food }))).toBe(true);
    expect(hasBangla(briefLanguageText({ description: "", brandName: "Rahim Tea", slogan: "Hot tea", targetAudience: en.wizard.suggest.audiences.food }))).toBe(false);
    expect(hasBangla("")).toBe(false);
  });

  it("the page's alternates and the sitemap both use it", () => {
    expect(read("src/app/contest/[slug]/page.tsx")).toContain("hasBangla(briefLanguageText({ ...contest.brief, brandName: contest.brandName }))");
    const s = read("src/app/sitemap.ts");
    expect(s).toContain("business_description, brand_name, slogan, target_audience,");
    expect(s).toContain('hasBangla(c.business_description?.trim() || [c.brand_name, c.slogan, c.target_audience].filter(Boolean).join(" "))');
    expect(s).toContain("...contestRows.filter(bangla).map(contestEntry),");
  });
});

describe("Edit details on a v2 contest", () => {
  const live: Brief = cleanBrief(applyDefaults({ ...emptyBrief(), brandName: "Rahim Tea", businessType: "food" }, SEED.food, "Families nearby"));

  it("an empty description passes v2's rule, not the old wizard's", () => {
    expect(validateBriefV2(live)).toEqual({});
    expect(validateBrief(live)).toHaveProperty("businessDescription");
  });

  it("only the parts that really changed stop being defaults", () => {
    expect(sectionsChanged(live, cleanBrief({ ...live }))).toEqual([]);
    expect(sectionsChanged(live, cleanBrief({ ...live, businessDescription: "Tea and snacks for families near the station" }))).toEqual(["business"]);
    expect(sectionsChanged(live, cleanBrief({ ...live, letDesignersChoose: false, colors: ["#AA0000"], usedOn: ["social"] }))).toEqual(["look", "needs"]);
    // A stored list in another order is the same choice once both sides are cleaned.
    const stored = { ...live, requirements: [...live.requirements].reverse() };
    expect(sectionsChanged(stored, live)).toEqual(["needs"]);
    expect(sectionsChanged(cleanBrief(stored), live)).toEqual([]);
  });

  it("the save checks by v2's rule, writes the brief's own columns and marks the changed parts", () => {
    const a = read("src/lib/contests/edit-actions.ts");
    expect(a).toContain('contest.briefCompletion ? validateBriefV2(brief) : validateBrief(brief, new Set((await getOnboarding("client")).hidden))');
    expect(a).toContain(".update(briefColumns(brief))");
    expect(a).toContain("if (contest.briefCompletion) await markEdited(contest.id, sectionsChanged(cleanBrief(contest.brief), brief));");
  });

  it("the form checks the same way, told by the page", () => {
    expect(read("src/components/manage/edit-brief-form.tsx")).toContain("v2 ? validateBriefV2(cleanBrief(brief)) : validateBrief(cleanBrief(brief), hiddenSet)");
    expect(read("src/app/dashboard/contests/[slug]/edit/page.tsx")).toContain("v2={Boolean(record.briefCompletion)}");
  });
});
