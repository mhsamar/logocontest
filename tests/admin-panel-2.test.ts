import { describe, expect, it } from "vitest";
import { areaOfPath, firstAdminPage, isReadOnlyPage, navFor } from "@/lib/admin/nav";
import { ALL_PERMISSIONS, cleanPermissions, hasPermission, isActiveAdmin, PRESETS, type AdminIdentity } from "@/lib/admin/permissions";
import { countryOf, deviceOf, isBot, referrerHost, trackablePath } from "@/lib/analytics/rules";
import { cleanMessage, isAudience, preview } from "@/lib/support/rules";

const staff = (perms: string[], over: Partial<AdminIdentity> = {}): AdminIdentity => ({ role: "admin", status: "active", isSuperAdmin: false, adminActive: true, adminPermissions: perms, ...over });
const owner = staff([], { isSuperAdmin: true });

describe("staff permissions (BLUEPRINT §13.2)", () => {
  it("the Super admin can do everything; switched-off staff nothing", () => {
    for (const p of ALL_PERMISSIONS) expect(hasPermission(owner, p)).toBe(true);
    expect(isActiveAdmin(staff(["users.view"], { adminActive: false }))).toBe(false);
    expect(hasPermission(staff(["users.view"], { adminActive: false }), "users.view")).toBe(false);
    expect(isActiveAdmin(owner)).toBe(true);
    expect(isActiveAdmin({ ...owner, role: "designer" })).toBe(false);
  });

  it("manage includes view, view never includes manage", () => {
    expect(hasPermission(staff(["users.manage"]), "users.view")).toBe(true);
    expect(hasPermission(staff(["users.view"]), "users.manage")).toBe(false);
    expect(hasPermission(staff(["users.view"]), "settings.view")).toBe(false);
  });

  it("cleans submitted permissions: unknown ones dropped, view added for manage", () => {
    expect(cleanPermissions(["users.manage", "evil.manage", 3, "dashboard.manage"])).toEqual(["users.view", "users.manage"]);
    expect(cleanPermissions("nope")).toEqual([]);
  });

  it("presets only use real permissions; support can't touch money or settings", () => {
    for (const list of Object.values(PRESETS)) expect(cleanPermissions(list).length).toBe(new Set(list).size);
    const support = staff(PRESETS.support);
    expect(hasPermission(support, "support.manage")).toBe(true);
    expect(hasPermission(support, "withdrawals.manage")).toBe(false);
    expect(hasPermission(support, "settings.view")).toBe(false);
    expect(hasPermission(staff(PRESETS.manager), "settings.manage")).toBe(false);
  });

  it("the menu shows only allowed items; Admins & roles is the Super admin's", () => {
    const items = (u: AdminIdentity) => navFor(u).flatMap((g) => g.items.map((i) => i.href));
    expect(items(owner)).toContain("/admin/team");
    const support = items(staff(PRESETS.support));
    expect(support).toContain("/admin/support");
    expect(support).not.toContain("/admin/team");
    expect(support).not.toContain("/admin/settings");
    expect(firstAdminPage(staff(["support.view"]))).toBe("/admin/support");
  });

  it("finds a page's area and whether it is view-only", () => {
    expect(areaOfPath("/admin/users/123")).toBe("users");
    expect(areaOfPath("/admin")).toBe("dashboard");
    expect(areaOfPath("/admin/team")).toBeNull();
    expect(isReadOnlyPage(staff(["users.view"]), "/admin/users/1")).toBe(true);
    expect(isReadOnlyPage(staff(["users.manage"]), "/admin/users/1")).toBe(false);
    expect(isReadOnlyPage(staff(["live.view"]), "/admin/live")).toBe(false);
  });
});

describe("visit tracking (BLUEPRINT §13.2 item 3)", () => {
  it("counts public pages only, without query strings", () => {
    expect(trackablePath("/contests?type=food#x")).toBe("/contests");
    for (const p of ["/admin", "/admin/users", "/api/track", "/dev/x", "//evil.com", "contests", 5]) expect(trackablePath(p)).toBeNull();
  });

  it("keeps only the referring site's name, not our own", () => {
    expect(referrerHost("https://www.facebook.com/post/1?x=y", "logocontest.bd")).toBe("facebook.com");
    expect(referrerHost("https://logocontest.bd/contests", "logocontest.bd")).toBeNull();
    expect(referrerHost("not a url", null)).toBeNull();
  });

  it("tells devices and bots apart", () => {
    expect(deviceOf("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile")).toBe("mobile");
    expect(deviceOf("Mozilla/5.0 (iPad; CPU OS 17_0)")).toBe("tablet");
    expect(deviceOf("Mozilla/5.0 (Linux; Android 14; SM-X200)")).toBe("tablet");
    expect(deviceOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)")).toBe("desktop");
    expect(isBot("Googlebot/2.1")).toBe(true);
    expect(isBot("facebookexternalhit/1.1")).toBe(true);
    expect(countryOf("BD")).toBe("BD");
    expect(countryOf("XX")).toBeNull();
  });
});

describe("support chat and messages (BLUEPRINT §13.2 items 5–6)", () => {
  it("cleans messages and refuses empty or too long ones", () => {
    expect(cleanMessage("  Hello\r\nthere \u0007 ")).toBe("Hello\nthere");
    expect(cleanMessage("   ")).toBeNull();
    expect(cleanMessage("x".repeat(2001))).toBeNull();
    expect(cleanMessage(42)).toBeNull();
  });

  it("knows the audiences and makes short previews", () => {
    expect(isAudience("designers")).toBe(true);
    expect(isAudience("admins")).toBe(false);
    expect(preview("a\n\nb  c")).toBe("a b c");
    expect(preview("x".repeat(200)).length).toBe(120);
  });
});
