import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { toAsciiDigits } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { one } from "./core";
import { avatarUrl } from "@/lib/profile/avatar";
import { LOOK_STRIKES, ONLINE_MS, USERS_PER_PAGE, type UsersQuery } from "./users-query";

/** A-05 Users (BLUEPRINT §13.2). */
export type AdminUserRow = {
  id: string;
  name: string;
  username: string | null;
  role: "client" | "designer" | "admin";
  status: "active" | "suspended" | "banned" | "deleted";
  mobile: string;
  email: string | null;
  strikes: number;
  flagWarnings: number;
  /** "This number is on WhatsApp" (owner, 2026-10-14). */
  whatsapp: boolean;
  /** A test account (owner, 2026-10-11): never counted in the monthly race. */
  isTest: boolean;
  createdAt: Date;
};

const COLUMNS = "id, name, username, role, status, mobile, email, strikes, flag_warnings, is_test, created_at, suspended_until, whatsapp";
const PAGE = 30;

const toRow = (r: Record<string, unknown>): AdminUserRow => ({
  id: r.id as string,
  name: r.name as string,
  username: (r.username as string | null) ?? null,
  role: r.role as AdminUserRow["role"],
  // A suspension whose time is up counts as active at once (owner, 2026-10-12: it ends on its own).
  status: r.status === "suspended" && r.suspended_until && new Date(r.suspended_until as string).getTime() <= Date.now() ? "active" : (r.status as AdminUserRow["status"]),
  mobile: r.mobile as string,
  email: (r.email as string | null) ?? null,
  strikes: (r.strikes as number) ?? 0,
  flagWarnings: (r.flag_warnings as number) ?? 0,
  whatsapp: r.whatsapp === true,
  isTest: Boolean(r.is_test),
  createdAt: new Date(r.created_at as string),
});

export async function listUsers(q: { search: string; role: string; status: string; page: number }): Promise<{ rows: AdminUserRow[]; total: number; pages: number }> {
  if (!isSupabaseConfigured()) return { rows: [], total: 0, pages: 0 };
  let query = createAdminClient().from("profiles").select(COLUMNS, { count: "exact" }).neq("status", "deleted");
  if (["client", "designer", "admin"].includes(q.role)) query = query.eq("role", q.role);
  if (["active", "suspended", "banned"].includes(q.status)) query = query.eq("status", q.status);
  const term = toAsciiDigits(q.search).trim().replace(/[%,()]/g, "");
  if (term) {
    // Mobile numbers are stored as +8801…; "017…" should still find them.
    const digits = term.replace(/\D/g, "").replace(/^0/, "");
    const ors = [`name.ilike.%${term}%`, `username.ilike.%${term}%`, `email.ilike.%${term}%`];
    if (digits.length >= 4) ors.push(`mobile.ilike.%${digits}%`);
    query = query.or(ors.join(","));
  }
  const from = (q.page - 1) * PAGE;
  const { data, count } = await query.order("created_at", { ascending: false }).range(from, from + PAGE - 1);
  return { rows: (data ?? []).map(toRow), total: count ?? 0, pages: Math.max(1, Math.ceil((count ?? 0) / PAGE)) };
}

export type AdminUserDetail = AdminUserRow & {
  suspendedUntil: Date | null;
  /** In the Trash (owner, 2026-10-14). */
  trash: { at: Date; reason: string | null } | null;
  businessName: string | null;
  balance: number | null;
  strikeHistory: { id: string; reason: string; issuerRole: string; issuer: string | null; contest: { slug: string; brand: string } | null; createdAt: Date; removedAt: Date | null }[];
  contests: { slug: string; brand: string; status: string; createdAt: Date }[];
  entries: { slug: string; brand: string; number: number; status: string; createdAt: Date }[];
  /** The profile page's extra facts (design/admin/user-profile.html, owner 2026-10-10). */
  bio: string | null;
  designer: {
    entries: number;
    wins: number;
    ratings: Record<1 | 2 | 3 | 4 | 5, number>;
    payoutType: "bkash" | "bank" | null;
    agreedAt: Date | null;
    withdrawals: { amount: number; status: string; method: string; createdAt: Date }[];
    waiting: number;
    paidOut: number;
  } | null;
};

export async function getUser(id: string): Promise<AdminUserDetail | null> {
  if (!isSupabaseConfigured() || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = createAdminClient();
  const { data: p } = await db.from("profiles").select(`${COLUMNS}, business_name, bio, deleted_at, delete_reason`).eq("id", id).maybeSingle();
  if (!p) return null;
  const isDesigner = p.role === "designer";
  const head = { count: "exact" as const, head: true };
  const none = Promise.resolve({ data: null, count: null });
  const [strikes, contests, entries, balance, entryCount, winCount, ratings, payout, agreement, withdrawals] = await Promise.all([
    db.from("strikes").select("id, reason, issuer_role, created_at, removed_at, issuer:profiles!issued_by(name), contest:contests!contest_id(slug, brand_name)").eq("user_id", id).order("created_at", { ascending: false }),
    p.role === "client" ? db.from("contests").select("slug, brand_name, status, created_at").eq("client_id", id).order("created_at", { ascending: false }).limit(30) : Promise.resolve({ data: [] }),
    p.role === "designer"
      ? db.from("entries").select("number, status, created_at, contest:contests!contest_id(slug, brand_name)").eq("designer_id", id).order("created_at", { ascending: false }).limit(30)
      : Promise.resolve({ data: [] }),
    p.role === "designer" ? db.rpc("wallet_balance", { p_designer_id: id }) : Promise.resolve({ data: null }),
    isDesigner ? db.from("entries").select("id", head).eq("designer_id", id) : none,
    isDesigner ? db.from("entries").select("id", head).eq("designer_id", id).eq("status", "winner") : none,
    isDesigner ? db.from("entries").select("rating").eq("designer_id", id).not("rating", "is", null).limit(1000) : none,
    isDesigner ? db.from("designer_payout_methods").select("type").eq("user_id", id).eq("is_default", true).maybeSingle() : none,
    isDesigner ? db.from("designer_agreements").select("signed_at").eq("designer_id", id).maybeSingle() : none,
    isDesigner ? db.from("withdrawals").select("amount, status, method_type, created_at").eq("designer_id", id).order("created_at", { ascending: false }).limit(50) : none,
  ]);
  const ratingCounts: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of ((ratings.data ?? []) as { rating: number }[])) if (r.rating >= 1 && r.rating <= 5) ratingCounts[r.rating as 1 | 2 | 3 | 4 | 5]++;
  const wd = ((withdrawals.data ?? []) as { amount: number; status: string; method_type: string; created_at: string }[]).map((w) => ({ amount: w.amount, status: w.status, method: w.method_type, createdAt: new Date(w.created_at) }));
  return {
    ...toRow(p),
    suspendedUntil: p.suspended_until ? new Date(p.suspended_until as string) : null,
    trash: p.status === "deleted" && p.deleted_at ? { at: new Date(p.deleted_at as string), reason: (p.delete_reason as string | null) ?? null } : null,
    businessName: (p.business_name as string | null) ?? null,
    bio: (p.bio as string | null) ?? null,
    designer: isDesigner
      ? {
          entries: entryCount.count ?? 0,
          wins: winCount.count ?? 0,
          ratings: ratingCounts,
          payoutType: ((payout.data as { type: string } | null)?.type as "bkash" | "bank" | undefined) ?? null,
          agreedAt: (agreement.data as { signed_at: string } | null)?.signed_at ? new Date((agreement.data as { signed_at: string }).signed_at) : null,
          withdrawals: wd,
          waiting: wd.filter((w) => w.status === "requested").reduce((a, w) => a + w.amount, 0),
          paidOut: wd.filter((w) => w.status === "paid").reduce((a, w) => a + w.amount, 0),
        }
      : null,
    balance: (balance.data as number | null) ?? null,
    strikeHistory: (strikes.data ?? []).map((s) => {
      const c = one(s.contest as { slug: string; brand_name: string } | { slug: string; brand_name: string }[] | null);
      return {
        id: s.id as string,
        reason: s.reason as string,
        issuerRole: s.issuer_role as string,
        issuer: one(s.issuer as { name: string } | { name: string }[] | null)?.name ?? null,
        contest: c ? { slug: c.slug, brand: c.brand_name } : null,
        createdAt: new Date(s.created_at as string),
        removedAt: s.removed_at ? new Date(s.removed_at as string) : null,
      };
    }),
    contests: ((contests.data ?? []) as { slug: string; brand_name: string; status: string; created_at: string }[]).map((c) => ({ slug: c.slug, brand: c.brand_name, status: c.status, createdAt: new Date(c.created_at) })),
    entries: ((entries.data ?? []) as { number: number; status: string; created_at: string; contest: unknown }[]).map((e) => {
      const c = one(e.contest as { slug: string; brand_name: string } | { slug: string; brand_name: string }[] | null);
      return { slug: c?.slug ?? "", brand: c?.brand_name ?? "", number: e.number, status: e.status, createdAt: new Date(e.created_at) };
    }),
  };
}

// ---------------------------------------------------------------------------
// Users list redesign (owner, 2026-10-12; Design/users): counts, filters, the richer row and the Quick view, all
// worked out here. Contact details leave this file only for admins with Users · manage.
// ---------------------------------------------------------------------------


type Light = {
  id: string;
  name: string;
  username: string | null;
  role: "client" | "designer" | "admin";
  status: "active" | "suspended" | "banned";
  mobile: string;
  email: string | null;
  strikes: number;
  created_at: string;
  last_seen_at: string | null;
  counted_wins_count: number | null;
  email_verified_at: string | null;
  avatar_path: string | null;
  is_super_admin: boolean | null;
  suspended_until: string | null;
  admin_title: string | null;
};
const LIGHT =
  "id, name, username, role, status, mobile, email, strikes, created_at, last_seen_at, counted_wins_count, email_verified_at, avatar_path, is_super_admin, suspended_until, admin_title";

/** What a designer's agreement shows on the check line. */
export type AgreementCheck = "approved" | "needs_review" | "no_photo" | "rejected" | "none";

export type UserCard = {
  id: string;
  name: string;
  username: string | null;
  role: Light["role"];
  status: Light["status"];
  superAdmin: boolean;
  /** An admin's title from Admins & roles, e.g. "Manager". */
  adminTitle: string | null;
  avatarUrl: string | null;
  strikes: number;
  joinedAt: string;
  lastSeenAt: string | null;
  online: boolean;
  suspendedUntil: string | null;
  emailVerified: boolean;
  agreement: AgreementCheck;
  /** Client: contests run, spent, winners picked. Designer: designs, wins, earned. */
  stats: { a: number; b: number; c: number };
  /** Only for Users · manage. */
  contact: { mobile: string; email: string | null } | null;
};

export type UsersPage = {
  rows: UserCard[];
  total: number;
  pages: number;
  counts: {
    all: number;
    newThisWeek: number;
    clients: number;
    clientsRan: number;
    designers: number;
    designersOnline: number;
    look: number;
    lookSuspended: number;
    lookBanned: number;
    role: Record<UsersQuery["role"], number>;
    status: Record<UsersQuery["status"], number>;
    show: Record<UsersQuery["show"][number], number>;
  };
};

const SHOWN_CONTEST = ["open", "judging", "winner_selected", "handover", "completed", "no_result"];
const PICKED = ["winner_selected", "handover", "completed"];

/** Every matching user in order (for the page and the CSV), with the counts. */
export async function adminUsersAll(q: UsersQuery, now = new Date()): Promise<{ list: Light[]; spent: Map<string, number>; noPhoto: Set<string>; counts: UsersPage["counts"] }> {
  const db = createAdminClient();
  const [{ data: people }, { data: pays }, { data: noPhotoRows }, { data: ran }] = await Promise.all([
    db.from("profiles").select(LIGHT).neq("status", "deleted").limit(20000),
    db.from("payments").select("client_id, amount").eq("status", "paid").limit(50000),
    db.from("designer_agreements").select("designer_id").is("id_front_path", null),
    db.from("contests").select("client_id").in("status", SHOWN_CONTEST).limit(50000),
  ]);
  // A suspension whose 48 hours are up counts as active at once, even before the lifecycle job writes it back.
  const all = ((people ?? []) as Light[]).map((u) =>
    u.status === "suspended" && u.suspended_until && new Date(u.suspended_until).getTime() <= now.getTime() ? { ...u, status: "active" as const, suspended_until: null } : u,
  );
  const spent = new Map<string, number>();
  for (const p of pays ?? []) spent.set(p.client_id as string, (spent.get(p.client_id as string) ?? 0) + ((p.amount as number) ?? 0));
  const noPhoto = new Set((noPhotoRows ?? []).map((r) => r.designer_id as string));
  const ranSet = new Set((ran ?? []).map((r) => r.client_id as string));

  const week = now.getTime() - 7 * 86_400_000;
  const isOnline = (u: Light) => Boolean(u.last_seen_at && now.getTime() - new Date(u.last_seen_at).getTime() <= ONLINE_MS);
  const isNew = (u: Light) => new Date(u.created_at).getTime() >= week;
  const isLook = (u: Light) => u.status !== "active" || u.strikes >= LOOK_STRIKES || (u.role === "designer" && noPhoto.has(u.id));
  const showTest = { online: isOnline, strikes: (u: Light) => u.strikes > 0, new: isNew, look: isLook };

  const words = q.q.toLowerCase().replace(/^@/, "");
  const digits = toAsciiDigits(q.q).replace(/\D/g, "").replace(/^0/, "");
  const searched = all.filter(
    (u) =>
      !words ||
      u.name.toLowerCase().includes(words) ||
      (u.username ?? "").toLowerCase().includes(words) ||
      (u.email ?? "").toLowerCase().includes(words) ||
      (digits.length >= 4 && u.mobile.replace(/\D/g, "").includes(digits)),
  );
  const byShow = (u: Light) => q.show.every((s) => showTest[s](u));
  const byRole = (u: Light) => q.role === "all" || u.role === q.role;
  const byStatus = (u: Light) => q.status === "all" || u.status === q.status;
  const list = searched.filter((u) => byRole(u) && byStatus(u) && byShow(u));

  const time = (v: string | null) => (v ? new Date(v).getTime() : 0);
  list.sort((a, b) =>
    q.sort === "active"
      ? time(b.last_seen_at) - time(a.last_seen_at)
      : q.sort === "spent"
        ? (spent.get(b.id) ?? 0) - (spent.get(a.id) ?? 0) || time(b.created_at) - time(a.created_at)
        : q.sort === "wins"
          ? (b.counted_wins_count ?? 0) - (a.counted_wins_count ?? 0) || time(b.created_at) - time(a.created_at)
          : time(b.created_at) - time(a.created_at),
  );

  const roleBase = searched.filter((u) => byStatus(u) && byShow(u));
  const statusBase = searched.filter((u) => byRole(u) && byShow(u));
  const showBase = searched.filter((u) => byRole(u) && byStatus(u));
  const counts: UsersPage["counts"] = {
    all: all.length,
    newThisWeek: all.filter(isNew).length,
    clients: all.filter((u) => u.role === "client").length,
    clientsRan: all.filter((u) => u.role === "client" && ranSet.has(u.id)).length,
    designers: all.filter((u) => u.role === "designer").length,
    designersOnline: all.filter((u) => u.role === "designer" && isOnline(u)).length,
    look: all.filter(isLook).length,
    lookSuspended: all.filter((u) => u.status === "suspended").length,
    lookBanned: all.filter((u) => u.status === "banned").length,
    role: { all: roleBase.length, client: roleBase.filter((u) => u.role === "client").length, designer: roleBase.filter((u) => u.role === "designer").length, admin: roleBase.filter((u) => u.role === "admin").length },
    status: { all: statusBase.length, active: statusBase.filter((u) => u.status === "active").length, suspended: statusBase.filter((u) => u.status === "suspended").length, banned: statusBase.filter((u) => u.status === "banned").length },
    show: { online: showBase.filter(isOnline).length, strikes: showBase.filter((u) => u.strikes > 0).length, new: showBase.filter(isNew).length, look: showBase.filter(isLook).length },
  };
  return { list, spent, noPhoto, counts };
}

/** One page of users, ready for the table and the Quick view. */
export async function adminUsersPage(q: UsersQuery, opts: { canManage: boolean; now?: Date }): Promise<UsersPage> {
  const empty = { all: 0, newThisWeek: 0, clients: 0, clientsRan: 0, designers: 0, designersOnline: 0, look: 0, lookSuspended: 0, lookBanned: 0, role: { all: 0, client: 0, designer: 0, admin: 0 }, status: { all: 0, active: 0, suspended: 0, banned: 0 }, show: { online: 0, strikes: 0, new: 0, look: 0 } };
  if (!isSupabaseConfigured()) return { rows: [], total: 0, pages: 1, counts: empty };
  const now = opts.now ?? new Date();
  const { list, spent, noPhoto, counts } = await adminUsersAll(q, now);
  const pages = Math.max(1, Math.ceil(list.length / USERS_PER_PAGE));
  const page = list.slice((q.page - 1) * USERS_PER_PAGE, q.page * USERS_PER_PAGE);
  const clientIds = page.filter((u) => u.role === "client").map((u) => u.id);
  const designerIds = page.filter((u) => u.role === "designer").map((u) => u.id);
  const db = createAdminClient();
  const [{ data: contests }, { data: entries }, { data: credits }, { data: agreements }] = await Promise.all([
    clientIds.length ? db.from("contests").select("client_id, status").in("client_id", clientIds).in("status", SHOWN_CONTEST) : Promise.resolve({ data: [] }),
    designerIds.length ? db.from("entries").select("designer_id, status").in("designer_id", designerIds).not("status", "in", "(removed,withdrawn)") : Promise.resolve({ data: [] }),
    designerIds.length ? db.from("wallet_transactions").select("designer_id, amount, type").in("designer_id", designerIds).in("type", ["prize_credit", "no_result_share"]) : Promise.resolve({ data: [] }),
    // "*" so the check line works before and after migration 0040 (review_status).
    designerIds.length ? db.from("designer_agreements").select("*").in("designer_id", designerIds) : Promise.resolve({ data: [] }),
  ]);
  const agreementOf = new Map((agreements ?? []).map((a) => [a.designer_id as string, a as Record<string, unknown>]));
  const rows: UserCard[] = page.map((u) => {
    const mine = <T extends Record<string, unknown>>(list: T[] | null, key: string) => (list ?? []).filter((r) => r[key] === u.id);
    const c = mine((contests ?? []) as Record<string, unknown>[], "client_id");
    const e = mine((entries ?? []) as Record<string, unknown>[], "designer_id");
    const w = mine((credits ?? []) as Record<string, unknown>[], "designer_id");
    const ag = agreementOf.get(u.id);
    const agreement: AgreementCheck = !ag
      ? "none"
      : !ag.id_front_path
        ? "no_photo"
        : ((ag.review_status as AgreementCheck | undefined) ?? "needs_review");
    return {
      id: u.id,
      name: u.name,
      username: u.username,
      role: u.role,
      status: u.status,
      superAdmin: Boolean(u.is_super_admin),
      adminTitle: u.role === "admin" ? (u.admin_title?.trim() || null) : null,
      avatarUrl: avatarUrl(u.avatar_path),
      strikes: u.strikes ?? 0,
      joinedAt: u.created_at,
      lastSeenAt: u.last_seen_at,
      online: Boolean(u.last_seen_at && now.getTime() - new Date(u.last_seen_at).getTime() <= ONLINE_MS),
      suspendedUntil: u.suspended_until,
      emailVerified: Boolean(u.email_verified_at),
      agreement: noPhoto.has(u.id) ? "no_photo" : agreement,
      stats:
        u.role === "client"
          ? { a: c.length, b: spent.get(u.id) ?? 0, c: c.filter((x) => PICKED.includes(x.status as string)).length }
          : u.role === "designer"
            ? { a: e.length, b: e.filter((x) => x.status === "winner").length, c: w.reduce((n, x) => n + ((x.amount as number) ?? 0), 0) }
            : { a: 0, b: 0, c: 0 },
      contact: opts.canManage ? { mobile: u.mobile, email: u.email } : null,
    };
  });
  return { rows, total: list.length, pages, counts };
}
