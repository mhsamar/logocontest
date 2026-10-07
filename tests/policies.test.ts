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
