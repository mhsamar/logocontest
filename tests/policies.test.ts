import { describe, expect, it } from "vitest";
import { can, type CurrentUser } from "@/lib/auth/policies";

const user = (over: Partial<CurrentUser>): CurrentUser => ({
  id: "u1",
  mobile: "+8801712345678",
  name: "Test",
  role: "client",
  status: "active",
  locale: "en",
  email: null,
  emailVerifiedAt: null,
  username: null,
  avatarUrl: null,
  ...over,
});

describe("admin.access", () => {
  it("allows active admins only", () => {
    expect(can(user({ role: "admin" }), "admin.access")).toBe(true);
    expect(can(user({ role: "admin", status: "suspended" }), "admin.access")).toBe(false);
    expect(can(user({ role: "admin", status: "banned" }), "admin.access")).toBe(false);
    expect(can(user({ role: "client" }), "admin.access")).toBe(false);
    expect(can(user({ role: "designer" }), "admin.access")).toBe(false);
    expect(can(null, "admin.access")).toBe(false);
  });
});

describe("contest.comment", () => {
  it("allows the contest's own client and any active designer", () => {
    expect(can(user({ id: "owner" }), "contest.comment", { contestOwnerId: "owner" })).toBe(true);
    expect(can(user({ id: "other" }), "contest.comment", { contestOwnerId: "owner" })).toBe(false);
    expect(can(user({ role: "designer" }), "contest.comment", { contestOwnerId: "owner" })).toBe(true);
    expect(can(user({ role: "designer", status: "suspended" }), "contest.comment", { contestOwnerId: "owner" })).toBe(false);
    expect(can(user({ role: "admin" }), "contest.comment", { contestOwnerId: "owner" })).toBe(false);
    expect(can(null, "contest.comment", { contestOwnerId: "owner" })).toBe(false);
  });
});

describe("contest.save", () => {
  it("is for active designers", () => {
    expect(can(user({ role: "designer" }), "contest.save")).toBe(true);
    expect(can(user({ role: "designer", status: "banned" }), "contest.save")).toBe(false);
    expect(can(user({ role: "client" }), "contest.save")).toBe(false);
    expect(can(null, "contest.save")).toBe(false);
  });
});

describe("entry.comment (owner, 2026-10-08)", () => {
  const open = { contestOwnerId: "c1", isBlind: false, entryDesignerId: "d2" };
  it("lets the contest's client comment", () => {
    expect(can(user({ id: "c1", role: "client" }), "entry.comment", open)).toBe(true);
    expect(can(user({ id: "c9", role: "client" }), "entry.comment", open)).toBe(false);
  });
  it("lets designers who submitted to the contest comment", () => {
    expect(can(user({ id: "d1", role: "designer" }), "entry.comment", { ...open, viewerHasEntry: true })).toBe(true);
    expect(can(user({ id: "d1", role: "designer" }), "entry.comment", { ...open, viewerHasEntry: false })).toBe(false);
  });
  it("in a blind contest, only the design's own designer", () => {
    const blind = { ...open, isBlind: true, viewerHasEntry: true };
    expect(can(user({ id: "d2", role: "designer" }), "entry.comment", blind)).toBe(true);
    expect(can(user({ id: "d1", role: "designer" }), "entry.comment", blind)).toBe(false);
  });
  it("never guests or inactive users", () => {
    expect(can(null, "entry.comment", open)).toBe(false);
    expect(can(user({ id: "c1", role: "client", status: "suspended" }), "entry.comment", open)).toBe(false);
  });
});
