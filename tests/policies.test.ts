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
  isSuperAdmin: false,
  adminActive: true,
  adminPermissions: [],
  adminTitle: null,
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

describe("contest.comment (owner, 2026-10-11)", () => {
  it("allows the contest's own client and designers who submitted to it", () => {
    expect(can(user({ id: "owner" }), "contest.comment", { contestOwnerId: "owner" })).toBe(true);
    expect(can(user({ id: "other" }), "contest.comment", { contestOwnerId: "owner" })).toBe(false);
    expect(can(user({ role: "designer" }), "contest.comment", { contestOwnerId: "owner", viewerHasEntry: true })).toBe(true);
    expect(can(user({ role: "designer" }), "contest.comment", { contestOwnerId: "owner", viewerHasEntry: false })).toBe(false);
    expect(can(user({ role: "designer", status: "suspended" }), "contest.comment", { contestOwnerId: "owner", viewerHasEntry: true })).toBe(false);
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

describe("entry.comment (owner, 2026-10-11)", () => {
  const ctx = { contestOwnerId: "c1", entryDesignerId: "d2" };
  it("lets the contest's client comment, not other clients", () => {
    expect(can(user({ id: "c1", role: "client" }), "entry.comment", ctx)).toBe(true);
    expect(can(user({ id: "c9", role: "client" }), "entry.comment", ctx)).toBe(false);
  });
  it("lets a designer comment only on their own design", () => {
    expect(can(user({ id: "d2", role: "designer" }), "entry.comment", ctx)).toBe(true);
    expect(can(user({ id: "d1", role: "designer" }), "entry.comment", { ...ctx, viewerHasEntry: true })).toBe(false);
  });
  it("never guests, admins or inactive users", () => {
    expect(can(null, "entry.comment", ctx)).toBe(false);
    expect(can(user({ id: "a1", role: "admin" }), "entry.comment", ctx)).toBe(false);
    expect(can(user({ id: "c1", role: "client", status: "suspended" }), "entry.comment", ctx)).toBe(false);
  });
});
