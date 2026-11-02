import { describe, expect, it, vi } from "vitest";

// Owner, 2026-11-02: a Super admin can do the client's work on the client's contest page; nobody else can.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/core", () => ({ audit: vi.fn() }));
const { actorFor } = await import("@/lib/admin/act-as-client");

describe("acting for the client", () => {
  const client = { id: "c1", role: "client", status: "active" };
  it("the client themselves, or a Super admin in the client's name", () => {
    expect(actorFor(client, "c1")).toEqual({ clientId: "c1", adminId: null });
    expect(actorFor({ id: "a1", role: "admin", status: "active", isSuperAdmin: true }, "c1")).toEqual({ clientId: "c1", adminId: "a1" });
  });
  it("never another client, a designer, other staff, a banned account or nobody", () => {
    expect(actorFor({ ...client, id: "c2" }, "c1")).toBeNull();
    expect(actorFor({ id: "d1", role: "designer", status: "active" }, "c1")).toBeNull();
    expect(actorFor({ id: "a2", role: "admin", status: "active", isSuperAdmin: false }, "c1")).toBeNull();
    expect(actorFor({ ...client, status: "banned" }, "c1")).toBeNull();
    expect(actorFor(null, "c1")).toBeNull();
  });
});
