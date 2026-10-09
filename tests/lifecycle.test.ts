import { describe, expect, it } from "vitest";
import { dueReminders, endingSoonDue, reminderKind, splitPrize, type SplitEntry } from "@/lib/lifecycle/rules";
import { SETTINGS } from "@/lib/settings/registry";

const tiers = SETTINGS["fees.designer_tiers"].default;
const at = (min: number) => new Date(Date.UTC(2026, 9, 1, 10, min));
const e = (designerId: string, status: string, min: number): SplitEntry => ({ designerId, status, createdAt: at(min) });

describe("no-result split (BLUEPRINT §7.5)", () => {
  it("shares equally per designer, not per entry", () => {
    const shares = splitPrize(6000, [e("a", "active", 1), e("a", "active", 2), e("b", "active", 3), e("c", "active", 4)], () => 0, tiers);
    expect(shares.map((s) => [s.designerId, s.share])).toEqual([["a", 2000], ["b", 2000], ["c", 2000]]);
  });

  it("gives leftover taka to the designers who entered first", () => {
    const shares = splitPrize(5000, [e("late", "active", 9), e("early", "active", 1), e("mid", "active", 5)], () => 0, tiers);
    expect(shares.map((s) => [s.designerId, s.share])).toEqual([["early", 1667], ["mid", 1667], ["late", 1666]]);
    expect(shares.reduce((sum, s) => sum + s.share, 0)).toBe(5000);
  });

  it("leaves out rejected and removed designs and a winner who missed the deadline", () => {
    const shares = splitPrize(
      3000,
      [e("ok", "active", 1), e("rej", "rejected", 2), e("gone", "removed", 3), e("forf", "forfeited", 4), e("forf", "active", 5), e("w", "winner", 6)],
      () => 0,
      tiers,
    );
    expect(shares.map((s) => s.designerId)).toEqual(["ok", "w"]);
  });

  it("charges each designer their own fee tier", () => {
    const shares = splitPrize(10000, [e("new", "active", 1), e("pro", "active", 2)], (id) => (id === "pro" ? 60 : 0), tiers);
    expect(shares).toEqual([
      { designerId: "new", share: 5000, feeRate: 15, fee: 750, credit: 4250 },
      { designerId: "pro", share: 5000, feeRate: 5, fee: 250, credit: 4750 },
    ]);
  });

  it("returns nothing when no designer qualifies (an admin decides)", () => {
    expect(splitPrize(5000, [e("x", "rejected", 1)], () => 0, tiers)).toEqual([]);
  });
});

describe("lifecycle timing (BLUEPRINT §6)", () => {
  const ended = new Date(Date.UTC(2026, 9, 1, 12));
  const later = (h: number) => new Date(ended.getTime() + h * 3_600_000);

  it("sends the pick-a-winner reminders on days 1, 3 and 5, once each", () => {
    expect(dueReminders(ended, later(1), [1, 3, 5], new Set())).toEqual([1]);
    expect(dueReminders(ended, later(49), [1, 3, 5], new Set([reminderKind(1)]))).toEqual([3]);
    expect(dueReminders(ended, later(97), [1, 3, 5], new Set([reminderKind(1), reminderKind(3)]))).toEqual([5]);
    expect(dueReminders(ended, later(97), [1, 3, 5], new Set([reminderKind(1), reminderKind(3), reminderKind(5)]))).toEqual([]);
  });

  it("sends the ends-soon notice inside the last 24 hours only", () => {
    expect(endingSoonDue(later(30), ended, 24)).toBe(false);
    expect(endingSoonDue(later(20), ended, 24)).toBe(true);
    expect(endingSoonDue(later(-1), ended, 24)).toBe(false);
  });
});
