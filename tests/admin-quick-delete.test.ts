import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// One-click delete in Admin › Contests and Admin › Users (owner, 2026-10-18).
describe("admin one-click delete", () => {
  const actions = readFileSync("src/lib/admin/trash-actions.ts", "utf8");

  it("goes to the Trash with the same permission and rules as Delete, and is in the audit log", () => {
    const contest = actions.slice(actions.indexOf("export async function quickDeleteContest"), actions.indexOf("export async function restoreContestFromTrash"));
    expect(contest).toContain('adminUser("contests.manage")');
    expect(contest).toContain("trashContest(");
    expect(contest).toContain('audit(admin.id, "trash_contest"');
    const user = actions.slice(actions.indexOf("export async function quickDeleteUser"), actions.indexOf("export async function restoreUserFromTrash"));
    expect(user).toContain('adminUser("users.manage")');
    // trashUser keeps every guard: admins, yourself, live contests, files to deliver, wallet money.
    expect(user).toContain("trashUser(");
    expect(user).toContain('audit(admin.id, "trash_user"');
    expect(actions).not.toMatch(/quickDelete\w*[\s\S]{0,400}purge/);
  });

  it("the toast offers Undo, which restores from the Trash", () => {
    const ui = readFileSync("src/components/admin/quick-delete.tsx", "utf8");
    expect(ui).toContain("restoreContestFromTrash(id)");
    expect(ui).toContain("restoreUserFromTrash(id)");
    expect(ui).toContain('t("admin.trash.quick.undo")');
  });

  it("only staff who may delete see the icon; never on admins or yourself", () => {
    const contests = readFileSync("src/app/admin/contests/page.tsx", "utf8");
    expect(contests).toContain('hasPermission(admin, "contests.manage")');
    const users = readFileSync("src/components/admin/users-board.tsx", "utf8");
    expect(users).toContain('u.role !== "admin" && u.id !== meId && <QuickDelete');
    // Clicking the icon never opens the row.
    expect(users).toContain('closest("a,button")');
  });
});
