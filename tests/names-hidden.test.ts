import { describe, expect, it } from "vitest";
import { canSeeEntry, entryScope, isPublicDesign, seesHiddenPicture, stillHidden } from "@/lib/entries/rules";
import { isPersonName, personNameFrom } from "@/lib/profile/name-rules";

describe("names: letters only (owner, 2026-10-14)", () => {
  it("accepts English and Bangla names with single spaces", () => {
    expect(isPersonName("Rafi Ahmed")).toBe(true);
    expect(isPersonName("রাফি আহমেদ")).toBe(true);
    // "মোঃ" (Md.) uses the Bangla sign ঃ, part of the letters, so it is allowed; "Md." with a dot is not.
    expect(isPersonName("মোঃ করিম")).toBe(true);
    expect(isPersonName("Md. Karim")).toBe(false);
  });

  it("refuses digits and signs", () => {
    for (const bad of ["animatoon 23", "Rafi 1", "Rafi.", "Rafi/Ahmed", "Rafi, Ahmed", "রাফি ১২", "Rafi  Ahmed", " Rafi", "Rafi-Ahmed"]) expect(isPersonName(bad)).toBe(false);
  });

  it("a new client's name from the brand keeps only letters", () => {
    expect(personNameFrom("Animatoon 23")).toBe("Animatoon");
    expect(personNameFrom("Café.Bar / 99")).toBe("Café Bar");
    expect(personNameFrom("123")).toBe("");
  });
});

describe("Pro: hide my design (owner, 2026-10-14)", () => {
  const contest = { ownerId: "client", isBlind: false, canSeeBrief: true, status: "open", winnerIsPublic: false };
  it("stays hidden only while the contest is open or being judged", () => {
    expect(stillHidden(true, "open")).toBe(true);
    expect(stillHidden(true, "judging")).toBe(true);
    expect(stillHidden(true, "winner_selected")).toBe(false);
    expect(stillHidden(true, "completed")).toBe(false);
    expect(stillHidden(false, "open")).toBe(false);
  });

  it("the client, admins and the designer see the picture; nobody else", () => {
    expect(seesHiddenPicture(contest, { id: "client", role: "client" }, "d1")).toBe(true);
    expect(seesHiddenPicture(contest, { id: "a", role: "admin" }, "d1")).toBe(true);
    expect(seesHiddenPicture(contest, { id: "d1", role: "designer" }, "d1")).toBe(true);
    expect(seesHiddenPicture(contest, { id: "d2", role: "designer" }, "d1")).toBe(false);
    expect(seesHiddenPicture(contest, null, "d1")).toBe(false);
  });

  it("a hidden design still shows as a card (the count stays honest), but is not a public design until the winner is picked", () => {
    expect(canSeeEntry(entryScope(contest, null), { status: "active", designerId: "d1" })).toBe(true);
    const pub = { isPrivate: false, isBlind: false, winnerIsPublic: false };
    expect(isPublicDesign({ status: "active", isHidden: true }, { ...pub, status: "open" })).toBe(false);
    expect(isPublicDesign({ status: "active", isHidden: true }, { ...pub, status: "completed" })).toBe(true);
    expect(isPublicDesign({ status: "active", isHidden: false }, { ...pub, status: "open" })).toBe(true);
  });
});
