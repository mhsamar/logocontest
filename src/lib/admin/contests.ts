import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { one } from "./core";

/** A-02 Contests (BLUEPRINT §13.3). */
export type AdminContestRow = {
  id: string;
  slug: string;
  number: number | null;
  brand: string;
  status: string;
  client: { id: string; name: string };
  prize: number;
  total: number;
  entries: number;
  endsAt: Date | null;
  createdAt: Date;
};

const PAGE = 30;
export const ADMIN_CONTEST_STATUSES = ["draft", "pending_payment", "open", "judging", "winner_selected", "handover", "completed", "no_result", "cancelled"] as const;

export async function listAdminContests(q: { search: string; status: string; page: number }): Promise<{ rows: AdminContestRow[]; total: number; pages: number }> {
  if (!isSupabaseConfigured()) return { rows: [], total: 0, pages: 0 };
  const db = createAdminClient();
  let query = db
    .from("contests")
    .select("id, slug, contest_number, brand_name, status, prize_amount, total_amount, ends_at, created_at, client:profiles!client_id(id, name)", { count: "exact" });
  if ((ADMIN_CONTEST_STATUSES as readonly string[]).includes(q.status)) query = query.eq("status", q.status);
  else query = query.not("status", "in", "(draft,pending_payment)");
  const term = q.search.trim().replace(/[%,()#]/g, "");
  if (term) query = /^\d+$/.test(term) ? query.eq("contest_number", Number(term)) : query.or(`brand_name.ilike.%${term}%,slug.ilike.%${term}%`);
  const from = (q.page - 1) * PAGE;
  const { data, count } = await query.order("created_at", { ascending: false }).range(from, from + PAGE - 1);
  const ids = (data ?? []).map((c) => c.id as string);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data: e } = await db.from("entries").select("contest_id").in("contest_id", ids);
    for (const r of e ?? []) counts.set(r.contest_id as string, (counts.get(r.contest_id as string) ?? 0) + 1);
  }
  return {
    rows: (data ?? []).map((c) => {
      const client = one(c.client as { id: string; name: string } | { id: string; name: string }[] | null);
      return {
        id: c.id as string,
        slug: c.slug as string,
        number: (c.contest_number as number | null) ?? null,
        brand: c.brand_name as string,
        status: c.status as string,
        client: { id: client?.id ?? "", name: client?.name ?? "—" },
        prize: c.prize_amount as number,
        total: c.total_amount as number,
        entries: counts.get(c.id as string) ?? 0,
        endsAt: c.ends_at ? new Date(c.ends_at as string) : null,
        createdAt: new Date(c.created_at as string),
      };
    }),
    total: count ?? 0,
    pages: Math.max(1, Math.ceil((count ?? 0) / PAGE)),
  };
}

/** A-02 Contests page (design/admin/contests.html, owner 2026-10-10): every paid contest with what its cards show. */
export type AdminContestOverviewRow = AdminContestRow & {
  package: string;
  featured: boolean;
  urgent: boolean;
  highlighted: boolean;
  isPrivate: boolean;
  completedAt: Date | null;
};

/** Paid contests (not drafts or unpaid), newest first, up to 1,000, with their design counts. */
export async function adminContestOverview(): Promise<{ rows: AdminContestOverviewRow[]; unpaid: number }> {
  if (!isSupabaseConfigured()) return { rows: [], unpaid: 0 };
  const db = createAdminClient();
  const [{ data }, unpaid] = await Promise.all([
    db
      .from("contests")
      .select("id, slug, contest_number, brand_name, status, package, prize_amount, total_amount, ends_at, completed_at, created_at, is_promoted, is_urgent, is_highlighted, is_private, entries(count), client:profiles!client_id(id, name)")
      .not("status", "in", "(draft,pending_payment)")
      .order("created_at", { ascending: false })
      .limit(1000),
    db.from("contests").select("id", { count: "exact", head: true }).in("status", ["draft", "pending_payment"]),
  ]);
  const rows = (data ?? []).map((c) => {
    const client = one(c.client as { id: string; name: string } | { id: string; name: string }[] | null);
    const entries = one(c.entries as { count: number } | { count: number }[] | null);
    return {
      id: c.id as string,
      slug: c.slug as string,
      number: (c.contest_number as number | null) ?? null,
      brand: c.brand_name as string,
      status: c.status as string,
      client: { id: client?.id ?? "", name: client?.name ?? "—" },
      prize: c.prize_amount as number,
      total: c.total_amount as number,
      entries: entries?.count ?? 0,
      endsAt: c.ends_at ? new Date(c.ends_at as string) : null,
      createdAt: new Date(c.created_at as string),
      package: c.package as string,
      featured: Boolean(c.is_promoted),
      urgent: Boolean(c.is_urgent),
      highlighted: Boolean(c.is_highlighted),
      isPrivate: Boolean(c.is_private),
      completedAt: c.completed_at ? new Date(c.completed_at as string) : null,
    };
  });
  return { rows, unpaid: unpaid.count ?? 0 };
}

export type AdminContestDetail = AdminContestRow & {
  serviceFee: number;
  upgrades: number;
  durationDays: number;
  startsAt: Date | null;
  judgingEndsAt: Date | null;
  flags: string[];
  cancelReason: string | null;
  extensions: number;
  entriesList: { id: string; number: number; status: string; rating: number | null; designer: { id: string; name: string; username: string | null } }[];
  payments: { id: string; purpose: string; amount: number; status: string; gateway: string; txnId: string | null; paidAt: Date | null; createdAt: Date }[];
  handover: { status: string; dueAt: Date; designer: string } | null;
};

export async function getAdminContest(slug: string): Promise<AdminContestDetail | null> {
  if (!isSupabaseConfigured() || !/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const db = createAdminClient();
  const { data: c } = await db
    .from("contests")
    .select(
      "id, slug, contest_number, brand_name, status, prize_amount, total_amount, service_fee_amount, upgrades_amount, duration_days, starts_at, ends_at, judging_ends_at, created_at, cancel_reason, extensions_count, " +
        "is_blind, is_private, is_promoted, is_highlighted, is_urgent, is_nda, logo_scan, admin_review, client:profiles!client_id(id, name)",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!c) return null;
  const r = c as unknown as Record<string, unknown>;
  const [entries, payments, handover] = await Promise.all([
    db.from("entries").select("id, number, status, rating, designer:profiles!designer_id(id, name, username)").eq("contest_id", r.id as string).order("number"),
    db.from("payments").select("id, purpose, amount, status, gateway, gateway_txn_id, paid_at, created_at").eq("contest_id", r.id as string).order("created_at", { ascending: false }),
    db.from("handovers").select("status, due_at, designer:profiles!designer_id(name)").eq("contest_id", r.id as string).neq("status", "cancelled").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const client = one(r.client as { id: string; name: string } | null);
  const flagKeys = ["is_blind", "is_private", "is_promoted", "is_highlighted", "is_urgent", "is_nda", "logo_scan", "admin_review"] as const;
  return {
    id: r.id as string,
    slug: r.slug as string,
    number: (r.contest_number as number | null) ?? null,
    brand: r.brand_name as string,
    status: r.status as string,
    client: { id: client?.id ?? "", name: client?.name ?? "—" },
    prize: r.prize_amount as number,
    total: r.total_amount as number,
    serviceFee: r.service_fee_amount as number,
    upgrades: r.upgrades_amount as number,
    durationDays: r.duration_days as number,
    entries: entries.data?.length ?? 0,
    startsAt: r.starts_at ? new Date(r.starts_at as string) : null,
    endsAt: r.ends_at ? new Date(r.ends_at as string) : null,
    judgingEndsAt: r.judging_ends_at ? new Date(r.judging_ends_at as string) : null,
    createdAt: new Date(r.created_at as string),
    flags: flagKeys.filter((k) => r[k]),
    cancelReason: (r.cancel_reason as string | null) ?? null,
    extensions: (r.extensions_count as number) ?? 0,
    entriesList: (entries.data ?? []).map((e) => {
      const d = one(e.designer as { id: string; name: string; username: string | null } | { id: string; name: string; username: string | null }[] | null);
      return { id: e.id as string, number: e.number as number, status: e.status as string, rating: (e.rating as number | null) ?? null, designer: d ?? { id: "", name: "—", username: null } };
    }),
    payments: (payments.data ?? []).map((p) => ({
      id: p.id as string,
      purpose: p.purpose as string,
      amount: p.amount as number,
      status: p.status as string,
      gateway: p.gateway as string,
      txnId: (p.gateway_txn_id as string | null) ?? null,
      paidAt: p.paid_at ? new Date(p.paid_at as string) : null,
      createdAt: new Date(p.created_at as string),
    })),
    handover: handover.data
      ? { status: handover.data.status as string, dueAt: new Date(handover.data.due_at as string), designer: one(handover.data.designer as { name: string } | { name: string }[] | null)?.name ?? "—" }
      : null,
  };
}
