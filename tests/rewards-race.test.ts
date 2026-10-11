import { describe, expect, it } from "vitest";
import { closableMonth, daysLeft, inRace, isLastDayOfMonth, missedMonth, rankClients, rankDesigners, winnerOf, type RaceContest, type RaceEntry, type RacePerson, type RaceWin } from "@/lib/rewards/race-rules";
import { monthKey, monthRange } from "@/lib/rewards/rules";

// Dhaka is UTC+6 with no daylight saving.
const dhaka = (iso: string) => new Date(`${iso}+06:00`);

const person = (id: string, over: Partial<RacePerson> = {}): RacePerson => ({ id, role: "client", status: "active", isTest: false, ...over });
const people = (...list: RacePerson[]) => new Map(list.map((p) => [p.id, p]));
const contest = (clientId: string, prize: number, startsAt: string, over: Partial<RaceContest> = {}): RaceContest => ({
  contestId: `${clientId}-${startsAt}-${prize}`,
  clientId,
  prize,
  startsAt: dhaka(startsAt),
  status: "open",
  paid: true,
  ...over,
});
const win = (designerId: string, prize: number, pickedAt: string, over: Partial<RaceWin> = {}): RaceWin => ({
  contestId: `${designerId}-${pickedAt}`,
  designerId,
  prize,
  feeRate: 15,
  pickedAt: dhaka(pickedAt),
  status: "approved",
  ...over,
});

describe("the month in Dhaka time (owner, 2026-10-11)", () => {
  it("runs from the 1st 00:00 to the last day 23:59 in Dhaka", () => {
    const { start, end } = monthRange("2026-10");
    expect(start.toISOString()).toBe("2026-09-30T18:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-31T18:00:00.000Z");
    expect(monthKey(dhaka("2026-10-31T23:59:00"))).toBe("2026-10");
    expect(monthKey(dhaka("2026-11-01T00:00:00"))).toBe("2026-11");
    // 1 November 03:00 in Dhaka is still 31 October in London: Dhaka decides.
    expect(monthKey(new Date("2026-10-31T21:00:00Z"))).toBe("2026-11");
  });

  it("knows the last day of a month, February included", () => {
    expect(isLastDayOfMonth(dhaka("2026-10-31T23:59:00"))).toBe(true);
    expect(isLastDayOfMonth(dhaka("2026-10-30T23:59:00"))).toBe(false);
    expect(isLastDayOfMonth(dhaka("2027-02-28T23:59:00"))).toBe(true);
    expect(isLastDayOfMonth(dhaka("2028-02-28T23:59:00"))).toBe(false); // leap year
    expect(isLastDayOfMonth(dhaka("2028-02-29T23:59:00"))).toBe(true);
  });

  it("counts the days left, today included", () => {
    expect(daysLeft("2026-10", dhaka("2026-10-11T10:00:00"))).toBe(21);
    expect(daysLeft("2026-10", dhaka("2026-10-31T23:00:00"))).toBe(1);
    expect(daysLeft("2026-10", dhaka("2026-11-01T00:00:00"))).toBe(0);
  });
});

describe("who is in the race", () => {
  it("leaves out admins and staff, banned and test accounts; test mode counts only test accounts", () => {
    expect(inRace(person("a"), false)).toBe(true);
    expect(inRace(person("a", { role: "admin" }), false)).toBe(false);
    expect(inRace(person("a", { status: "banned" }), false)).toBe(false);
    expect(inRace(person("a", { isTest: true }), false)).toBe(false);
    expect(inRace(person("a", { isTest: true }), true)).toBe(true);
    expect(inRace(person("a"), true)).toBe(false);
    expect(inRace(person("a", { role: "admin", isTest: true }), true)).toBe(false);
    expect(inRace(undefined, false)).toBe(false);
  });
});

describe("smartphone: the client who ran the most contests", () => {
  const ppl = people(person("c1"), person("c2"), person("c3"), person("staff", { role: "admin" }), person("test", { isTest: true }));

  it("most contests wins; equal contests, the bigger prize money wins", () => {
    const ranked = rankClients(
      "2026-10",
      [contest("c1", 5000, "2026-10-02T10:00:00"), contest("c1", 5000, "2026-10-03T10:00:00"), contest("c2", 15000, "2026-10-04T10:00:00"), contest("c2", 8000, "2026-10-05T10:00:00"), contest("c3", 30000, "2026-10-06T10:00:00")],
      [],
      ppl,
    );
    expect(ranked.map((c) => [c.id, c.contests, c.prizeTotal])).toEqual([
      ["c2", 2, 23000],
      ["c1", 2, 10000],
      ["c3", 1, 30000],
    ]);
    expect(winnerOf(ranked)?.id).toBe("c2");
  });

  it("counts only paid contests that went live this month and were not cancelled; no-result contests count", () => {
    const ranked = rankClients(
      "2026-10",
      [
        contest("c1", 5000, "2026-10-02T10:00:00"),
        contest("c1", 5000, "2026-10-03T10:00:00", { paid: false }),
        contest("c1", 5000, "2026-10-04T10:00:00", { status: "cancelled" }),
        contest("c1", 5000, "2026-10-05T10:00:00", { status: "no_result" }),
        contest("c1", 5000, "2026-09-30T23:59:00"), // September in Dhaka
        contest("c1", 5000, "2026-11-01T00:00:00"), // November in Dhaka
      ],
      [],
      ppl,
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0].contests).toBe(2);
  });

  it("never lists admins, staff or test accounts; adds up what each client paid this month", () => {
    const ranked = rankClients(
      "2026-10",
      [contest("staff", 5000, "2026-10-02T10:00:00"), contest("test", 5000, "2026-10-02T10:00:00"), contest("c1", 5000, "2026-10-02T10:00:00")],
      [
        { clientId: "c1", amount: 6000, paidAt: dhaka("2026-10-02T09:00:00") },
        { clientId: "c1", amount: 500, paidAt: dhaka("2026-10-09T09:00:00") },
        { clientId: "c1", amount: 9000, paidAt: dhaka("2026-09-20T09:00:00") },
      ],
      ppl,
    );
    expect(ranked.map((c) => c.id)).toEqual(["c1"]);
    expect(ranked[0].spent).toBe(6500);
    // Test mode: only the test account is in the race.
    expect(rankClients("2026-10", [contest("test", 5000, "2026-10-02T10:00:00"), contest("c1", 5000, "2026-10-02T10:00:00")], [], ppl, true).map((c) => c.id)).toEqual(["test"]);
  });

  it("nobody qualified: no winner", () => {
    expect(winnerOf(rankClients("2026-10", [], [], ppl))).toBeNull();
  });
});

describe("mystery gift box: the designer who won the most contests", () => {
  const ppl = people(person("d1", { role: "designer" }), person("d2", { role: "designer" }), person("d3", { role: "designer" }), person("t", { role: "designer", isTest: true }));
  const entry = (designerId: string, contestId: string, createdAt: string, status = "active"): RaceEntry => ({ designerId, contestId, createdAt: dhaka(createdAt), status });

  it("most wins; equal wins, whoever earned more (prize minus their fee)", () => {
    const ranked = rankDesigners(
      "2026-10",
      [
        win("d1", 5000, "2026-10-02T10:00:00"),
        win("d1", 5000, "2026-10-03T10:00:00"),
        win("d2", 8000, "2026-10-04T10:00:00"),
        win("d2", 8000, "2026-10-05T10:00:00", { feeRate: 10 }),
        win("d3", 30000, "2026-10-06T10:00:00"),
      ],
      [],
      ppl,
    );
    expect(ranked.map((d) => [d.id, d.wins, d.earned])).toEqual([
      ["d2", 2, 6800 + 7200],
      ["d1", 2, 4250 * 2],
      ["d3", 1, 25500],
    ]);
  });

  it("counts a win in the month the winner was picked; cancelled and no-result wins don't count", () => {
    const ranked = rankDesigners(
      "2026-10",
      [
        win("d1", 5000, "2026-10-31T23:59:00", { status: "awaiting_files" }),
        win("d1", 5000, "2026-11-01T00:00:00"),
        win("d1", 5000, "2026-10-10T10:00:00", { status: "cancelled" }),
        win("d1", 5000, "2026-10-11T10:00:00", { status: "no_result" }),
      ],
      [],
      ppl,
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0].wins).toBe(1);
  });

  it("counts the contests a winner joined this month, not withdrawn or removed designs", () => {
    const [d1] = rankDesigners(
      "2026-10",
      [win("d1", 5000, "2026-10-02T10:00:00")],
      [entry("d1", "k1", "2026-10-01T10:00:00"), entry("d1", "k1", "2026-10-02T10:00:00"), entry("d1", "k2", "2026-10-03T10:00:00"), entry("d1", "k3", "2026-10-04T10:00:00", "withdrawn"), entry("d1", "k4", "2026-09-20T10:00:00")],
      ppl,
    );
    expect(d1.joined).toBe(2);
  });

  it("leaves out test accounts, except in test mode", () => {
    expect(rankDesigners("2026-10", [win("t", 5000, "2026-10-02T10:00:00")], [], ppl)).toHaveLength(0);
    expect(rankDesigners("2026-10", [win("t", 5000, "2026-10-02T10:00:00"), win("d1", 5000, "2026-10-02T10:00:00")], [], ppl, true).map((d) => d.id)).toEqual(["t"]);
  });
});

describe("month close timing", () => {
  it("closes the month only from 23:55 on its last day, Dhaka time", () => {
    expect(closableMonth(new Date("2026-10-31T17:59:00Z"))).toBe("2026-10"); // 23:59 Dhaka
    expect(closableMonth(new Date("2026-10-31T17:50:00Z"))).toBeNull(); // 23:50
    expect(closableMonth(new Date("2026-10-30T17:59:00Z"))).toBeNull(); // not the last day
    expect(closableMonth(new Date("2027-02-28T17:59:00Z"))).toBe("2027-02");
    expect(closableMonth(new Date("2028-02-28T17:59:00Z"))).toBeNull(); // leap year
  });

  it("catches a missed close only on the 1st", () => {
    expect(missedMonth(new Date("2026-10-31T18:30:00Z"))).toBe("2026-10"); // 00:30 on 1 Nov, Dhaka
    expect(missedMonth(new Date("2026-11-01T17:59:00Z"))).toBe("2026-10");
    expect(missedMonth(new Date("2026-11-01T18:00:00Z"))).toBeNull(); // 2 Nov
    expect(missedMonth(new Date("2027-01-01T03:00:00Z"))).toBe("2026-12");
  });
});
