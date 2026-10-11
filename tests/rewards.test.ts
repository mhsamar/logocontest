import { describe, expect, it } from "vitest";
import { designerEndingKind, designerNoticesDue } from "@/lib/lifecycle/rules";
import { isMonthKey, monthKey, monthRange, previousMonth, recentMonths } from "@/lib/rewards/rules";

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
