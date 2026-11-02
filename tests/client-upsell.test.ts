import { describe, expect, it } from "vitest";
import { dhakaDate, pickUpsell, upsellSeenKey, type UpsellContest } from "@/lib/client/upsell-rules";

// Owner, 2026-11-02: once a day, the most urgent thing first: files to check, a winner to pick, more time on the last
// day, designs to rate, then add-ons.

const now = new Date("2026-11-02T06:00:00Z");
const hours = (h: number) => new Date(now.getTime() + h * 3_600_000);
const prices = { promote: 1000, urgent: 500, highlight: 500, extensionPrice: 1000, extensionDays: [3, 5, 7] };
const contest = (id: string, endsIn: number | null, active: Partial<UpsellContest["active"]> = {}, prize = 5000, more: Partial<UpsellContest> = {}): UpsellContest => ({
  id,
  slug: `s-${id}`,
  brand: `Brand ${id}`,
  prize,
  status: "open",
  endsAt: endsIn === null ? null : hours(endsIn),
  active: { promote: false, urgent: false, highlight: false, ...active },
  unrated: 0,
  filesReady: false,
  ...more,
});
const never = () => false;

describe("the client's daily pop-up", () => {
  it("offers the add-ons a live contest doesn't have yet", () => {
    const u = pickUpsell([contest("a", 72, { urgent: true })], prices, never, now);
    expect(u).toMatchObject({ mode: "boost", contestId: "a", slug: "s-a" });
    expect(u?.mode === "boost" && u.items.map((i) => [i.key, i.price, i.free])).toEqual([
      ["promote", 1000, false],
      ["highlight", 500, false],
    ]);
  });

  it("on the last day offers more time instead: 3, 5 or 7 days for one price", () => {
    expect(pickUpsell([contest("a", 72), contest("b", 20)], prices, never, now)).toMatchObject({ mode: "extend", contestId: "b", price: 1000, days: [3, 5, 7] });
  });

  it("nothing when every add-on is on, the contest has ended, or there is none", () => {
    expect(pickUpsell([contest("a", 72, { promote: true, urgent: true, highlight: true })], prices, never, now)).toBeNull();
    expect(pickUpsell([contest("a", -1), contest("b", null)], prices, never, now)).toBeNull();
    expect(pickUpsell([], prices, never, now)).toBeNull();
  });

  it("says free when the prize makes add-ons free", () => {
    const u = pickUpsell([contest("a", 72, {}, 30000)], prices, (p) => p >= 25000, now);
    expect(u?.mode === "boost" && u.items.every((i) => i.free)).toBe(true);
  });

  it("the most urgent first: files to check, a winner to pick, more time, designs to rate, add-ons", () => {
    const rate = contest("r", 72, {}, 5000, { unrated: 4 });
    const last = contest("l", 10);
    const pick = contest("p", -5, {}, 5000, { status: "judging" });
    const files = contest("f", -50, {}, 5000, { status: "handover", filesReady: true });
    expect(pickUpsell([rate, last, pick, files], prices, never, now)).toMatchObject({ mode: "files", contestId: "f" });
    expect(pickUpsell([rate, last, pick], prices, never, now)).toMatchObject({ mode: "pick", contestId: "p" });
    expect(pickUpsell([rate, last], prices, never, now)).toMatchObject({ mode: "extend", contestId: "l" });
    expect(pickUpsell([rate], prices, never, now)).toMatchObject({ mode: "rate", contestId: "r", count: 4 });
    // A contest waiting for its winner's files (not sent yet) asks for nothing.
    expect(pickUpsell([contest("w", -50, { promote: true, urgent: true, highlight: true }, 5000, { status: "handover" })], prices, never, now)).toBeNull();
  });

  it("once a day per contest and offer, by the Bangladesh date", () => {
    expect(dhakaDate(new Date("2026-11-02T17:59:00Z"))).toBe("2026-11-02");
    expect(dhakaDate(new Date("2026-11-02T18:00:00Z"))).toBe("2026-11-03");
    expect(upsellSeenKey({ contestId: "a", mode: "extend" })).not.toBe(upsellSeenKey({ contestId: "a", mode: "boost" }));
  });
});
