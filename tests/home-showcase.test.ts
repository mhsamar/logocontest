import { describe, expect, it } from "vitest";
import { contestAllowed, contestDays, dailyShuffle, entryAllowed, gridEntries, isLive, pickFeatured, pickWall, pinnedThenBest, roundedCount, WALL_PER_CONTEST, WALL_PER_ROW, type SContest, type SEntry } from "@/lib/home/showcase-rules";

const contest = (over: Partial<SContest> = {}): SContest => ({
  id: "c1",
  slug: "shapla",
  brand: "Shapla",
  businessType: "food",
  status: "open",
  isPrivate: false,
  isNda: false,
  isBlind: false,
  homeShow: true,
  ownerIsTest: false,
  service: "logo",
  prize: 5000,
  startsAt: "2026-11-01T00:00:00Z",
  endsAt: "2026-11-30T00:00:00Z",
  completedAt: null,
  winnerEntryId: null,
  ...over,
});

const entry = (over: Partial<SEntry> = {}): SEntry => ({
  id: "e1",
  number: 1,
  status: "active",
  isHidden: false,
  homeHidden: false,
  createdAt: "2026-11-10T00:00:00Z",
  contestId: "c1",
  designerId: "d1",
  designerActive: true,
  designerIsTest: false,
  ...over,
});

describe("home showcase: what may show", () => {
  it("never shows blind, private or NDA contests, test clients' contests, switched-off or non-logo contests", () => {
    expect(contestAllowed(contest())).toBe(true);
    expect(contestAllowed(contest({ isBlind: true }))).toBe(false);
    expect(contestAllowed(contest({ isPrivate: true }))).toBe(false);
    expect(contestAllowed(contest({ isNda: true }))).toBe(false);
    expect(contestAllowed(contest({ ownerIsTest: true }))).toBe(false);
    expect(contestAllowed(contest({ homeShow: false }))).toBe(false);
    expect(contestAllowed(contest({ service: "business_card" }))).toBe(false);
    expect(contestAllowed(contest({ status: "cancelled" }))).toBe(false);
    expect(contestAllowed(contest({ status: "deleted" }))).toBe(false);
    expect(contestAllowed(contest({ status: "awaiting_payment" }))).toBe(false);
  });

  it("a blind contest's winner never shows either", () => {
    const c = contest({ isBlind: true, status: "completed", winnerEntryId: "e1" });
    expect(entryAllowed(entry({ status: "winner" }), c, new Set())).toBe(false);
  });

  it("only designs shown on the contest page, not hidden from home, not reported, by an active real designer", () => {
    const c = contest();
    expect(entryAllowed(entry(), c, new Set())).toBe(true);
    for (const status of ["held", "rejected", "removed", "withdrawn"]) expect(entryAllowed(entry({ status }), c, new Set())).toBe(false);
    expect(entryAllowed(entry({ homeHidden: true }), c, new Set())).toBe(false);
    expect(entryAllowed(entry(), c, new Set(["e1"]))).toBe(false);
    expect(entryAllowed(entry({ designerActive: false }), c, new Set())).toBe(false);
    expect(entryAllowed(entry({ designerIsTest: true }), c, new Set())).toBe(false);
    expect(entryAllowed(entry(), undefined, new Set())).toBe(false);
  });

  it("a Pro designer's hidden design stays off while the contest is open or judged, and shows once it is decided", () => {
    expect(entryAllowed(entry({ isHidden: true }), contest({ status: "open" }), new Set())).toBe(false);
    expect(entryAllowed(entry({ isHidden: true }), contest({ status: "judging" }), new Set())).toBe(false);
    expect(entryAllowed(entry({ isHidden: true }), contest({ status: "completed" }), new Set())).toBe(true);
  });
});

describe("home showcase: picking", () => {
  it("rounds the count down to 50 with a plus, exact below 50", () => {
    expect(roundedCount(337)).toEqual({ n: 300, plus: true });
    expect(roundedCount(50)).toEqual({ n: 50, plus: true });
    expect(roundedCount(49)).toEqual({ n: 49, plus: false });
    expect(roundedCount(0)).toEqual({ n: 0, plus: false });
  });

  it("the daily order is the same all day and changes the next day", () => {
    const list = Array.from({ length: 20 }, (_, i) => ({ id: `e${i}` }));
    expect(dailyShuffle(list, "2026-11-20")).toEqual(dailyShuffle(list, "2026-11-20"));
    expect(dailyShuffle(list, "2026-11-20")).not.toEqual(dailyShuffle(list, "2026-11-21"));
  });

  it("the wall: 3 rows of at most 16, at most 2 per contest per row, no repeats", () => {
    const pool = Array.from({ length: 100 }, (_, i) => ({ id: `e${i}`, contestId: `c${i % 5}`, status: i % 10 === 0 ? "winner" : "active", createdAt: new Date(Date.UTC(2026, 10, 1) + i * 60_000).toISOString() }));
    const rows = pickWall(pool, "2026-11-20");
    expect(rows.length).toBeLessThanOrEqual(3);
    const all = rows.flat().map((e) => e.id);
    expect(new Set(all).size).toBe(all.length);
    for (const r of rows) {
      expect(r.length).toBeLessThanOrEqual(WALL_PER_ROW);
      const perContest = new Map<string, number>();
      for (const e of r) perContest.set(e.contestId, (perContest.get(e.contestId) ?? 0) + 1);
      expect(Math.max(...perContest.values())).toBeLessThanOrEqual(WALL_PER_CONTEST);
    }
    // 5 contests × 2 per row = 10 per row at most here.
    expect(rows.every((r) => r.length === 10)).toBe(true);
  });

  it("pinned contests come first in their order, then the best; pins no longer allowed are skipped", () => {
    const list = [{ id: "a", n: 1 }, { id: "b", n: 9 }, { id: "c", n: 5 }];
    expect(pinnedThenBest(list, ["c", "gone"], (x) => x.n, 3).map((x) => x.id)).toEqual(["c", "b", "a"]);
    expect(pinnedThenBest(list, [], (x) => x.n, 2).map((x) => x.id)).toEqual(["b", "c"]);
  });

  it("live means open and not ended; Pro early access hides the newest", () => {
    const now = new Date("2026-11-20T00:00:00Z");
    expect(isLive(contest(), now, null)).toBe(true);
    expect(isLive(contest({ endsAt: "2026-11-19T00:00:00Z" }), now, null)).toBe(false);
    expect(isLive(contest({ status: "judging" }), now, null)).toBe(false);
    expect(isLive(contest({ startsAt: "2026-11-19T23:50:00Z" }), now, new Date("2026-11-19T23:30:00Z"))).toBe(false);
  });

  it("the featured finished contest: the pin, else the most designs in the last 90 days", () => {
    const now = new Date("2026-11-20T00:00:00Z");
    const a = contest({ id: "a", status: "completed", completedAt: "2026-11-01T00:00:00Z" });
    const b = contest({ id: "b", status: "completed", completedAt: "2026-11-05T00:00:00Z" });
    const old = contest({ id: "old", status: "completed", completedAt: "2025-01-01T00:00:00Z" });
    const designs = (id: string) => ({ a: 10, b: 30, old: 99 })[id] ?? 0;
    expect(pickFeatured([a, b, old], "", designs, now)?.id).toBe("b");
    expect(pickFeatured([a, b, old], "old", designs, now)?.id).toBe("old");
    expect(pickFeatured([old], "", designs, now)?.id).toBe("old");
    expect(pickFeatured([], "", designs, now)).toBeNull();
  });

  it("the grid always holds the winner, in number order", () => {
    const list = Array.from({ length: 30 }, (_, i) => ({ id: `e${i + 1}`, number: i + 1 }));
    const grid = gridEntries(list, "e30", 23);
    expect(grid).toHaveLength(23);
    expect(grid.map((e) => e.id)).toContain("e30");
    expect(grid.map((e) => e.number)).toEqual([...grid.map((e) => e.number)].sort((x, y) => x - y));
  });

  it("contest length in days", () => {
    expect(contestDays({ startsAt: "2026-11-01T00:00:00Z", endsAt: "2026-11-08T00:00:00Z" })).toBe(7);
    expect(contestDays({ startsAt: null, endsAt: null })).toBe(0);
  });
});
