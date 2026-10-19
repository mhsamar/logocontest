import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { proMenu } from "@/lib/pro/menu";

// Phone menu (owner, 2026-10-20): "Saved contests, wallet, profile settings missing on mobile" for designers and clients.
describe("phone menu", () => {
  it("a Pro designer's phone menu has every workspace page, Saved, Wallet and Settings included", () => {
    const all = proMenu({ username: "das006" }, { client_chat: true, insights: true, priority_support: true }).map((i) => i.href);
    expect(all).toEqual(["/dashboard", "/dashboard/contests", "/dashboard/saved", "/dashboard/messages", "/dashboard/insights", "/dashboard/logo-checks", "/dashboard/wallet", "/designer/das006", "/dashboard/profile", "/dashboard/support"]);
    const basic = proMenu({ username: null }, { client_chat: false, insights: false, priority_support: false }).map((i) => i.key);
    expect(basic).toEqual(expect.arrayContaining(["saved", "wallet", "settings"]));
    expect(basic).not.toContain("messages");
  });
  it("the site menu uses the full lists on phones (Pro too); the client workspace menu has its pages and Log out", () => {
    const nav = readFileSync("src/components/layout/site-nav.tsx", "utf8");
    expect(nav).toMatch(/drawerItems = user \? \(pro \? proMenu\(/);
    expect(nav).toContain("<DrawerAccount");
    const shell = readFileSync("src/components/client/shell.tsx", "utf8");
    expect(shell).toMatch(/<SiteNavDrawer[\s\S]*<DrawerAccount[\s\S]*action=\{logout\}[\s\S]*<\/SiteNavDrawer>/);
    // The Pro workspace's own menu uses the same list.
    expect(readFileSync("src/components/pro/workspace.tsx", "utf8")).toContain("proMenu(user, f)");
  });
});
