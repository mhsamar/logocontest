/**
 * Admin → Users filters (owner, 2026-10-12; Design/users): role tab, status chip, "Show" chips, search, sort and
 * page, all in the URL. Pure: used by the page, the CSV export and the tests.
 */

export const USER_ROLES = ["all", "client", "designer", "admin"] as const;
export const USER_STATUSES = ["all", "active", "suspended", "banned"] as const;
/** "look" is the Need a look count: suspended, banned, 2+ strikes, or (while the agreement is required) an agreement
 * without an ID photo. "unverified", "nophoto", "incomplete": profile reminders (owner, 2026-10-22). */
export const USER_SHOWS = ["online", "strikes", "new", "look", "unverified", "nophoto", "incomplete"] as const;
export const USER_SORTS = ["newest", "active", "spent", "wins"] as const;
export const USERS_PER_PAGE = 20;
/** Online now: active in the last 5 minutes (the same rule as the live designers tag). */
export const ONLINE_MS = 5 * 60_000;
/** One strike away from the automatic ban (owner, 2026-10-12: 3 strikes in 45 days = ban). */
export const LOOK_STRIKES = 2;

export type UsersQuery = {
  role: (typeof USER_ROLES)[number];
  status: (typeof USER_STATUSES)[number];
  show: (typeof USER_SHOWS)[number][];
  q: string;
  sort: (typeof USER_SORTS)[number];
  page: number;
};

const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fallback);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseUsersQuery(sp: Record<string, string | string[] | undefined>): UsersQuery {
  const asked = new Set((one(sp.show) ?? "").split(","));
  return {
    role: pick(USER_ROLES, one(sp.role), "all"),
    status: pick(USER_STATUSES, one(sp.status), "all"),
    show: USER_SHOWS.filter((s) => asked.has(s)),
    q: (one(sp.q) ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
    sort: pick(USER_SORTS, one(sp.sort), "newest"),
    page: Math.max(1, Math.min(10_000, Number.parseInt(one(sp.page) ?? "1", 10) || 1)),
  };
}

/** A /admin/users link with the defaults left out; a filter change goes back to page 1. */
export function usersHref(q: UsersQuery, change: Partial<UsersQuery> = {}, base = "/admin/users"): string {
  const n = { ...q, ...change };
  if (!("page" in change)) n.page = 1;
  const p = new URLSearchParams();
  if (n.role !== "all") p.set("role", n.role);
  if (n.status !== "all") p.set("status", n.status);
  if (n.show.length) p.set("show", USER_SHOWS.filter((s) => n.show.includes(s)).join(","));
  if (n.q) p.set("q", n.q);
  if (n.sort !== "newest") p.set("sort", n.sort);
  if (n.page > 1) p.set("page", String(n.page));
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

export const toggleShow = (list: UsersQuery["show"], s: UsersQuery["show"][number]) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]);

/** A spreadsheet cell: quoted, and never read as a formula (=, +, -, @ at the start). */
export function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}
