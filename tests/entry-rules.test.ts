import { describe, expect, it } from "vitest";
import { canSeeEntry, canVote, canWithdraw, entryScope, isEntrySort, showDesignerName, sortEntries, type ContestForEntries } from "@/lib/entries/rules";

const contest = (over: Partial<ContestForEntries> = {}): ContestForEntries => ({
  ownerId: "client",
  isBlind: false,
  canSeeBrief: true,
  status: "open",
  winnerIsPublic: false,
  ...over,
});
const designer = (id: string) => ({ id, role: "designer" as const });

describe("who sees which designs (UI-JOURNEY P-03)", () => {
  it("open contest: everyone sees active and winning designs, not rejected ones", () => {
    const scope = entryScope(contest(), null);
    expect(canSeeEntry(scope, { status: "active", designerId: "d1" })).toBe(true);
    expect(canSeeEntry(scope, { status: "winner", designerId: "d1" })).toBe(true);
    expect(canSeeEntry(scope, { status: "rejected", designerId: "d1" })).toBe(false);
  });

  it("a designer also sees their own rejected design", () => {
    const scope = entryScope(contest(), designer("d1"));
    expect(canSeeEntry(scope, { status: "rejected", designerId: "d1" })).toBe(true);
    expect(canSeeEntry(scope, { status: "rejected", designerId: "d2" })).toBe(false);
  });

  it("the client sees everything except removed designs", () => {
    const scope = entryScope(contest({ isBlind: true }), { id: "client", role: "client" });
    expect(canSeeEntry(scope, { status: "rejected", designerId: "d1" })).toBe(true);
    expect(canSeeEntry(scope, { status: "removed", designerId: "d1" })).toBe(false);
  });

  it("blind contest: designers see only their own; guests see nothing", () => {
    const scope = entryScope(contest({ isBlind: true }), designer("d1"));
    expect(canSeeEntry(scope, { status: "active", designerId: "d1" })).toBe(true);
    expect(canSeeEntry(scope, { status: "active", designerId: "d2" })).toBe(false);
    expect(entryScope(contest({ isBlind: true }), null).kind).toBe("none");
  });

  it("blind contest after completion: the winner once the client made it public", () => {
    const done = contest({ isBlind: true, status: "completed", winnerIsPublic: true });
    expect(canSeeEntry(entryScope(done, null), { status: "winner", designerId: "d2" })).toBe(true);
    expect(canSeeEntry(entryScope(done, null), { status: "active", designerId: "d2" })).toBe(false);
  });

  it("private contest: nothing until the viewer can see the brief", () => {
    expect(entryScope(contest({ canSeeBrief: false }), null).kind).toBe("none");
  });

  it("hides designer names in blind contests from other designers", () => {
    const c = contest({ isBlind: true });
    expect(showDesignerName(c, designer("d1"), "d2")).toBe(false);
    expect(showDesignerName(c, designer("d2"), "d2")).toBe(true);
    expect(showDesignerName(c, { id: "client", role: "client" }, "d2")).toBe(true);
    expect(showDesignerName(contest(), null, "d2")).toBe(true);
  });
});

describe("withdrawn designs (owner, 2026-10-11)", () => {
  it("nobody sees a withdrawn design on the site, its own designer and the client included", () => {
    const e = { status: "withdrawn" as const, designerId: "d1" };
    expect(canSeeEntry(entryScope(contest(), designer("d1")), e)).toBe(false);
    expect(canSeeEntry(entryScope(contest(), { id: "client", role: "client" }), e)).toBe(false);
    expect(canSeeEntry(entryScope(contest({ isBlind: true }), designer("d1")), e)).toBe(false);
  });
});

describe("canWithdraw (owner, 2026-10-11)", () => {
  const now = new Date("2026-10-11T10:00:00Z");
  const open = { status: "open", endsAt: new Date("2026-10-15T10:00:00Z") };
  it("lets the designer remove their own active or rejected design while the contest is open", () => {
    expect(canWithdraw({ status: "active", designerId: "d1" }, open, "d1", now)).toBe(true);
    expect(canWithdraw({ status: "rejected", designerId: "d1" }, open, "d1", now)).toBe(true);
  });
  it("never someone else's design, a winner, or after the contest stops taking designs", () => {
    expect(canWithdraw({ status: "active", designerId: "d1" }, open, "d2", now)).toBe(false);
    expect(canWithdraw({ status: "active", designerId: "d1" }, open, null, now)).toBe(false);
    expect(canWithdraw({ status: "winner", designerId: "d1" }, open, "d1", now)).toBe(false);
    expect(canWithdraw({ status: "withdrawn", designerId: "d1" }, open, "d1", now)).toBe(false);
    expect(canWithdraw({ status: "active", designerId: "d1" }, { status: "judging", endsAt: open.endsAt }, "d1", now)).toBe(false);
    expect(canWithdraw({ status: "active", designerId: "d1" }, { status: "open", endsAt: new Date("2026-10-11T09:00:00Z") }, "d1", now)).toBe(false);
  });
});

describe("canVote (owner, 2026-10-11)", () => {
  const ctx = { contestOwnerId: "c1", entryDesignerId: "d1" };
  const v = (id: string, role: "client" | "designer" | "admin", status = "active") => ({ id, role, status });
  it("designers vote on other designers' designs, never their own", () => {
    expect(canVote(v("d2", "designer"), ctx)).toBe(true);
    expect(canVote(v("d1", "designer"), ctx)).toBe(false);
  });
  it("a client votes only in their own contest", () => {
    expect(canVote(v("c1", "client"), ctx)).toBe(true);
    expect(canVote(v("c2", "client"), ctx)).toBe(false);
  });
  it("never guests, admins or inactive accounts", () => {
    expect(canVote(null, ctx)).toBe(false);
    expect(canVote(v("a1", "admin"), ctx)).toBe(false);
    expect(canVote(v("d2", "designer", "suspended"), ctx)).toBe(false);
  });
});

describe("sortEntries (owner, 2026-10-11)", () => {
  const e = (number: number, over: Partial<{ status: "active" | "winner"; rating: number | null; upVotes: number; downVotes: number; commentCount: number }> = {}) => ({
    number,
    status: "active" as "active" | "winner",
    rating: null as number | null,
    upVotes: 0,
    downVotes: 0,
    commentCount: 0,
    ...over,
  });
  const list = [e(1, { rating: 3, upVotes: 5 }), e(2, { rating: 5, downVotes: 4 }), e(3, { commentCount: 7, upVotes: 1 }), e(4, { status: "winner", rating: 4 })];
  const order = (s: Parameters<typeof sortEntries>[1]) => sortEntries(list, s).map((x) => x.number);
  it("top rated by default, the winner first", () => expect(order("top")).toEqual([4, 2, 1, 3]));
  it("most liked, most disliked, most comments, newest", () => {
    expect(order("liked")).toEqual([1, 3, 2, 4]);
    expect(order("disliked")).toEqual([2, 4, 1, 3]);
    expect(order("comments")).toEqual([3, 2, 4, 1]);
    expect(order("newest")).toEqual([4, 3, 2, 1]);
  });
  it("knows its sort names", () => {
    expect(isEntrySort("liked")).toBe(true);
    expect(isEntrySort("random")).toBe(false);
  });
});
