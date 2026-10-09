import { describe, expect, it } from "vitest";
import { designerEndingKind, designerNoticesDue } from "@/lib/lifecycle/rules";
import { canLike, isMonthKey, monthKey, monthRange, previousMonth, rankDesigns, recentMonths } from "@/lib/rewards/rules";

describe("months in Bangladesh time", () => {
  it("puts a moment in its Dhaka month", () => {
    expect(monthKey(new Date("2026-09-30T17:59:00Z"))).toBe("2026-09"); // 23:59 in Dhaka
    expect(monthKey(new Date("2026-09-30T18:00:00Z"))).toBe("2026-10"); // midnight in Dhaka
  });
  it("gives the month as Dhaka-midnight bounds", () => {
    const r = monthRange("2026-10");
    expect(r.start.toISOString()).toBe("2026-09-30T18:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-10-31T18:00:00.000Z");
  });
  it("steps back across a year and lists recent months", () => {
    expect(previousMonth("2026-01")).toBe("2025-12");
    expect(recentMonths("2026-02", 3)).toEqual(["2026-02", "2026-01", "2025-12"]);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("2026-09")).toBe(true);
  });
});

describe("leaderboard and Monthly Winner order (owner, 2026-10-09)", () => {
  const d = (entryId: string, likes: number, rating: number | null, day: number) => ({ entryId, likes, rating, finishedAt: new Date(Date.UTC(2026, 8, day)) });

  it("orders by likes, then the client's stars, then who finished first", () => {
    const ranked = rankDesigns([d("a", 3, 4, 10), d("b", 7, 2, 12), d("c", 3, 5, 20), d("e", 3, 5, 5), d("f", 0, null, 1)]);
    expect(ranked.map((x) => x.entryId)).toEqual(["b", "e", "c", "a", "f"]);
  });

  it("is empty with no designs", () => {
    expect(rankDesigns([])).toEqual([]);
  });
});

describe("who may like a winning design", () => {
  it("only an active designer who didn't make it", () => {
    expect(canLike({ id: "x", role: "designer", status: "active" }, "y")).toBe(true);
    expect(canLike({ id: "y", role: "designer", status: "active" }, "y")).toBe(false);
    expect(canLike({ id: "x", role: "client", status: "active" }, "y")).toBe(false);
    expect(canLike({ id: "x", role: "designer", status: "suspended" }, "y")).toBe(false);
    expect(canLike(null, "y")).toBe(false);
  });
});

describe("designer ending notices (12h and 6h)", () => {
  const ends = new Date("2026-10-10T12:00:00Z");
  const at = (hoursLeft: number) => new Date(ends.getTime() - hoursLeft * 3_600_000);

  it("sends nothing before 12 hours, the 12h notice inside 12h, the 6h inside 6h", () => {
    expect(designerNoticesDue(ends, at(13), [12, 6], new Set())).toEqual([]);
    expect(designerNoticesDue(ends, at(11), [12, 6], new Set())).toEqual([12]);
    expect(designerNoticesDue(ends, at(5), [12, 6], new Set([designerEndingKind(12)]))).toEqual([6]);
  });

  it("when the job ran late, the most urgent comes first and the older one is only recorded", () => {
    expect(designerNoticesDue(ends, at(4), [12, 6], new Set())).toEqual([6, 12]);
  });

  it("nothing after the end or when both were sent", () => {
    expect(designerNoticesDue(ends, at(-1), [12, 6], new Set())).toEqual([]);
    expect(designerNoticesDue(ends, at(2), [12, 6], new Set([designerEndingKind(12), designerEndingKind(6)]))).toEqual([]);
  });
});
