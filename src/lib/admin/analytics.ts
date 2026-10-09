import "server-only";
import { ONLINE_MS } from "@/lib/analytics/rules";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;
type Person = { id: string; name: string; role: string; username: string | null; mobile: string | null };

/** Reads every row of a query in pages of 1,000 (the API's page size), up to `cap` rows. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, cap = 50_000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < cap; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error || !data) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

async function people(db: Db, ids: (string | null | undefined)[]): Promise<Map<string, Person>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (!unique.length) return new Map();
  const { data } = await db.from("profiles").select("id, name, role, username, mobile").in("id", unique.slice(0, 1000));
  return new Map((data ?? []).map((p) => [p.id as string, p as Person]));
}

/** "YYYY-MM-DD" in Dhaka time. */
const dhakaDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(d);
/** Midnight in Dhaka, `daysAgo` days back (0 = today). */
export function dhakaStart(daysAgo: number, now = new Date()): Date {
  const day = dhakaDay(new Date(now.getTime() - daysAgo * 86_400_000));
  return new Date(`${day}T00:00:00+06:00`);
}

// ---- A-19 Live now -----------------------------------------------------------------------------

export type LiveVisitor = { visitorId: string; person: Person | null; path: string; device: string; country: string | null; startedAt: Date; lastSeen: Date };

export async function liveVisitors(now = new Date()): Promise<LiveVisitor[]> {
  if (!isSupabaseConfigured()) return [];
  const db = createAdminClient();
  const { data } = await db
    .from("presence")
    .select("visitor_id, user_id, path, device, country, started_at, updated_at")
    .gte("updated_at", new Date(now.getTime() - ONLINE_MS).toISOString())
    .order("updated_at", { ascending: false })
    .limit(500);
  const rows = data ?? [];
  const who = await people(db, rows.map((r) => r.user_id as string | null));
  return rows.map((r) => ({
    visitorId: r.visitor_id as string,
    person: r.user_id ? (who.get(r.user_id as string) ?? null) : null,
    path: r.path as string,
    device: r.device as string,
    country: (r.country as string | null) ?? null,
    startedAt: new Date(r.started_at as string),
    lastSeen: new Date(r.updated_at as string),
  }));
}

// ---- A-20 Analytics ----------------------------------------------------------------------------

export type Traffic = {
  visitors: number;
  views: number;
  members: number;
  signups: number;
  paidContests: number;
  days: { day: string; visitors: number; views: number }[];
  pages: { key: string; n: number }[];
  sources: { key: string | null; n: number }[];
  devices: { key: string; n: number }[];
  countries: { key: string | null; n: number }[];
  capped: boolean;
};

const top = <K extends string | null>(counts: Map<K, number>, n = 10) =>
  [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([key, v]) => ({ key, n: v }));

/** Visits over the last `days` days (1 = today), counted in Dhaka days. */
export async function traffic(days: number, now = new Date()): Promise<Traffic> {
  const empty: Traffic = { visitors: 0, views: 0, members: 0, signups: 0, paidContests: 0, days: [], pages: [], sources: [], devices: [], countries: [], capped: false };
  if (!isSupabaseConfigured()) return empty;
  const db = createAdminClient();
  const since = dhakaStart(days - 1, now).toISOString();
  const cap = 50_000;
  const head = { count: "exact" as const, head: true };
  const [rows, signups, paid] = await Promise.all([
    fetchAll<{ visitor_id: string; user_id: string | null; path: string; referrer: string | null; device: string; country: string | null; created_at: string }>(
      (from, to) => db.from("page_views").select("visitor_id, user_id, path, referrer, device, country, created_at").gte("created_at", since).order("id").range(from, to),
      cap,
    ),
    db.from("profiles").select("id", head).gte("created_at", since).in("role", ["client", "designer"]),
    db.from("payments").select("id", head).eq("purpose", "contest").eq("status", "paid").gte("paid_at", since),
  ]);

  const byDay = new Map<string, { v: Set<string>; n: number }>();
  for (let i = days - 1; i >= 0; i--) byDay.set(dhakaDay(new Date(now.getTime() - i * 86_400_000)), { v: new Set(), n: 0 });
  const visitors = new Set<string>();
  const members = new Set<string>();
  const pages = new Map<string, number>();
  const sources = new Map<string | null, number>();
  const devices = new Map<string, number>();
  const countries = new Map<string | null, number>();
  const seenSource = new Set<string>();

  for (const r of rows) {
    visitors.add(r.visitor_id);
    if (r.user_id) members.add(r.user_id);
    const d = byDay.get(dhakaDay(new Date(r.created_at)));
    if (d) {
      d.v.add(r.visitor_id);
      d.n++;
    }
    pages.set(r.path, (pages.get(r.path) ?? 0) + 1);
    // Sources, devices and countries count visitors, not page views.
    if (!seenSource.has(r.visitor_id)) {
      seenSource.add(r.visitor_id);
      sources.set(r.referrer, (sources.get(r.referrer) ?? 0) + 1);
      devices.set(r.device, (devices.get(r.device) ?? 0) + 1);
      countries.set(r.country, (countries.get(r.country) ?? 0) + 1);
    } else if (r.referrer) {
      sources.set(r.referrer, (sources.get(r.referrer) ?? 0) + 1);
    }
  }

  return {
    visitors: visitors.size,
    views: rows.length,
    members: members.size,
    signups: signups.count ?? 0,
    paidContests: paid.count ?? 0,
    days: [...byDay.entries()].map(([day, x]) => ({ day, visitors: x.v.size, views: x.n })),
    pages: top(pages),
    sources: top(sources),
    devices: top(devices, 3),
    countries: top(countries, 8),
    capped: rows.length >= cap,
  };
}

// ---- A-21 Activity -----------------------------------------------------------------------------

export type ActivityKind = "signup_client" | "signup_designer" | "contest_started" | "contest_paid" | "design_sent" | "comment" | "files_approved" | "withdrawal";
export type Activity = { kind: ActivityKind; at: Date; person: Person | null; label: string; href: string | null };

export async function activityFeed(limit = 80): Promise<Activity[]> {
  if (!isSupabaseConfigured()) return [];
  const db = createAdminClient();
  const n = Math.min(limit, 100);
  const [signups, contests, paid, entries, entryComments, contestComments, approvals, withdrawals] = await Promise.all([
    db.from("profiles").select("id, role, created_at").in("role", ["client", "designer"]).order("created_at", { ascending: false }).limit(n),
    db.from("contests").select("client_id, brand_name, slug, created_at").order("created_at", { ascending: false }).limit(n),
    db.from("payments").select("client_id, paid_at, contest:contests(brand_name, slug)").eq("purpose", "contest").eq("status", "paid").order("paid_at", { ascending: false }).limit(n),
    db.from("entries").select("designer_id, number, created_at, contest:contests(brand_name, slug)").order("created_at", { ascending: false }).limit(n),
    db.from("entry_comments").select("user_id, created_at, entry:entries(number, contest:contests(brand_name, slug))").order("created_at", { ascending: false }).limit(n),
    db.from("contest_comments").select("user_id, created_at, contest:contests(brand_name, slug)").order("created_at", { ascending: false }).limit(n),
    db.from("handovers").select("designer_id, approved_at, contest:contests(brand_name, slug)").not("approved_at", "is", null).order("approved_at", { ascending: false }).limit(n),
    db.from("withdrawals").select("designer_id, amount, created_at").order("created_at", { ascending: false }).limit(n),
  ]);
  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
  type C = { brand_name: string; slug: string };
  const items: (Omit<Activity, "person"> & { userId: string | null })[] = [];
  for (const r of signups.data ?? []) items.push({ kind: r.role === "designer" ? "signup_designer" : "signup_client", at: new Date(r.created_at as string), userId: r.id as string, label: "", href: null });
  for (const r of contests.data ?? []) items.push({ kind: "contest_started", at: new Date(r.created_at as string), userId: r.client_id as string, label: r.brand_name as string, href: `/admin/contests/${r.slug}` });
  for (const r of paid.data ?? []) {
    const c = one(r.contest as C | C[] | null);
    items.push({ kind: "contest_paid", at: new Date(r.paid_at as string), userId: r.client_id as string, label: c?.brand_name ?? "", href: c ? `/admin/contests/${c.slug}` : null });
  }
  for (const r of entries.data ?? []) {
    const c = one(r.contest as C | C[] | null);
    items.push({ kind: "design_sent", at: new Date(r.created_at as string), userId: r.designer_id as string, label: c ? `${c.brand_name} #${r.number}` : `#${r.number}`, href: c ? `/admin/contests/${c.slug}` : null });
  }
  for (const r of entryComments.data ?? []) {
    const e = one(r.entry as unknown as { number: number; contest: C | C[] | null } | null);
    const c = one(e?.contest);
    items.push({ kind: "comment", at: new Date(r.created_at as string), userId: r.user_id as string, label: c ? `${c.brand_name} #${e?.number}` : "", href: c ? `/admin/contests/${c.slug}` : null });
  }
  for (const r of contestComments.data ?? []) {
    const c = one(r.contest as C | C[] | null);
    items.push({ kind: "comment", at: new Date(r.created_at as string), userId: r.user_id as string, label: c?.brand_name ?? "", href: c ? `/admin/contests/${c.slug}` : null });
  }
  for (const r of approvals.data ?? []) {
    const c = one(r.contest as C | C[] | null);
    items.push({ kind: "files_approved", at: new Date(r.approved_at as string), userId: r.designer_id as string, label: c?.brand_name ?? "", href: c ? `/admin/contests/${c.slug}` : null });
  }
  for (const r of withdrawals.data ?? []) items.push({ kind: "withdrawal", at: new Date(r.created_at as string), userId: r.designer_id as string, label: String(r.amount), href: "/admin/withdrawals" });

  items.sort((a, b) => b.at.getTime() - a.at.getTime());
  const shown = items.slice(0, n);
  const who = await people(db, shown.map((i) => i.userId));
  return shown.map(({ userId, ...rest }) => ({ ...rest, person: userId ? (who.get(userId) ?? null) : null }));
}

// ---- A-22 Unpaid contests ----------------------------------------------------------------------

export type UnpaidContest = { id: string; slug: string; brand: string; status: "draft" | "pending_payment"; amount: number; step: number | null; createdAt: Date; updatedAt: Date; client: Person | null };

export async function unpaidContests(limit = 200): Promise<UnpaidContest[]> {
  if (!isSupabaseConfigured()) return [];
  const db = createAdminClient();
  const { data } = await db
    .from("contests")
    .select("id, slug, brand_name, status, total_amount, client_id, created_at, updated_at")
    .in("status", ["draft", "pending_payment"])
    .order("updated_at", { ascending: false })
    .limit(limit);
  const rows = data ?? [];
  const [who, visits] = await Promise.all([
    people(db, rows.map((r) => r.client_id as string)),
    rows.length ? db.from("wizard_visits").select("contest_id, furthest_step").in("contest_id", rows.map((r) => r.id as string)) : Promise.resolve({ data: [] as { contest_id: string; furthest_step: number }[] }),
  ]);
  const step = new Map<string, number>();
  for (const v of visits.data ?? []) step.set(v.contest_id as string, Math.max(step.get(v.contest_id as string) ?? 0, v.furthest_step as number));
  return rows.map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    brand: r.brand_name as string,
    status: r.status as UnpaidContest["status"],
    amount: (r.total_amount as number) ?? 0,
    step: step.get(r.id as string) ?? null,
    createdAt: new Date(r.created_at as string),
    updatedAt: new Date(r.updated_at as string),
    client: who.get(r.client_id as string) ?? null,
  }));
}
