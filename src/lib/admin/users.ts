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
};

export async function getUser(id: string): Promise<AdminUserDetail | null> {
  if (!isSupabaseConfigured() || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = createAdminClient();
  const { data: p } = await db.from("profiles").select(`${COLUMNS}, business_name`).eq("id", id).maybeSingle();
  if (!p) return null;
  const [strikes, contests, entries, balance] = await Promise.all([
    db.from("strikes").select("id, reason, issuer_role, created_at, removed_at, issuer:profiles!issued_by(name), contest:contests!contest_id(slug, brand_name)").eq("user_id", id).order("created_at", { ascending: false }),
    p.role === "client" ? db.from("contests").select("slug, brand_name, status, created_at").eq("client_id", id).order("created_at", { ascending: false }).limit(30) : Promise.resolve({ data: [] }),
    p.role === "designer"
      ? db.from("entries").select("number, status, created_at, contest:contests!contest_id(slug, brand_name)").eq("designer_id", id).order("created_at", { ascending: false }).limit(30)
      : Promise.resolve({ data: [] }),
    p.role === "designer" ? db.rpc("wallet_balance", { p_designer_id: id }) : Promise.resolve({ data: null }),
  ]);
  return {
    ...toRow(p),
    suspendedUntil: p.suspended_until ? new Date(p.suspended_until as string) : null,
    businessName: (p.business_name as string | null) ?? null,
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
