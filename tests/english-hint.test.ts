import { describe, expect, it } from "vitest";
import { showsEnglishHint } from "@/lib/i18n/english-hint";

/** "View in English" instead of any redirect (owner, 2026-11-03): by country only. */
describe("View in English bar", () => {
  const base = { chosen: null, dismissed: false, country: "BD" };

  it("not in Bangladesh, whatever the browser's language", () => expect(showsEnglishHint(base)).toBe(false));
  it("for a visitor outside Bangladesh", () => expect(showsEnglishHint({ ...base, country: "GB" })).toBe(true));
  it("country unknown (local) counts as not outside", () => expect(showsEnglishHint({ ...base, country: null })).toBe(false));
  it("for someone who chose English before", () => expect(showsEnglishHint({ ...base, chosen: "en" })).toBe(true));
  it("never after choosing Bangla or closing it", () => {
    expect(showsEnglishHint({ ...base, country: "US", chosen: "bn" })).toBe(false);
    expect(showsEnglishHint({ ...base, country: "US", dismissed: true })).toBe(false);
  });
});
