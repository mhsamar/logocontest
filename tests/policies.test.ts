import { describe, expect, it } from "vitest";
import { can, type CurrentUser } from "@/lib/auth/policies";

const user = (over: Partial<CurrentUser>): CurrentUser => ({
  id: "u1",
  mobile: "+8801712345678",
  name: "Test",
  role: "client",
  status: "active",
  locale: "en",
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
