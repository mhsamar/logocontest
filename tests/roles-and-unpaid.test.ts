import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ADMIN_NAV } from "@/lib/admin/nav";
import { ADMIN_AREAS, AREA_LIST, hasPermission, isPermission, PRESETS } from "@/lib/admin/permissions";

// Owner, 2026-10-20: "tick boxes for every feature in Admins & roles, also the new ones".
describe("Admins & roles", () => {
  const form = readFileSync("src/components/admin/staff-form.tsx", "utf8");
  const grouped = [...form.slice(form.indexOf("const GROUPS"), form.indexOf("];", form.indexOf("const GROUPS"))).matchAll(/"([a-z]+)"/g)].map((m) => m[1]);

  it("every area has its tick boxes in the form (Pro plan was missing)", () => {
    for (const area of AREA_LIST) expect(grouped, area).toContain(area);
  });
  it("the new features have their own area, with View and Manage", () => {
    for (const area of ["autoshare", "services", "notifications", "trash", "unpaid"] as const) expect(ADMIN_AREAS[area].manage).toBe(true);
  });
  it("every admin page needs a permission that exists (or is for the Super admin)", () => {
    for (const g of ADMIN_NAV) for (const item of g.items) expect(item.perm === "super" || isPermission(item.perm), item.href).toBe(true);
    const perm = (href: string) => ADMIN_NAV.flatMap((g) => g.items).find((i) => i.href === href)?.perm;
    expect(perm("/admin/pinterest")).toBe("autoshare.view");
    expect(perm("/admin/contest-cards")).toBe("autoshare.view");
    expect(perm("/admin/services")).toBe("services.view");
    expect(perm("/admin/notifications")).toBe("notifications.view");
    expect(perm("/admin/trash")).toBe("trash.view");
  });
  it("ready-made roles only use real permissions", () => {
    for (const list of Object.values(PRESETS)) for (const p of list) expect(isPermission(p), p).toBe(true);
    const staff = { role: "admin", status: "active", isSuperAdmin: false, adminActive: true, adminPermissions: ["autoshare.view"] };
    expect(hasPermission(staff, "autoshare.view")).toBe(true);
    expect(hasPermission(staff, "autoshare.manage")).toBe(false);
  });
  it("each feature checks its own permission", () => {
    expect(readFileSync("src/lib/cards/actions.ts", "utf8")).toContain('adminUser("autoshare.manage")');
    expect(readFileSync("src/lib/pinterest/actions.ts", "utf8")).toContain('adminUser("autoshare.manage")');
    expect(readFileSync("src/lib/services/admin-actions.ts", "utf8")).toContain('adminUser("services.manage")');
    expect(readFileSync("src/lib/notifications/admin-actions.ts", "utf8")).toContain('adminUser("notifications.manage")');
    expect(readFileSync("src/lib/admin/trash-actions.ts", "utf8")).toContain('(await adminUser("trash.manage"))');
  });
});

describe("Admin › Unpaid contests", () => {
  const actions = readFileSync("src/lib/admin/unpaid-actions.ts", "utf8");
  it("call notes and Delete need Unpaid contests · manage; Delete only for unpaid contests, to the Trash with Undo", () => {
    expect(actions.match(/adminUser\("unpaid\.manage"\)/g)?.length).toBe(3);
    expect(actions).toContain('const UNPAID = ["draft", "pending_payment"]');
    expect(actions).toContain("trashContest(contestId, admin.id, REASON)");
    expect(actions).not.toMatch(/purge/);
    expect(readFileSync("src/components/admin/quick-delete.tsx", "utf8")).toContain('kind === "unpaid" ? await restoreUnpaidContest(id)');
  });
  it("the outcomes match the database's list", () => {
    const sql = readFileSync("supabase/migrations/0068_unpaid_notes.sql", "utf8");
    for (const o of ["mistake", "later", "restart", "help", "price", "no_answer", "not_interested", "other"]) expect(sql).toContain(`'${o}'`);
  });
  it("a contest waiting for payment counts as stopped at payment, and the advice never says 'stopped at —'", () => {
    const page = readFileSync("src/app/admin/unpaid/page.tsx", "utf8");
    expect(page).toContain('r.step ?? (r.status === "pending_payment" ? AT_PAYMENT : null)');
    expect(page).toContain('"admin.unpaid.next.unknownBody"');
  });
});
