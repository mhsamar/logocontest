import { describe, expect, it } from "vitest";
import { canSeeEntry, entryScope, showDesignerName, type ContestForEntries } from "@/lib/entries/rules";

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
