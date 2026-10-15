import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canSeeEntry, entryScope, SHOWN_STATUSES, type ContestForEntries } from "@/lib/entries/rules";
import { heldAfterRemoval, readRelevance, RELEVANCE_TOOL, relevancePrompt } from "@/lib/entries/relevance-rules";
import { NOTICE_ROWS } from "@/lib/notifications/admin-catalog";
import { SETTINGS } from "@/lib/settings/registry";

describe("design check (owner, 2026-10-15)", () => {
  it("reads the AI's answer: which pictures are not designs, and why", () => {
    const a = readRelevance(
      {
        images: [
          { n: 1, related: true, what: "logo on a white background" },
          { n: 2, related: false, what: "screenshot of a diary app form" },
          { n: 3, related: false, what: "  selfie   photo " },
          { n: 2, related: false, what: "duplicate answer" },
          { n: 9, related: false, what: "out of range" },
        ],
      },
      3,
    );
    expect(a).toEqual({ held: true, positions: [1, 2], reason: "Picture 2: screenshot of a diary app form; Picture 3: selfie photo" });
  });

  it("anything unclear counts as a design; a broken answer means no check", () => {
    expect(readRelevance({ images: [{ n: 1, related: true, what: "mockup" }, { n: 2, what: "?" }, { n: 3, related: "no" }] }, 3)).toEqual({ held: false, positions: [], reason: "" });
    expect(readRelevance({ images: [] }, 2)).toEqual({ held: false, positions: [], reason: "" });
    expect(readRelevance(null, 2)).toBeNull();
    expect(readRelevance({ images: "x" }, 2)).toBeNull();
  });

  it("the instructions say what counts and lean towards publishing", () => {
    const p = relevancePrompt({ service: "a logo design", brand: null, count: 2 });
    expect(p).toContain("a logo design");
    expect(p).toContain("screenshot of an app");
    expect(p).toContain("If you are not sure, answer related = true");
    expect(p).not.toContain('for the brand "');
    expect(RELEVANCE_TOOL.input_schema.required).toEqual(["images"]);
    expect(SETTINGS["designs.relevance_check"].default).toBe(true);
  });

  it("a held design is seen only by its own designer and the admin team", () => {
    const contest: ContestForEntries = { ownerId: "client", isBlind: false, canSeeBrief: true, status: "open", winnerIsPublic: false };
    const held = { status: "held" as const, designerId: "d1" };
    expect(canSeeEntry(entryScope(contest, { id: "client", role: "client" }), held)).toBe(false);
    expect(canSeeEntry(entryScope(contest, { id: "admin", role: "admin" }), held)).toBe(true);
    expect(canSeeEntry(entryScope(contest, { id: "d1", role: "designer" }), held)).toBe(true);
    expect(canSeeEntry(entryScope(contest, { id: "d2", role: "designer" }), held)).toBe(false);
    expect(canSeeEntry(entryScope(contest, null), held)).toBe(false);
    const blind = { ...contest, isBlind: true };
    expect(canSeeEntry(entryScope(blind, { id: "d1", role: "designer" }), held)).toBe(true);
    expect(canSeeEntry(entryScope(blind, { id: "client", role: "client" }), held)).toBe(false);
    // Lists for clients and the public only take published designs.
    expect(SHOWN_STATUSES).not.toContain("held");
    // Still visible to the client once approved (active).
    expect(canSeeEntry(entryScope(contest, { id: "client", role: "client" }), { status: "active", designerId: "d1" })).toBe(true);
  });

  it("the team hears about held designs; designers hear when one is approved", () => {
    expect(NOTICE_ROWS.find((r) => r.types.includes("entry_held_admin"))?.audience).toBe("admin");
    expect(NOTICE_ROWS.find((r) => r.types.includes("entry_approved"))?.audience).toBe("designer");
  });

  it("migration 0061 adds the held state in its own block", () => {
    const sql = readFileSync("supabase/migrations/0061_design_check.sql", "utf8");
    expect(sql).toContain("alter type public.entry_status add value if not exists 'held';");
    expect(sql.indexOf("-- Block 2")).toBeGreaterThan(sql.indexOf("add value if not exists 'held'"));
    expect(sql).toContain("held_positions smallint[]");
  });
});

describe("heldAfterRemoval (owner, 2026-10-16: remove only the doubted picture, keep the rest)", () => {
  const held = { positions: [2, 3, 4], reason: "Picture 3: User profile interface screenshot; Picture 4: Resume or biodata form screenshot; Picture 5: Website screenshot showing furniture items" };

  it("drops the removed doubted picture and renumbers the rest", () => {
    // Picture 4 (position 3) removed: positions 0, 1, 2, 4 stay and become 0, 1, 2, 3.
    const out = heldAfterRemoval(held, [0, 1, 2, 4]);
    expect(out.positions).toEqual([2, 3]);
    expect(out.reason).toBe("Picture 3: User profile interface screenshot; Picture 4: Website screenshot showing furniture items");
    expect(out.clear).toBe(false);
  });

  it("moves the doubts up when a good picture before them goes", () => {
    const out = heldAfterRemoval(held, [1, 2, 3, 4]);
    expect(out.positions).toEqual([1, 2, 3]);
    expect(out.reason).toBe("Picture 2: User profile interface screenshot; Picture 3: Resume or biodata form screenshot; Picture 4: Website screenshot showing furniture items");
  });

  it("is clear once no doubted picture is left: the design is published", () => {
    const one = { positions: [1], reason: "Picture 2: Chat screenshot" };
    expect(heldAfterRemoval(one, [0, 2])).toEqual({ positions: [], reason: "", clear: true });
  });

  it("keeps a reason with semicolons in it whole", () => {
    const odd = { positions: [0, 1], reason: "Picture 1: a form; with a note; Picture 2: a selfie" };
    expect(heldAfterRemoval(odd, [0, 2]).reason).toBe("Picture 1: a form; with a note");
  });
});
