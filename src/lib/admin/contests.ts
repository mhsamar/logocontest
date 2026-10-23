import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { BRIEF_FILES_BUCKET, getFileStorage } from "@/lib/storage";
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
  else query = query.not("status", "in", "(draft,pending_payment,deleted)");
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
  /** When it went live (was paid). */
  startsAt: Date | null;
};

/** Paid contests (not drafts or unpaid), newest first, up to 1,000, with their design counts. */
export async function adminContestOverview(): Promise<{ rows: AdminContestOverviewRow[]; unpaid: number }> {
  if (!isSupabaseConfigured()) return { rows: [], unpaid: 0 };
  const db = createAdminClient();
  const [{ data }, unpaid] = await Promise.all([
    db
      .from("contests")
      .select("id, slug, contest_number, brand_name, status, package, prize_amount, total_amount, starts_at, ends_at, completed_at, created_at, is_promoted, is_urgent, is_highlighted, is_private, entries(count), client:profiles!client_id(id, name)")
      .not("status", "in", "(draft,pending_payment,deleted)")
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
      startsAt: c.starts_at ? new Date(c.starts_at as string) : null,
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
  /** In the Trash (owner, 2026-10-14). */
  trash: { at: Date; reason: string | null; by: string | null } | null;
};

export async function getAdminContest(slug: string): Promise<AdminContestDetail | null> {
  if (!isSupabaseConfigured() || !/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const db = createAdminClient();
  const { data: c } = await db
    .from("contests")
    .select(
      "id, slug, contest_number, brand_name, status, prize_amount, total_amount, service_fee_amount, upgrades_amount, duration_days, starts_at, ends_at, judging_ends_at, created_at, cancel_reason, extensions_count, " +
        "is_blind, is_private, is_promoted, is_highlighted, is_urgent, is_nda, logo_scan, admin_review, client:profiles!client_id(id, name), deleted_at, delete_reason, deleter:profiles!deleted_by(name)",
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
    trash:
      r.status === "deleted" && r.deleted_at
        ? { at: new Date(r.deleted_at as string), reason: (r.delete_reason as string | null) ?? null, by: one(r.deleter as { name: string } | { name: string }[] | null)?.name ?? null }
        : null,
  };
}

/** A-02 Reference photos (owner, 2026-10-22): the contest's files, with links that last an hour. */
export type AdminContestFile = { id: string; name: string; kind: "example" | "current_logo"; url: string | null; isImage: boolean };

export async function adminContestFiles(contestId: string): Promise<AdminContestFile[]> {
  const { data } = await createAdminClient().from("contest_files").select("id, type, path, original_name, mime_type").eq("contest_id", contestId).order("created_at");
  const rows = data ?? [];
  const urls = await getFileStorage()
    .createReadUrls(BRIEF_FILES_BUCKET, rows.map((r) => r.path as string), 3600)
    .catch(() => new Map<string, string>());
  return rows.map((r) => ({
    id: r.id as string,
    name: r.original_name as string,
    kind: r.type === "current_logo" ? "current_logo" : "example",
    url: urls.get(r.path as string) ?? null,
    isImage: String(r.mime_type).startsWith("image/"),
  }));
}

/** The client panel on the contest page (owner, 2026-10-14): who the client is, how to reach them, what they ran. */
export type ContestClient = {
  id: string;
  name: string;
  username: string | null;
  businessName: string | null;
  status: "active" | "suspended" | "banned" | "deleted";
  suspendedUntil: Date | null;
  isTest: boolean;
  strikes: number;
  joinedAt: Date;
  lastSeenAt: Date | null;
  emailVerified: boolean;
  /** The country of their latest visit (two letters), if one was recorded. */
  country: string | null;
  spent: number;
  picked: number;
  contests: { slug: string; brand: string; number: number | null; status: string; createdAt: Date }[];
  /** Only for Users · manage. */
  contact: { mobile: string; email: string | null; bkash: string[]; whatsapp: boolean } | null;
};

const PICKED_STATUSES = ["winner_selected", "handover", "completed"];

export async function getContestClient(clientId: string, opts: { canSeeContact: boolean }): Promise<ContestClient | null> {
  if (!isSupabaseConfigured() || !/^[0-9a-f-]{36}$/i.test(clientId)) return null;
  const db = createAdminClient();
  const [{ data: p }, contests, pays, visit, senders] = await Promise.all([
    db.from("profiles").select("id, name, username, business_name, status, suspended_until, is_test, strikes, created_at, last_seen_at, email_verified_at, mobile, email, whatsapp").eq("id", clientId).maybeSingle(),
    db.from("contests").select("slug, brand_name, contest_number, status, created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(50),
    db.from("payments").select("amount").eq("client_id", clientId).eq("status", "paid").limit(5000),
    db.from("page_views").select("country").eq("user_id", clientId).not("country", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    opts.canSeeContact ? db.from("manual_payments").select("sender_number").eq("user_id", clientId).not("sender_number", "is", null).order("created_at", { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
  ]);
  if (!p) return null;
  const list = (contests.data ?? []) as { slug: string; brand_name: string; contest_number: number | null; status: string; created_at: string }[];
  const suspendedUntil = p.suspended_until ? new Date(p.suspended_until as string) : null;
  // A suspension whose time is up counts as active at once (owner, 2026-10-12).
  const status = p.status === "suspended" && suspendedUntil && suspendedUntil.getTime() <= Date.now() ? "active" : (p.status as ContestClient["status"]);
  const bkash = [...new Set(((senders.data ?? []) as { sender_number: string }[]).map((s) => s.sender_number))].slice(0, 3);
  return {
    id: p.id as string,
    name: p.name as string,
    username: (p.username as string | null) ?? null,
    businessName: (p.business_name as string | null) ?? null,
    status,
    suspendedUntil: status === "suspended" ? suspendedUntil : null,
    isTest: Boolean(p.is_test),
    strikes: (p.strikes as number) ?? 0,
    joinedAt: new Date(p.created_at as string),
    lastSeenAt: p.last_seen_at ? new Date(p.last_seen_at as string) : null,
    emailVerified: Boolean(p.email_verified_at),
    country: ((visit.data as { country: string } | null)?.country as string | undefined) ?? null,
    spent: ((pays.data ?? []) as { amount: number }[]).reduce((a, r) => a + (r.amount ?? 0), 0),
    picked: list.filter((c) => PICKED_STATUSES.includes(c.status)).length,
    contests: list.map((c) => ({ slug: c.slug, brand: c.brand_name, number: c.contest_number ?? null, status: c.status, createdAt: new Date(c.created_at) })),
    contact: opts.canSeeContact ? { mobile: p.mobile as string, email: (p.email as string | null) ?? null, bkash, whatsapp: p.whatsapp === true } : null,
  };
}
