import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The premium client workspace (owner, 2026-10-16; Design/client-premium/CLIENT-HANDOFF.md).

const logout = vi.fn(async () => {});
vi.mock("@/lib/auth/actions", () => ({ logout }));

const currentUser = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: () => currentUser() }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
const updates: { values: Record<string, unknown>; id: string }[] = [];
let updateError: { message: string } | null = null;
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      update: (values: Record<string, unknown>) => ({
        eq: async (_col: string, id: string) => {
          updates.push({ values, id });
          return { error: updateError };
        },
      }),
    }),
  }),
}));

const { avatarMenuReducer, AvatarMenuPanel, initialsOf } = await import("@/components/client/avatar-menu");
const { setProfileShown } = await import("@/lib/client/actions");
const rules = await import("@/lib/client/rules");
const { canUseContestChat, messageFlags } = await import("@/lib/pro/rules");

describe("menu counts", () => {
  it("keeps the order from the handoff", () => {
    expect(rules.clientMenu({ contests: 0, review: 0, unread: 0 }).map((i) => i.key)).toEqual([
      "dashboard",
      "contests",
      "start",
      "review",
      "messages",
      "shortlist",
      "checks",
      "files",
      "payments",
      "profile",
      "settings",
      "help",
    ]);
  });
  it("shows live counts on My contests, Review designs and Messages only", () => {
    const menu = rules.clientMenu({ contests: 4, review: 12, unread: 3 });
    const badge = (k: string) => menu.find((i) => i.key === k)?.badge ?? null;
    expect(badge("contests")).toEqual({ n: 4, tone: "n" });
    expect(badge("review")).toEqual({ n: 12, tone: "r" });
    expect(badge("messages")).toEqual({ n: 3, tone: "r" });
    for (const k of ["dashboard", "start", "shortlist", "checks", "files", "payments", "profile", "settings", "help"]) expect(badge(k)).toBeNull();
  });
  it("hides a count of zero", () => {
    const menu = rules.clientMenu({ contests: 0, review: 0, unread: 0 });
    expect(menu.every((i) => i.badge === null)).toBe(true);
  });
  it("links each item to its page; review and shortlist can point at the right contest", () => {
    const menu = rules.clientMenu({ contests: 1, review: 1, unread: 0 }, { review: "/client/contests/abc?tab=designs&filter=unrated" });
    const href = (k: string) => menu.find((i) => i.key === k)?.href;
    expect(href("dashboard")).toBe("/client");
    expect(href("contests")).toBe("/client/contests");
    expect(href("messages")).toBe("/client/messages");
    expect(href("profile")).toBe("/client/profile");
    // Owner, 2026-10-17: Logo checks, Settings and Help stay inside the workspace, so the menu never disappears.
    expect(href("checks")).toBe("/client/checks");
    expect(href("settings")).toBe("/client/settings");
    expect(href("help")).toBe("/client/help");
    expect(menu.every((i) => i.key === "start" || i.href.startsWith("/client"))).toBe(true);
    expect(href("review")).toBe("/client/contests/abc?tab=designs&filter=unrated");
  });
  it("the menu marks the open page from its address, on every page that shows the workspace", () => {
    expect(rules.menuKeyForPath("/client")).toBe("dashboard");
    expect(rules.menuKeyForPath("/client/")).toBe("dashboard");
    expect(rules.menuKeyForPath("/client/contests")).toBe("contests");
    expect(rules.menuKeyForPath("/client/contests/nodi-tea?tab=designs")).toBe("contests");
    expect(rules.menuKeyForPath("/client/messages")).toBe("messages");
    expect(rules.menuKeyForPath("/client/checks")).toBe("checks");
    expect(rules.menuKeyForPath("/client/settings")).toBe("settings");
    expect(rules.menuKeyForPath("/client/help")).toBe("help");
    expect(rules.menuKeyForPath("/start")).toBe("start");
    expect(rules.menuKeyForPath("/start/invite")).toBe("start");
    expect(rules.menuKeyForPath("/start/social_post")).toBe("start");
    expect(rules.menuKeyForPath("/pay/contest/abc")).toBe("payments");
    expect(rules.menuKeyForPath("/dashboard/contests/nodi/edit")).toBe("contests");
    expect(rules.menuKeyForPath("/notifications")).toBeNull();
    expect(rules.menuKeyForPath("/clientele")).toBeNull();
    expect(rules.menuKeyForPath("/starting")).toBeNull();
  });

  it("the avatar's red dot shows only when there are new designs or unread messages", () => {
    expect(rules.hasNews({ contests: 5, review: 0, unread: 0 })).toBe(false);
    expect(rules.hasNews({ contests: 0, review: 1, unread: 0 })).toBe(true);
    expect(rules.hasNews({ contests: 0, review: 0, unread: 2 })).toBe(true);
  });
});

describe("contest tabs deep links", () => {
  it("opens the tab named in ?tab=, Overview otherwise", () => {
    for (const t of ["overview", "designs", "brief", "designers", "payment", "activity"]) expect(rules.contestTab(t)).toBe(t);
    expect(rules.contestTab("nope")).toBe("overview");
    expect(rules.contestTab(undefined)).toBe("overview");
    expect(rules.contestTab(["designs"])).toBe("overview");
  });
  it("builds the link for each tab, without tab=overview or filter=all", () => {
    expect(rules.contestHref("nodi-tea")).toBe("/client/contests/nodi-tea");
    expect(rules.contestHref("nodi-tea", "overview")).toBe("/client/contests/nodi-tea");
    expect(rules.contestHref("nodi-tea", "designs")).toBe("/client/contests/nodi-tea?tab=designs");
    expect(rules.contestHref("nodi-tea", "designs", { filter: "all" })).toBe("/client/contests/nodi-tea?tab=designs");
    expect(rules.contestHref("nodi-tea", "designs", { filter: "unrated", entry: 7 })).toBe("/client/contests/nodi-tea?tab=designs&filter=unrated&entry=7");
    expect(rules.contestHref("nodi-tea", "payment")).toBe("/client/contests/nodi-tea?tab=payment");
  });
  it("design filters fall back to All", () => {
    expect(rules.designFilter("shortlisted")).toBe("shortlisted");
    expect(rules.designFilter("rejected")).toBe("all");
  });
  it("old links to the client's contest page open the right tab", () => {
    expect(rules.oldContestLink("nodi", {})).toBe("/client/contests/nodi");
    expect(rules.oldContestLink("nodi", { entry: "12" })).toBe("/client/contests/nodi?tab=designs&entry=12");
    expect(rules.oldContestLink("nodi", { filter: "unrated" })).toBe("/client/contests/nodi?tab=designs&filter=unrated");
    expect(rules.oldContestLink("nodi", { filter: "rejected" })).toBe("/client/contests/nodi?tab=designs");
    expect(rules.oldContestLink("nodi", { report: "3" })).toBe("/client/contests/nodi?tab=designs&report=3");
    expect(rules.oldContestLink("nodi", { payment: "paid" })).toBe("/client/contests/nodi?tab=payment&payment=paid");
    expect(rules.oldContestLink("nodi", { won: "4" })).toBe("/client/contests/nodi?won=4");
  });
  it("old My contests links keep their tab, sort and search", () => {
    expect(rules.oldMyContestsLink({})).toBe("/client/contests");
    expect(rules.oldMyContestsLink({ tab: "done" })).toBe("/client/contests?tab=completed");
    expect(rules.oldMyContestsLink({ tab: "pick", sort: "newest", q: " Nodi " })).toBe("/client/contests?tab=pick&sort=newest&q=Nodi");
    expect(rules.oldMyContestsLink({ tab: "x", sort: "ending" })).toBe("/client/contests");
  });
  it("My contests tabs filter by status", () => {
    expect(rules.myTabOf("open")).toBe("open");
    expect(rules.myTabOf("judging")).toBe("pick");
    expect(rules.myTabOf("draft")).toBe("unpaid");
    expect(rules.myTabOf("pending_payment")).toBe("unpaid");
    expect(rules.myTabOf("completed")).toBe("completed");
    expect(rules.myTab("unpaid")).toBe("unpaid");
    expect(rules.myTab("nope")).toBe("all");
  });
});

describe("chat access rule", () => {
  const base = {
    viewerId: "client-1",
    contestClientId: "client-1",
    entryDesignerId: "designer-1",
    entryContestId: "contest-1",
    contestId: "contest-1",
    designerIsPro: true,
    designerAllowsMessages: true,
    featureOn: true,
  };
  it("the contest's client and the designer of that entry may chat", () => {
    expect(canUseContestChat(base)).toBe(true);
    expect(canUseContestChat({ ...base, viewerId: "designer-1" })).toBe(true);
  });
  it("nobody else may: another client, another designer, or an entry from another contest", () => {
    expect(canUseContestChat({ ...base, viewerId: "client-2" })).toBe(false);
    expect(canUseContestChat({ ...base, viewerId: "designer-2" })).toBe(false);
    expect(canUseContestChat({ ...base, entryContestId: "contest-2" })).toBe(false);
  });
  it("closed when the feature is off, the designer is not Pro (or trial), or turned client messages off", () => {
    expect(canUseContestChat({ ...base, featureOn: false })).toBe(false);
    expect(canUseContestChat({ ...base, designerIsPro: false })).toBe(false);
    expect(canUseContestChat({ ...base, designerAllowsMessages: false })).toBe(false);
  });
  it("warns on phone numbers, emails and payment words", () => {
    expect(messageFlags("call me 01712-345678")).toContain("phone");
    expect(messageFlags("mail me at a.b@gmail.com")).toContain("email");
    expect(messageFlags("send the bkash payment")).toContain("payment");
    expect(messageFlags("বিকাশে টাকা পাঠান")).toContain("payment");
    expect(messageFlags("Can you try a darker green?")).toEqual([]);
  });
});

describe("profile privacy switch", () => {
  beforeEach(() => {
    updates.length = 0;
    updateError = null;
  });
  it("a hidden profile is seen only by its owner and the admin team", () => {
    expect(rules.profileVisible({ hidden: false, viewerId: null, ownerId: "c1", staff: false })).toBe(true);
    expect(rules.profileVisible({ hidden: true, viewerId: null, ownerId: "c1", staff: false })).toBe(false);
    expect(rules.profileVisible({ hidden: true, viewerId: "someone", ownerId: "c1", staff: false })).toBe(false);
    expect(rules.profileVisible({ hidden: true, viewerId: "c1", ownerId: "c1", staff: false })).toBe(true);
    expect(rules.profileVisible({ hidden: true, viewerId: "admin", ownerId: "c1", staff: true })).toBe(true);
  });
  it("switch off hides the profile, switch on shows it, for the signed-in client only", async () => {
    currentUser.mockResolvedValue({ id: "c1", role: "client", status: "active" });
    expect(await setProfileShown(false)).toEqual({ ok: true });
    expect(await setProfileShown(true)).toEqual({ ok: true });
    expect(updates).toEqual([
      { values: { profile_hidden: true }, id: "c1" },
      { values: { profile_hidden: false }, id: "c1" },
    ]);
  });
  it("designers, guests and banned clients cannot change it", async () => {
    for (const u of [null, { id: "d1", role: "designer", status: "active" }, { id: "c2", role: "client", status: "banned" }]) {
      currentUser.mockResolvedValue(u);
      expect((await setProfileShown(false)).ok).toBe(false);
    }
    expect(updates).toEqual([]);
  });
  it("says the setting is not ready while the column is missing", async () => {
    currentUser.mockResolvedValue({ id: "c1", role: "client", status: "active" });
    updateError = { message: 'column "profile_hidden" of relation "profiles" does not exist' };
    expect(await setProfileShown(false)).toEqual({ ok: false, error: "cw.profile.notReady" });
  });
  it("shows Verified client only when the email was verified", () => {
    expect(rules.verifiedClient("2026-10-01T00:00:00Z")).toBe(true);
    expect(rules.verifiedClient(null)).toBe(false);
    expect(rules.verifiedClient(undefined)).toBe(false);
  });
});

describe("avatar dropdown and log out", () => {
  it("the photo opens and closes it; outside, Escape and a new page close it", () => {
    expect(avatarMenuReducer(false, "toggle")).toBe(true);
    expect(avatarMenuReducer(true, "toggle")).toBe(false);
    for (const e of ["outside", "escape", "navigate"] as const) {
      expect(avatarMenuReducer(true, e)).toBe(false);
      expect(avatarMenuReducer(false, e)).toBe(false);
    }
  });
  it("holds only the name, the business name and Log out", () => {
    const html = renderToStaticMarkup(createElement(AvatarMenuPanel, { name: "Rafiq Ahmed", business: "Nodi Tea House", avatarUrl: null, logoutLabel: "Log out", action: logout, open: true }));
    expect(html).toContain("Rafiq Ahmed");
    expect(html).toContain("Nodi Tea House");
    expect(html).toContain("Log out");
    expect(html).toContain('class="cdd open"');
    expect(html.match(/<a /g)).toBeNull();
    expect(html.match(/<button/g)?.length).toBe(1);
    expect(html).toMatch(/<form[^>]*>.*<button type="submit"[^>]*data-logout/);
    expect(html).not.toMatch(/@|\+?880|01\d{9}/);
  });
  it("is closed until the photo is clicked, and works without a business name", () => {
    const html = renderToStaticMarkup(createElement(AvatarMenuPanel, { name: "Rafiq", business: null, avatarUrl: null, logoutLabel: "Log out", action: logout, open: false }));
    expect(html).toContain('class="cdd"');
    expect(html).not.toContain("<em>");
  });
  it("the Log out button runs the existing logout action", async () => {
    const el = AvatarMenuPanel({ name: "R", business: null, avatarUrl: null, logoutLabel: "Log out", action: logout, open: true });
    const form = (el.props.children as React.ReactElement<{ action: () => Promise<void> }>[]).find((c) => c?.type === "form");
    await form?.props.action();
    expect(logout).toHaveBeenCalled();
  });
  it("shows initials when there is no photo", () => {
    expect(initialsOf("Rafiq Ahmed")).toBe("RA");
    expect(initialsOf("  ")).toBe("?");
  });
});
