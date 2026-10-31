import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/lib/i18n/messages/en";
import bn from "@/lib/i18n/messages/bn";

// Owner, 2026-10-29 (ONBOARDING-V2-PLAN.md decision 8, client-onboarding-v2-spec.md §4): the new 4-step wizard saves a
// draft at the logo name, so the team's instant alerts and the client's reminders wait until the prizes were seen; its
// amount shows once a package was picked. The Dashboard's drop-off chart keeps the old wizard's visits only, and the new
// wizard has its own funnel. Before migration 0079 everything works as before.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const at = (iso: string) => new Date(iso);

// ---- A small fake database that knows which columns don't exist yet --------------------------------------------------

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, settings: {} as Record<string, unknown>, seq: 0, missing: new Set<string>() }));
const sent = vi.hoisted(() => ({ push: [] as unknown[][], email: [] as Row[] }));

const val = (v: unknown) => (typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v) ? Date.parse(v) : v);
const OPS: Record<string, (a: unknown, b: string) => boolean> = {
  is: (a, b) => a === (b === "null" ? null : b === "true"),
  eq: (a, b) => String(val(a)) === String(val(b)),
  neq: (a, b) => String(val(a)) !== String(val(b)),
  gt: (a, b) => Number(val(a)) > Number(val(b)),
  gte: (a, b) => Number(val(a)) >= Number(val(b)),
  lt: (a, b) => Number(val(a)) < Number(val(b)),
  lte: (a, b) => Number(val(a)) <= Number(val(b)),
};
/** One condition of a PostgREST `or` filter (col.op.value or col.not.op.value); like SQL, an empty value matches no comparison. */
function cond(expr: string): { col: string; test: (r: Row) => boolean } {
  const [col, ...rest] = expr.split(".");
  const not = rest[0] === "not";
  const [op, ...value] = not ? rest.slice(1) : rest;
  return { col, test: (r) => (op === "is" || (r[col] ?? null) !== null) && OPS[op](r[col] ?? null, value.join(".")) !== not };
}

function table(name: string) {
  const rows = () => (db.tables[name] ??= []);
  const filters: ((r: Row) => boolean)[] = [];
  let op: { kind: "select" } | { kind: "insert"; rows: Row[] } | { kind: "update"; patch: Row } | { kind: "delete" } = { kind: "select" };
  let single = false;
  let head = false;
  let returning = false;
  let limit = Infinity;
  let unknown = false;
  // Only the columns asked for come back (a plain list), so a column the code forgets to read is missing here too.
  let columns: string[] | null = null;
  const uses = (col: string) => void (db.missing.has(col.trim()) && (unknown = true));
  const cmp = (k: string, f: (a: number, b: number) => boolean) => (v: unknown) => (uses(k), filters.push((r) => r[k] != null && f(Number(val(r[k])), Number(val(v)))), q);
  const q = {
    select: (c?: string, o?: { head?: boolean }) => ((c ?? "").split(",").forEach(uses), (columns = op.kind === "select" && c && !/[(:*]/.test(c) ? c.split(",").map((k) => k.trim()) : null), (head = Boolean(o?.head)), (returning = op.kind !== "select"), q),
    insert: (r: Row | Row[]) => ((op = { kind: "insert", rows: Array.isArray(r) ? r : [r] }), q),
    update: (p: Row) => ((op = { kind: "update", patch: p }), q),
    delete: () => ((op = { kind: "delete" }), q),
    eq: (k: string, v: unknown) => (uses(k), filters.push((r) => val(r[k]) === val(v)), q),
    neq: (k: string, v: unknown) => (uses(k), filters.push((r) => val(r[k]) !== val(v)), q),
    is: (k: string, v: unknown) => (uses(k), filters.push((r) => (r[k] ?? null) === v), q),
    in: (k: string, vs: unknown[]) => (uses(k), filters.push((r) => vs.includes(r[k])), q),
    not: (k: string, o: string, v: unknown) => (uses(k), filters.push(o === "in" ? (r) => r[k] != null && !String(v).replace(/^\(|\)$/g, "").split(",").includes(String(r[k])) : (r) => (r[k] ?? null) !== v), q),
    or: (s: string) => {
      const any = s.split(",").map(cond);
      any.forEach((c) => uses(c.col));
      filters.push((r) => any.some((c) => c.test(r)));
      return q;
    },
    like: (k: string, v: string) => (filters.push((r) => String(r[k] ?? "").startsWith(v.replace(/%$/, ""))), q),
    gt: (k: string, v: unknown) => cmp(k, (a, b) => a > b)(v),
    gte: (k: string, v: unknown) => cmp(k, (a, b) => a >= b)(v),
    lt: (k: string, v: unknown) => cmp(k, (a, b) => a < b)(v),
    lte: (k: string, v: unknown) => cmp(k, (a, b) => a <= b)(v),
    order: () => q,
    limit: (n: number) => ((limit = n), q),
    maybeSingle: () => ((single = true), q),
    then: (ok: (v: unknown) => unknown) => {
      // Like PostgREST before the migration: a column it doesn't know is an error, not an empty answer.
      if (unknown) return Promise.resolve({ data: null, count: null, error: { code: "42703", message: "column does not exist" } }).then(ok);
      if (op.kind === "insert") {
        const made: Row[] = op.rows.map((r) => ({ id: `id${++db.seq}`, created_at: new Date().toISOString(), ...r }));
        if (name === "lifecycle_events" && made.some((m) => rows().some((x) => x.contest_id === m.contest_id && x.kind === m.kind))) return Promise.resolve({ data: null, error: { code: "23505" } }).then(ok);
        rows().push(...made);
        return Promise.resolve({ data: single ? made[0] : made, error: null }).then(ok);
      }
      const hit = rows().filter((r) => filters.every((f) => f(r))).slice(0, limit);
      if (op.kind === "update") for (const r of hit) Object.assign(r, op.patch);
      if (op.kind === "delete") db.tables[name] = rows().filter((r) => !hit.includes(r));
      const data = hit.map((r) => (columns ? Object.fromEntries(columns.map((k) => [k, r[k]])) : { ...r }));
      return Promise.resolve({ data: head ? null : single ? (data[0] ?? null) : op.kind === "update" && !returning ? null : data, count: hit.length, error: null }).then(ok);
    },
  };
  return q;
}

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: vi.fn(), unstable_cache: (fn: unknown) => fn, updateTag: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (n: string) => table(n) }) }));
vi.mock("@/lib/settings", async () => {
  const { parseSetting } = await import("@/lib/settings/registry");
  return { getSettings: async (keys: string[]) => Object.fromEntries(keys.map((k) => [k, parseSetting(k as never, db.settings[k])])), settingsChanged: vi.fn() };
});
vi.mock("@/lib/admin/core", () => ({ one: <T>(v: T | T[] | null | undefined) => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null)) }));
vi.mock("@/lib/admin/recipients", () => ({ adminIdsWith: async () => ["m1"] }));
vi.mock("@/lib/notifications/switches", () => ({ typeChannelOn: async () => true, noticeOn: async () => true }));
vi.mock("@/lib/push", () => ({ notifyUser: async (...args: unknown[]) => (sent.push.push(args), 1) }));
vi.mock("@/lib/email/events", () => ({ emailText: async (input: Row) => (sent.email.push(input), "sent") }));
vi.mock("@/lib/content/texts", () => ({ translatorFor: async () => (key: string, p?: Record<string, unknown>) => (p ? `${key} ${JSON.stringify(p)}` : key) }));
vi.mock("@/lib/i18n/server", async () => {
  const { createTranslator } = await import("@/lib/i18n/translate");
  const messages = (await import("@/lib/i18n/messages/en")).default;
  return { getI18n: async () => ({ locale: "en", t: createTranslator("en", messages) }) };
});
vi.mock("@/lib/site-origin", () => ({ linkOrigin: async () => "https://logocontest.bd" }));
vi.mock("@/lib/payments/manual", () => ({ awaitingApproval: async (ids: string[]) => new Map((db.tables.manual_payments ?? []).filter((m) => m.status === "pending" && ids.includes(m.contest_id as string)).map((m) => [m.contest_id as string, m.id as string])) }));
vi.mock("@/lib/contests/resume", () => ({ resumeLink: async (id: string) => `https://logocontest.bd/r/link-${id}` }));
vi.mock("@/lib/guarantee/queries", () => ({ refundsIn: async () => ({ count: 0, amount: 0, fees: 0, extras: 0 }) }));

const NOW = at("2026-10-26T06:00:00Z"); // noon in Dhaka
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();
const V2_COLUMNS = ["brief_completion", "last_step", "pricing_viewed_at", "package_selected_at", "flow"];
const completion = { v: 2, edited: [], acceptedAt: null };
/** A contest saved by the new wizard at the logo name (step 2), with the starting package's amount. */
const v2Draft = (id: string, client: string, more: Row = {}): Row => ({ id, brand_name: id, total_amount: 4500, status: "draft", client_id: client, created_at: ago(20), updated_at: ago(20), brief_completion: completion, last_step: 2, pricing_viewed_at: null, package_selected_at: null, ...more });

beforeEach(() => {
  db.tables = { profiles: [{ id: "m1", role: "admin", status: "active", locale: "en", email: "m1@example.com" }] };
  // Off by default since the owner's email plan (2026-10-31); these tests are about a team that turned the first one on.
  db.settings = { "notify.unpaid_reminders": { first: true, last: false } };
  db.missing = new Set();
  sent.push = [];
  sent.email = [];
});

const alerts = () => (db.tables.notifications ?? []).map((n) => n.data as Row);

// ---- The team's instant alerts ----------------------------------------------------------------------------------------

describe("instant alerts for the new wizard's drafts", () => {
  it("wait until the client saw the prizes, then go once, without the starting package's amount", async () => {
    const { runUnpaidAlerts } = await import("@/lib/admin/unpaid-alerts");
    db.tables.contests = [v2Draft("v2a", "u1")];
    expect((await runUnpaidAlerts(NOW)).newUnpaid).toBe(0);
    // Not marked either, so it can still come.
    expect(db.tables.lifecycle_events ?? []).toEqual([]);
    Object.assign(db.tables.contests[0], { pricing_viewed_at: ago(18), last_step: 3, updated_at: ago(18) });
    expect((await runUnpaidAlerts(NOW)).newUnpaid).toBe(1);
    expect(alerts()).toHaveLength(1);
    expect(alerts()[0]).toMatchObject({ brand: "v2a", step: 7, lead: "c:v2a" });
    expect(alerts()[0].amount).toBeUndefined();
    expect((await runUnpaidAlerts(NOW)).newUnpaid).toBe(0);
  });

  it("take the step from the contest and show the amount once a package was picked or paying began; the old wizard's as before", async () => {
    const { runUnpaidAlerts } = await import("@/lib/admin/unpaid-alerts");
    const picked = { pricing_viewed_at: ago(30), package_selected_at: ago(25), total_amount: 6250 };
    db.tables.contests = [
      // Went on to pay the package shown without tapping a card: that amount is theirs.
      v2Draft("v2pay", "u1", { pricing_viewed_at: ago(30), last_step: 4, status: "pending_payment" }),
      v2Draft("v2back", "u2", { ...picked, last_step: 4 }),
      v2Draft("v2prize", "u3", { ...picked, last_step: 3 }),
      // The prizes were seen (step 3) though the time of it wasn't saved: still told, without the starting amount.
      v2Draft("v2lost", "u5", { last_step: 3 }),
      { id: "old", brand_name: "old", total_amount: 3000, status: "draft", client_id: "u4", created_at: ago(20), updated_at: ago(20), brief_completion: null, last_step: null, pricing_viewed_at: null, package_selected_at: null },
    ];
    // The old draft's own visit says Prize; a v2 visit on it (1..5 numbering) would say Review if it were counted.
    db.tables.wizard_visits = [
      { contest_id: "old", furthest_step: 7, created_at: ago(40), flow: "v1" },
      { contest_id: "old", furthest_step: 8, created_at: ago(40), flow: "v2" },
    ];
    expect((await runUnpaidAlerts(NOW)).newUnpaid).toBe(5);
    const by = new Map(alerts().map((a) => [a.brand, a]));
    expect(by.get("v2pay")).toMatchObject({ step: 9, amount: 4500 });
    expect(by.get("v2back")).toMatchObject({ step: 9, amount: 6250 });
    expect(by.get("v2prize")).toMatchObject({ step: 7, amount: 6250 });
    expect(by.get("v2lost")).toMatchObject({ step: 7 });
    expect(by.get("v2lost")!.amount).toBeUndefined();
    expect(by.get("old")).toMatchObject({ step: 7, amount: 3000 });
  });

  it("a v2 payment already sent is waiting for the team's check, as before: no alert", async () => {
    const { runUnpaidAlerts } = await import("@/lib/admin/unpaid-alerts");
    db.tables.contests = [v2Draft("v2sent", "u1", { pricing_viewed_at: ago(30), package_selected_at: ago(25), last_step: 4, status: "pending_payment" })];
    db.tables.manual_payments = [{ id: "mp", contest_id: "v2sent", kind: "contest", status: "pending" }];
    expect((await runUnpaidAlerts(NOW)).newUnpaid).toBe(0);
  });

  it("\"They came back\" and \"Payment failed\" also wait for the prizes, and hide the starting amount", async () => {
    const { alertCameBack, runUnpaidAlerts } = await import("@/lib/admin/unpaid-alerts");
    db.tables.contests = [v2Draft("v2a", "u1", { updated_at: ago(60) })];
    await alertCameBack("v2a", NOW);
    expect(alerts()).toEqual([]);
    Object.assign(db.tables.contests[0], { pricing_viewed_at: ago(60), last_step: 3 });
    await alertCameBack("v2a", NOW);
    expect(alerts()).toHaveLength(1);
    expect(alerts()[0]).toMatchObject({ step: 7 });
    expect(alerts()[0].amount).toBeUndefined();

    db.tables.notifications = [];
    db.tables.contests = [v2Draft("v2b", "u2"), v2Draft("v2c", "u3", { pricing_viewed_at: ago(30), package_selected_at: ago(25), total_amount: 6250, last_step: 4 })];
    db.tables.manual_payments = ["v2b", "v2c"].map((c) => ({ id: `mp-${c}`, contest_id: c, kind: "contest", status: "rejected", note: "Wrong ID", reviewed_by: "m9", reviewed_at: ago(5) }));
    expect((await runUnpaidAlerts(NOW)).failed).toBe(1);
    const failed = db.tables.notifications.filter((n) => n.type === "unpaid_failed_admin").map((n) => n.data);
    expect(failed).toEqual([expect.objectContaining({ brand: "v2c", amount: 6250, reason: "Wrong ID" })]);
  });

  it("\"Payment failed\" leaves out the bKash payments the new wizard closed (package or code changed); a card failure as before", async () => {
    const { runUnpaidAlerts } = await import("@/lib/admin/unpaid-alerts");
    const shown = { pricing_viewed_at: ago(30), package_selected_at: ago(25), total_amount: 6250, last_step: 4 };
    db.tables.contests = [
      v2Draft("v2back", "u1", shown),
      v2Draft("v2promo", "u2", { ...shown, status: "pending_payment" }),
      { id: "old", brand_name: "old", total_amount: 3000, status: "draft", client_id: "u3", created_at: ago(20), updated_at: ago(20), brief_completion: null, last_step: null, pricing_viewed_at: null, package_selected_at: null },
    ];
    db.tables.payments = [
      // Back from the payment step to change the package, and a code applied: the open bKash payment is closed as failed.
      { id: "p1", contest_id: "v2back", purpose: "contest", gateway: "bkash_personal", status: "failed", updated_at: ago(5) },
      { id: "p2", contest_id: "v2promo", purpose: "contest", gateway: "bkash_merchant", status: "failed", updated_at: ago(5) },
      // A card payment that really didn't go through.
      { id: "p3", contest_id: "old", purpose: "contest", gateway: "stripe", status: "failed", updated_at: ago(5) },
    ];
    expect((await runUnpaidAlerts(NOW)).failed).toBe(1);
    const failed = db.tables.notifications.filter((n) => n.type === "unpaid_failed_admin").map((n) => n.data);
    expect(failed).toEqual([expect.objectContaining({ brand: "old", amount: 3000, reason: "admin.unpaid.alerts.reasons.card" })]);
    expect((db.tables.lifecycle_events ?? []).map((e) => e.kind).filter((k) => String(k).startsWith("payfail"))).toEqual(["payfail:p3"]);
  });

  it("before migration 0079 every draft is the old wizard's, read without the new columns", async () => {
    const { alertCameBack, runUnpaidAlerts } = await import("@/lib/admin/unpaid-alerts");
    db.missing = new Set(V2_COLUMNS);
    db.tables.contests = [
      { id: "old1", brand_name: "old1", total_amount: 3000, status: "draft", client_id: "u1", created_at: ago(20), updated_at: ago(20) },
      { id: "old2", brand_name: "old2", total_amount: 5000, status: "pending_payment", client_id: "u2", created_at: ago(20), updated_at: ago(20) },
    ];
    db.tables.wizard_visits = [{ contest_id: "old1", furthest_step: 8, created_at: ago(40) }];
    expect((await runUnpaidAlerts(NOW)).newUnpaid).toBe(2);
    const by = new Map(alerts().map((a) => [a.brand, a]));
    expect(by.get("old1")).toMatchObject({ step: 8, amount: 3000 });
    expect(by.get("old2")).toMatchObject({ step: 9, amount: 5000 });
    db.tables.notifications = [];
    await alertCameBack("old1", NOW);
    expect(alerts()).toEqual([expect.objectContaining({ brand: "old1", step: 8, amount: 3000 })]);
  });
});

// ---- The client's automatic reminders -----------------------------------------------------------------------------------

describe("reminders for the new wizard's drafts", () => {
  const client = { id: "u1", role: "client", status: "active", email: "client@example.com", mobile: "+8801711111111", locale: "en", email_off: [] };
  const due = { created_at: ago(120), updated_at: ago(90) };

  it("none before the client saw the prizes (and nothing is marked); then as for any draft", async () => {
    const { runUnpaidReminders } = await import("@/lib/admin/unpaid-reminders");
    db.tables.profiles.push({ ...client });
    db.tables.contests = [v2Draft("v2a", "u1", due)];
    expect(await runUnpaidReminders(NOW)).toBe(0);
    expect(sent.email).toEqual([]);
    expect(db.tables.lifecycle_events ?? []).toEqual([]);
    Object.assign(db.tables.contests[0], { pricing_viewed_at: ago(95), last_step: 3 });
    expect(await runUnpaidReminders(NOW)).toBe(1);
    expect(sent.email[0]).toMatchObject({ key: "contest-reminder", userId: "u1", ref: "remind:v2a:first" });
    // The resume link works for v2 drafts as is (/r → /start?draft= forwards them to /start-v2).
    expect(String(sent.email[0].body)).toContain("https://logocontest.bd/r/link-v2a");
  });

  it("a client's older draft can still be reminded while their new v2 draft waits for the prizes", async () => {
    const { runUnpaidReminders } = await import("@/lib/admin/unpaid-reminders");
    db.tables.profiles.push({ ...client });
    db.tables.contests = [v2Draft("v2a", "u1", { created_at: ago(100), updated_at: ago(100) }), { id: "old", brand_name: "old", status: "draft", client_id: "u1", ...due, brief_completion: null, pricing_viewed_at: null }];
    expect(await runUnpaidReminders(NOW)).toBe(1);
    expect(sent.email.map((e) => e.ref)).toEqual(["remind:old:first"]);
  });

  it("many new v2 drafts before the prizes can't push an older due draft out of the drafts read", async () => {
    const { runUnpaidReminders } = await import("@/lib/admin/unpaid-reminders");
    db.tables.profiles.push({ ...client });
    // Newest first, as the read orders them (the fake keeps the table's order); 200 is the read's limit.
    const early = Array.from({ length: 200 }, (_, i) => v2Draft(`v2-${i}`, `x${i}`, { created_at: ago(30), updated_at: ago(30) }));
    db.tables.contests = [...early, { id: "old", brand_name: "old", status: "draft", client_id: "u1", ...due, brief_completion: null, last_step: null, pricing_viewed_at: null, package_selected_at: null }];
    expect(await runUnpaidReminders(NOW)).toBe(1);
    expect(sent.email.map((e) => e.ref)).toEqual(["remind:old:first"]);
  });

  it("before migration 0079 the drafts are read without the new columns, as before", async () => {
    const { runUnpaidReminders } = await import("@/lib/admin/unpaid-reminders");
    db.missing = new Set(V2_COLUMNS);
    db.tables.profiles.push({ ...client });
    db.tables.contests = [{ id: "old", brand_name: "old", status: "draft", client_id: "u1", ...due }];
    expect(await runUnpaidReminders(NOW)).toBe(1);
    expect(sent.email.map((e) => e.ref)).toEqual(["remind:old:first"]);
  });
});

// ---- Admin › Dashboard --------------------------------------------------------------------------------------------------

describe("the Dashboard's funnels", () => {
  const period = { since: at("2026-10-20T00:00:00Z"), until: at("2026-10-27T00:00:00Z") };
  const inside = "2026-10-24T08:00:00Z";
  const before = "2026-10-10T08:00:00Z";
  const v1Visits = () => [
    { furthest_step: 3, contest_id: null, created_at: inside, flow: "v1" },
    { furthest_step: 9, contest_id: "k1", created_at: inside, flow: "v1" },
  ];
  const v2Visits = () =>
    [1, 2, 2, 3, 5].map((step, i) => ({ furthest_step: step, contest_id: step >= 3 ? `v2${i}` : null, created_at: inside, flow: "v2" })).concat({ furthest_step: 5, contest_id: null, created_at: before, flow: "v2" });
  const v2Contest = (id: string, more: Row = {}): Row => ({ id, status: "draft", created_at: inside, brief_completion: completion, pricing_viewed_at: null, package_selected_at: null, ...more });
  const oldFunnel = [2, 2, 2, 1, 1, 1, 1, 1, 1, 1];

  it("the drop-off chart counts the old wizard's visits only; the new wizard's funnel counts its own steps", async () => {
    const { dashboardStats } = await import("@/lib/admin/dashboard");
    db.tables.wizard_visits = [...v1Visits(), ...v2Visits()];
    db.tables.contests = [
      { id: "k1", status: "open", created_at: inside, starts_at: inside, brief_completion: null },
      v2Contest("a", { pricing_viewed_at: inside }),
      v2Contest("b", { pricing_viewed_at: inside, package_selected_at: inside, status: "open", starts_at: inside }),
      v2Contest("c", { pricing_viewed_at: inside, package_selected_at: inside, status: "pending_payment" }),
      v2Contest("d"),
      // Made before the period.
      v2Contest("e", { created_at: before, pricing_viewed_at: before }),
    ];
    db.tables.manual_payments = [
      { contest_id: "a", kind: "contest", status: "rejected" },
      { contest_id: "b", kind: "contest", status: "approved" },
      { contest_id: "c", kind: "contest", status: "pending" },
      { contest_id: "d", kind: "addon", status: "pending" },
    ];
    const s = (await dashboardStats(period))!;
    expect(s.funnel.map((f) => f.visits)).toEqual(oldFunnel);
    expect(s.v2Funnel).toEqual([
      { key: "started", count: 5, ofBefore: null },
      { key: "account", count: 4, ofBefore: 80 },
      { key: "basics", count: 4, ofBefore: 100 },
      { key: "viewed", count: 3, ofBefore: 75 },
      { key: "picked", count: 2, ofBefore: 67 },
      { key: "sent", count: 2, ofBefore: 100 },
      { key: "approved", count: 1, ofBefore: 50 },
    ]);
  });

  it("each step counts on: paying the package shown without a tap on a card is a pick, and the prizes were seen", async () => {
    const { dashboardStats } = await import("@/lib/admin/dashboard");
    db.tables.wizard_visits = v1Visits();
    db.tables.contests = [
      { id: "k1", status: "open", created_at: inside, starts_at: inside, brief_completion: null },
      // Went on to pay the starting package (no card tapped); the time the prizes were seen wasn't saved either.
      v2Contest("pay", { last_step: 4, status: "pending_payment" }),
      v2Contest("sent", { pricing_viewed_at: inside, last_step: 4 }),
      v2Contest("live", { status: "open", starts_at: inside }),
      v2Contest("prizes", { last_step: 3 }),
      v2Contest("name", { last_step: 2 }),
    ];
    db.tables.manual_payments = [{ contest_id: "sent", kind: "contest", status: "pending" }];
    const s = (await dashboardStats(period))!;
    expect(s.funnel.map((f) => f.visits)).toEqual(oldFunnel);
    expect(s.v2Funnel!.map((f) => [f.key, f.count])).toEqual([["started", 0], ["account", 0], ["basics", 5], ["viewed", 4], ["picked", 3], ["sent", 2], ["approved", 1]]);
    for (const f of s.v2Funnel!) expect(f.ofBefore ?? 0).toBeLessThanOrEqual(100);
  });

  it("opened step 1 and made an account count once per contest, and not for a return to a contest made before the period", async () => {
    const { dashboardStats } = await import("@/lib/admin/dashboard");
    db.tables.wizard_visits = [
      ...v1Visits(),
      // A new client's draft, open in three tabs (each tab is a visit of its own).
      { furthest_step: 3, contest_id: "a", created_at: inside, flow: "v2" },
      { furthest_step: 4, contest_id: "a", created_at: inside, flow: "v2" },
      { furthest_step: 2, contest_id: "a", created_at: inside, flow: "v2" },
      // Someone who stopped at step 1.
      { furthest_step: 1, contest_id: null, created_at: inside, flow: "v2" },
      // A resume link (or a signed-in return) to a draft made before the period, in two tabs.
      { furthest_step: 4, contest_id: "e", created_at: inside, flow: "v2" },
      { furthest_step: 3, contest_id: "e", created_at: inside, flow: "v2" },
    ];
    db.tables.contests = [
      { id: "k1", status: "open", created_at: inside, starts_at: inside, brief_completion: null },
      v2Contest("a", { pricing_viewed_at: inside, last_step: 4, status: "pending_payment" }),
      v2Contest("e", { created_at: before, pricing_viewed_at: before, last_step: 4 }),
    ];
    const s = (await dashboardStats(period))!;
    expect(s.funnel.map((f) => f.visits)).toEqual(oldFunnel);
    expect(s.v2Funnel!.map((f) => [f.key, f.count])).toEqual([["started", 2], ["account", 1], ["basics", 1], ["viewed", 1], ["picked", 1], ["sent", 0], ["approved", 0]]);
    // Only a return to an older draft: nothing in the period.
    db.tables.wizard_visits = [...v1Visits(), { furthest_step: 4, contest_id: "e", created_at: inside, flow: "v2" }];
    db.tables.contests = db.tables.contests.filter((c) => c.id !== "a");
    expect((await dashboardStats(period))!.v2Funnel).toBeNull();
  });

  it("hidden when nobody used the new wizard in the period", async () => {
    const { dashboardStats } = await import("@/lib/admin/dashboard");
    db.tables.wizard_visits = [...v1Visits(), { furthest_step: 5, contest_id: null, created_at: before, flow: "v2" }];
    db.tables.contests = [{ id: "k1", status: "open", created_at: inside, starts_at: inside, brief_completion: null }, v2Contest("e", { created_at: before })];
    const s = (await dashboardStats(period))!;
    expect(s.funnel.map((f) => f.visits)).toEqual(oldFunnel);
    expect(s.v2Funnel).toBeNull();
  });

  it("before migration 0079 every visit is the old wizard's and the new funnel is hidden", async () => {
    const { dashboardStats } = await import("@/lib/admin/dashboard");
    db.missing = new Set(V2_COLUMNS);
    db.tables.wizard_visits = v1Visits().map((v) => ({ furthest_step: v.furthest_step, contest_id: v.contest_id, created_at: v.created_at }));
    db.tables.contests = [{ id: "k1", status: "open", created_at: inside, starts_at: inside }];
    const s = (await dashboardStats(period))!;
    expect(s.funnel.map((f) => f.visits)).toEqual(oldFunnel);
    expect(s.v2Funnel).toBeNull();
  });

  it("a step after an empty one has no share", async () => {
    const { v2FunnelOf } = await import("@/lib/admin/dashboard");
    const funnel = v2FunnelOf([{ furthest_step: 1 }], [], new Set())!;
    expect(funnel.map((f) => [f.count, f.ofBefore])).toEqual([[1, null], [0, 0], [0, null], [0, null], [0, null], [0, null], [0, null]]);
  });

  it("the card shows each step with its share of the step before, next to the drop-off chart", async () => {
    const { v2FunnelOf } = await import("@/lib/admin/dashboard");
    const { V2FunnelCard } = await import("@/components/admin/v2-funnel");
    const steps = v2FunnelOf([{ furthest_step: 1 }, { furthest_step: 2 }], [{ id: "a", status: "draft", pricing_viewed_at: null, package_selected_at: null }], new Set())!;
    const html = renderToStaticMarkup(await V2FunnelCard({ steps }));
    for (const text of ["New wizard (4 steps)", "How many people reached each step in this period.", "Opened step 1", "Made an account", "Gave the logo name", "Saw the prizes", "Picked a package", "Sent the payment", "Approved"]) expect(html).toContain(text);
    // 2 → 1 → 1 → 0 → 0 …: no share on the first step, nor after one with nobody.
    expect(html).toContain("50% of the step before");
    expect(html).toContain("100% of the step before");
    expect(html).toContain("0% of the step before");
    expect(html.match(/of the step before/g)).toHaveLength(3);
    const page = read("src/app/admin/page.tsx");
    expect(page).toContain("{s.v2Funnel && <V2FunnelCard steps={s.v2Funnel} />}");
    expect(page.indexOf("<V2FunnelCard")).toBeGreaterThan(page.indexOf('t("admin.dashboard.funnelEmpty")'));
  });

  it("uses only texts that exist in English and Bangla", async () => {
    const { V2_FUNNEL } = await import("@/lib/admin/dashboard");
    for (const m of [en, bn]) {
      const f = m.wizardV2.admin.funnel as Record<string, string>;
      for (const key of [...V2_FUNNEL, "title", "help", "of"]) expect(f[key], key).toBeTruthy();
      expect(f.of).toContain("{pct}");
    }
  });
});
