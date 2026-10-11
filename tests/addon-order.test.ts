import { describe, expect, it } from "vitest";
import { ADDON_ORDER, addonRank } from "@/lib/contests/addon-order";

const c = (on: Partial<Record<"isPromoted" | "isUrgent" | "isHighlighted" | "isPrivate" | "isNda", boolean>> = {}) => ({
  isPromoted: false,
  isUrgent: false,
  isHighlighted: false,
  isPrivate: false,
  isNda: false,
  ...on,
});

describe("add-on order in the All contests list (owner, 2026-10-11)", () => {
  it("is Featured, Urgent, Highlighted, Private, then the rest", () => {
    expect(ADDON_ORDER).toEqual(["featured", "urgent", "highlighted", "private"]);
    expect([c({ isPromoted: true }), c({ isUrgent: true }), c({ isHighlighted: true }), c({ isPrivate: true }), c()].map(addonRank)).toEqual([0, 1, 2, 3, 4]);
  });
  it("puts a contest in the group of its first add-on", () => {
    expect(addonRank(c({ isUrgent: true, isPromoted: true }))).toBe(0);
    expect(addonRank(c({ isHighlighted: true, isNda: true }))).toBe(2);
    expect(addonRank(c({ isNda: true }))).toBe(3);
  });
});
