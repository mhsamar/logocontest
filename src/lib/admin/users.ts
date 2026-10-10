import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { toAsciiDigits } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { one } from "./core";

/** A-05 Users (BLUEPRINT §13.2). */
export type AdminUserRow = {
  id: string;
  name: string;
  username: string | null;
  role: "client" | "designer" | "admin";
  status: "active" | "suspended" | "banned";
  mobile: string;
  email: string | null;
  strikes: number;
  flagWarnings: number;
  createdAt: Date;
};

const COLUMNS = "id, name, username, role, status, mobile, email, strikes, flag_warnings, created_at, suspended_until";
const PAGE = 30;

const toRow = (r: Record<string, unknown>): AdminUserRow => ({
  id: r.id as string,
  name: r.name as string,
  username: (r.username as string | null) ?? null,
  role: r.role as AdminUserRow["role"],
  status: r.status as AdminUserRow["status"],
  mobile: r.mobile as string,
  email: (r.email as string | null) ?? null,
  strikes: (r.strikes as number) ?? 0,
  flagWarnings: (r.flag_warnings as number) ?? 0,
  createdAt: new Date(r.created_at as string),
});

export async function listUsers(q: { search: string; role: string; status: string; page: number }): Promise<{ rows: AdminUserRow[]; total: number; pages: number }> {
  if (!isSupabaseConfigured()) return { rows: [], total: 0, pages: 0 };
  let query = createAdminClient().from("profiles").select(COLUMNS, { count: "exact" });
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
  const { data: p } = await db.from("profiles").select(`${COLUMNS}, business_name, bio`).eq("id", id).maybeSingle();
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
