import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { isShareableDesign } from "@/lib/entries/rules";
import { contestPinPath, designPath, designPinPath, facebookShareUrl, pinterestShareUrl, whatsappShareUrl } from "@/lib/share/links";

vi.mock("server-only", () => ({}));

// Facebook and Pinterest sharing (owner, 2026-10-18).
describe("share links", () => {
  it("each design has its own public page and a tall Pinterest picture", () => {
    expect(designPath("rupkotha-fashion", 7)).toBe("/contest/rupkotha-fashion/design/7");
    expect(designPinPath("rupkotha-fashion", 7)).toBe("/contest/rupkotha-fashion/design/7/pin");
    expect(contestPinPath("rupkotha-fashion")).toBe("/contest/rupkotha-fashion/pin");
  });

  it("Facebook gets the page; Facebook reads the picture from the page itself", () => {
    expect(facebookShareUrl("https://logocontest.bd/contest/a/design/1")).toBe("https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Flogocontest.bd%2Fcontest%2Fa%2Fdesign%2F1");
  });

  it("Pinterest gets the page, the picture and a description of at most 500 characters", () => {
    const link = new URL(pinterestShareUrl({ url: "https://logocontest.bd/contest/a/design/1", media: "https://logocontest.bd/contest/a/design/1/pin", description: "x".repeat(600) }));
    expect(link.origin + link.pathname).toBe("https://www.pinterest.com/pin/create/button/");
    expect(link.searchParams.get("url")).toBe("https://logocontest.bd/contest/a/design/1");
    expect(link.searchParams.get("media")).toBe("https://logocontest.bd/contest/a/design/1/pin");
    expect(link.searchParams.get("description")).toHaveLength(500);
  });

  it("WhatsApp gets the text and the link", () => {
    expect(new URL(whatsappShareUrl("Design #1 for Aroma", "https://logocontest.bd/x")).searchParams.get("text")).toBe("Design #1 for Aroma https://logocontest.bd/x");
  });
});

describe("which designs may be shared", () => {
  const open = { status: "open", isPrivate: false, isNda: false, isBlind: false, winnerIsPublic: false };
  it("a design in a public contest, as visitors see it", () => {
    expect(isShareableDesign({ status: "active" }, open)).toBe(true);
    expect(isShareableDesign({ status: "winner" }, { ...open, status: "completed" })).toBe(true);
    expect(isShareableDesign({ status: "forfeited" }, { ...open, status: "completed" })).toBe(true);
  });
  it("never from private or NDA contests, or contests that aren't live", () => {
    expect(isShareableDesign({ status: "active" }, { ...open, isPrivate: true })).toBe(false);
    expect(isShareableDesign({ status: "active" }, { ...open, isNda: true })).toBe(false);
    expect(isShareableDesign({ status: "active" }, { ...open, status: "draft" })).toBe(false);
    expect(isShareableDesign({ status: "active" }, { ...open, status: "cancelled" })).toBe(false);
  });
  it("never a held, rejected, removed or withdrawn design", () => {
    for (const status of ["held", "rejected", "removed", "withdrawn"] as const) expect(isShareableDesign({ status }, open)).toBe(false);
  });
  it("blind contests: only the winner, once the client made it public", () => {
    const blind = { ...open, isBlind: true };
    expect(isShareableDesign({ status: "active" }, blind)).toBe(false);
    expect(isShareableDesign({ status: "winner" }, { ...blind, status: "completed" })).toBe(false);
    expect(isShareableDesign({ status: "winner" }, { ...blind, status: "completed", winnerIsPublic: true })).toBe(true);
  });
  it("a Pro designer's hidden design: only once the winner is picked", () => {
    expect(isShareableDesign({ status: "active", isHidden: true }, open)).toBe(false);
    expect(isShareableDesign({ status: "active", isHidden: true }, { ...open, status: "judging" })).toBe(false);
    expect(isShareableDesign({ status: "active", isHidden: true }, { ...open, status: "completed" })).toBe(true);
  });
});

describe("share pictures", () => {
  it("a contest's state on its pictures", async () => {
    const { contestStatusLine } = await import("@/lib/og");
    const now = Date.parse("2026-10-18T00:00:00Z");
    expect(contestStatusLine("open", "2026-10-21T00:00:00Z", now)).toBe("Open · 3 days left");
    expect(contestStatusLine("open", "2026-10-18T20:00:00Z", now)).toBe("Open · 1 day left");
    expect(contestStatusLine("open", null, now)).toBe("Open");
    expect(contestStatusLine("judging", null, now)).toBe("Judging");
    expect(contestStatusLine("handover", null, now)).toBe("Winner picked");
    expect(contestStatusLine("draft", null, now)).toBeNull();
  });

  it("the design page, its pictures and the share rows use the visitor's view only", () => {
    const helper = readFileSync("src/lib/share/design.ts", "utf8");
    expect(helper).toContain("getContestBySlug(slug, null)");
    expect(helper).toContain("getEntryDetail(contest.id, number, forEntries, null)");
    expect(helper).toContain("isShareableDesign(");
    for (const f of ["src/app/contest/[slug]/page.tsx", "src/app/client/contests/[id]/page.tsx"]) expect(readFileSync(f, "utf8")).toMatch(/isShareableDesign\(/);
    // Private and NDA contests never get a Pinterest picture.
    expect(readFileSync("src/app/contest/[slug]/pin/route.tsx", "utf8")).toContain("contestIndexable(");
  });
});
