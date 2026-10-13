import { describe, expect, it } from "vitest";
import { emptyBrief } from "@/lib/contests/brief";
import { logoTextSuggestions, shortNameSuggestions } from "@/lib/contests/suggestions";

describe("logo wizard ready answers (owner, 2026-10-13)", () => {
  it("builds short names from the brand name", () => {
    expect(shortNameSuggestions({ ...emptyBrief(), brandName: "Nodi Tea House" })).toEqual(["Nodi", "Nodi Tea", "NTH", "N.T.H", "Nodi House"]);
    expect(shortNameSuggestions({ ...emptyBrief(), brandName: "" })).toEqual([]);
  });

  it("never makes initials from Bangla names", () => {
    expect(shortNameSuggestions({ ...emptyBrief(), brandName: "নদী চা ঘর" })).toEqual(["নদী", "নদী চা", "নদী ঘর"]);
  });

  it("offers the logo text as written, in capitals and as initials", () => {
    expect(logoTextSuggestions({ ...emptyBrief(), brandName: "Nodi Tea", shortName: "Nodi" })).toEqual(["Nodi Tea", "NODI TEA", "Nodi", "NT", "NT · Nodi Tea"]);
  });
});
