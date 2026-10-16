/**
 * The premium client workspace (owner, 2026-10-16; Design/client-premium): menu, tabs, contest stages and the main
 * action of each contest. Pure, so the pages and the tests share one source.
 */

// ---- The right-side menu (CLIENT-HANDOFF §1: this order) ----------------------------------------------------------

export const CLIENT_MENU = ["dashboard", "contests", "start", "review", "messages", "shortlist", "checks", "files", "payments", "profile", "settings", "help"] as const;
export type ClientMenuKey = (typeof CLIENT_MENU)[number];

export type MenuCounts = { contests: number; review: number; unread: number };
export type MenuItem = { key: ClientMenuKey; href: string; badge: { n: number; tone: "n" | "r" } | null };

/** Fixed links; "review" and "shortlist" go to the contest that needs them (see `menuLinks`). */
export const MENU_HREF: Record<ClientMenuKey, string> = {
  dashboard: "/client",
  contests: "/client/contests",
  start: "/start",
  review: "/client/contests",
  messages: "/client/messages",
  shortlist: "/client/contests",
  checks: "/dashboard/logo-checks",
  files: "/client/files",
  payments: "/client/payments",
  profile: "/client/profile",
  settings: "/dashboard/profile",
  help: "/support",
};

/**
 * The menu with its live counts: contests on My contests (grey), new designs on Designs to review and unread messages
 * on Messages (red). A count of 0 shows no badge.
 */
export function clientMenu(counts: MenuCounts, links: Partial<Record<ClientMenuKey, string>> = {}): MenuItem[] {
  const badge = (n: number, tone: "n" | "r") => (n > 0 ? { n, tone } : null);
  return CLIENT_MENU.map((key) => ({
    key,
    href: links[key] ?? MENU_HREF[key],
    badge: key === "contests" ? badge(counts.contests, "n") : key === "review" ? badge(counts.review, "r") : key === "messages" ? badge(counts.unread, "r") : null,
  }));
}

/** The avatar's red dot: something new to look at. */
export const hasNews = (counts: MenuCounts) => counts.review > 0 || counts.unread > 0;

// ---- Contest details tabs (deep-linkable with ?tab=) --------------------------------------------------------------

export const CONTEST_TABS = ["overview", "designs", "brief", "designers", "payment", "activity"] as const;
export type ContestTab = (typeof CONTEST_TABS)[number];

export const contestTab = (v: unknown): ContestTab => (CONTEST_TABS as readonly unknown[]).includes(v) ? (v as ContestTab) : "overview";

export const DESIGN_FILTERS = ["all", "shortlisted", "unrated", "checked"] as const;
export type DesignFilter = (typeof DESIGN_FILTERS)[number];
export const designFilter = (v: unknown): DesignFilter => (DESIGN_FILTERS as readonly unknown[]).includes(v) ? (v as DesignFilter) : "all";

/** A tab's link; extra query values (filter, sort, entry) are kept in a fixed order. */
export function contestHref(slug: string, tab: ContestTab = "overview", extra: Record<string, string | number | null | undefined> = {}): string {
  const q = new URLSearchParams();
  if (tab !== "overview") q.set("tab", tab);
  for (const [k, v] of Object.entries(extra)) if (v !== null && v !== undefined && v !== "" && !(k === "filter" && v === "all")) q.set(k, String(v));
  const s = q.toString();
  return `/client/contests/${encodeURIComponent(slug)}${s ? `?${s}` : ""}`;
}

type Query = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/**
 * Where an old client link to /dashboard/contests/<slug> goes now (notifications, emails and bookmarks keep working):
 * a design, a report, a filter or a sort opens the Designs tab; a payment result opens Payment & files.
 */
export function oldContestLink(slug: string, sp: Query): string {
  const entry = one(sp.entry);
  const report = one(sp.report);
  const filter = one(sp.filter);
  const sort = one(sp.sort);
  const payment = one(sp.payment);
  const won = one(sp.won);
  const tab: ContestTab = payment ? "payment" : entry || report || filter || sort ? "designs" : "overview";
  return contestHref(slug, tab, { filter: filter ? designFilter(filter) : undefined, sort, entry, report, won, payment });
}

/** Where an old /my-contests link goes now: the same tab, sort and search on My contests. */
export function oldMyContestsLink(sp: Query): string {
  const q = new URLSearchParams();
  const tab = one(sp.tab) === "done" ? "completed" : myTab(one(sp.tab));
  const sort = mySort(one(sp.sort));
  const search = one(sp.q)?.trim();
  if (tab !== "all") q.set("tab", tab);
  if (sort !== "action") q.set("sort", sort);
  if (search) q.set("q", search);
  const s = q.toString();
  return `/client/contests${s ? `?${s}` : ""}`;
}

// ---- My contests ---------------------------------------------------------------------------------------------------

export const MY_TABS = ["all", "open", "pick", "unpaid", "completed"] as const;
export type MyTab = (typeof MY_TABS)[number];
export const myTab = (v: unknown): MyTab => (MY_TABS as readonly unknown[]).includes(v) ? (v as MyTab) : "all";

/** Which My contests tab a contest belongs to. */
export function myTabOf(status: string): Exclude<MyTab, "all"> {
  if (status === "draft" || status === "pending_payment") return "unpaid";
  if (status === "judging") return "pick";
  if (status === "open") return "open";
  return "completed";
}

export const MY_SORTS = ["action", "newest", "prize", "designs"] as const;
export type MySort = (typeof MY_SORTS)[number];
export const mySort = (v: unknown): MySort => (MY_SORTS as readonly unknown[]).includes(v) ? (v as MySort) : "action";

// ---- The 6-step progress: Brief → Paid → Live → Judging → Winner → Files ---------------------------------------------

export const STAGES = ["brief", "paid", "live", "judging", "winner", "files"] as const;
export type StageState = "done" | "on" | "";

/** The state of each step for a contest status. */
export function contestStages(status: string): StageState[] {
  const at: Record<string, number> = { draft: 0, pending_payment: 0, open: 2, judging: 3, winner_selected: 5, handover: 5, completed: 6, no_result: 4, cancelled: -1 };
  const n = at[status] ?? 0;
  return STAGES.map((_, i) => (i < n ? "done" : i === n ? "on" : ""));
}

// ---- The main action on a contest card -----------------------------------------------------------------------------

export type ContestAction = "pay" | "review" | "pick" | "files" | "details";

/** The one thing to do next with a contest (CLIENT-HANDOFF §3). */
export function mainAction(status: string): ContestAction {
  if (status === "draft" || status === "pending_payment") return "pay";
  if (status === "open") return "review";
  if (status === "judging") return "pick";
  if (status === "winner_selected" || status === "handover" || status === "completed") return "files";
  return "details";
}

/** "Needs my action" order: pick a winner, then pay, then designs to rate, then final files, then the rest. */
export function actionRank(c: { status: string; unrated: number }): number {
  if (c.status === "judging") return 0;
  if (c.status === "draft" || c.status === "pending_payment") return 1;
  if (c.status === "open" && c.unrated > 0) return 2;
  if (c.status === "winner_selected" || c.status === "handover") return 3;
  if (c.status === "open") return 4;
  return 5;
}

// ---- Client profile privacy ------------------------------------------------------------------------------------------

/**
 * "Show my profile to designers" (CLIENT-HANDOFF §6): when it is off, only the client and the admin team see the
 * profile; everyone else gets "This profile is private".
 */
export function profileVisible(input: { hidden: boolean; viewerId: string | null | undefined; ownerId: string; staff: boolean }): boolean {
  return !input.hidden || input.viewerId === input.ownerId || input.staff;
}

/** "Verified client" only when the existing verification passed: the email address was confirmed. */
export const verifiedClient = (emailVerifiedAt: string | Date | null | undefined) => Boolean(emailVerifiedAt);

// ---- Short times: "5m", "3h", "2d" and "5 days left" -------------------------------------------------------------

/** Minutes, hours or days since a moment, as a number and a unit. */
export function agoParts(at: Date, now: Date): { n: number; unit: "m" | "h" | "d" } {
  const m = Math.max(1, Math.round((now.getTime() - at.getTime()) / 60_000));
  if (m < 60) return { n: m, unit: "m" };
  if (m < 1440) return { n: Math.round(m / 60), unit: "h" };
  return { n: Math.round(m / 1440), unit: "d" };
}

/** Whole days (or hours, under a day) until a moment; null once it has passed. */
export function leftParts(end: Date | null, now: Date): { n: number; unit: "d" | "h" } | null {
  if (!end) return null;
  const h = (end.getTime() - now.getTime()) / 3_600_000;
  if (h <= 0) return null;
  return h >= 24 ? { n: Math.floor(h / 24), unit: "d" } : { n: Math.max(1, Math.floor(h)), unit: "h" };
}

/** How far a contest is along its 6 steps, as a share for the thin progress bar. */
export function progressShare(status: string): number {
  const states = contestStages(status);
  const done = states.filter((s) => s === "done").length;
  return Math.round(((done + (states.includes("on") ? 0.5 : 0)) / states.length) * 100);
}
