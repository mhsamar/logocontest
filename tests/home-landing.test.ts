import { describe, expect, it } from "vitest";
import { showsLanding } from "@/lib/home/landing";
import { pickLogos, timeLeft } from "@/lib/home/logo-pick";

const d = (entryId: string, coverUrl: string | null = `https://x/${entryId}.png`) => ({ entryId, coverUrl });

describe("home page logos (owner, 2026-10-10)", () => {
  it("puts the admin's featured logos first, in their order, then the newest, without repeats", () => {
    const out = pickLogos(["b", "a"], [d("a"), d("b")], [d("c"), d("a"), d("d")], 10);
    expect(out).toEqual(["https://x/b.png", "https://x/a.png", "https://x/c.png", "https://x/d.png"]);
  });

  it("skips designs without a picture and stops at the limit", () => {
    expect(pickLogos([], [], [d("a", null), d("b"), d("c"), d("e")], 2)).toEqual(["https://x/b.png", "https://x/c.png"]);
    expect(pickLogos(["gone"], [], [], 5)).toEqual([]);
  });
});

describe("days left on a live contest card", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000);
  it("is red under 10 days, orange from 10, hours on the last day, and hidden once over", () => {
    expect(timeLeft(inDays(30), now)).toEqual({ kind: "days", n: 30, soon: false });
    expect(timeLeft(inDays(9), now)).toEqual({ kind: "days", n: 9, soon: true });
    expect(timeLeft(inDays(10), now)).toEqual({ kind: "days", n: 10, soon: false });
    expect(timeLeft(new Date(now.getTime() + 5 * 3_600_000), now)).toEqual({ kind: "hours", n: 5, soon: true });
    expect(timeLeft(inDays(-1), now)).toBeNull();
    expect(timeLeft(null, now)).toBeNull();
  });
});

describe("who sees the designed home page", () => {
  it("guests and admins; clients and designers keep their own homes", () => {
    expect(showsLanding(null)).toBe(true);
    expect(showsLanding("admin")).toBe(true);
    expect(showsLanding("client")).toBe(false);
    expect(showsLanding("designer")).toBe(false);
  });
});
