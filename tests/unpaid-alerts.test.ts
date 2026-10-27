import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Owner, 2026-10-26 (Design/unpaid-contests §2, §9): the team's instant alerts and the automatic reminders to clients.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const at = (iso: string) => new Date(iso);

// ---- Pure rules -------------------------------------------------------------------------------------------------------

describe("instant alert rules", () => {
  it("has the design's defaults, and keeps the other choices when a stored setting lacks a newer switch", async () => {
    const { DEFAULT_ALERTS, alertsSchema } = await import("@/lib/admin/unpaid-alert-rules");
    expect(DEFAULT_ALERTS).toEqual({
      events: { new_unpaid: true, payment_failed: true, came_back: true, creating_now: false, followup_due: true, followup_overdue: true },
      send: { popup: true, sound: true, push: true, email: false },
      quiet: { on: true, from: 0, to: 8 },
    });
    const old = alertsSchema.parse({ events: { came_back: false }, send: { email: true } });
    expect(old.events).toMatchObject({ came_back: false, new_unpaid: true, creating_now: false });
    expect(old.send).toEqual({ popup: true, sound: true, push: true, email: true });
    expect(alertsSchema.safeParse({ quiet: { from: 25 } }).success).toBe(false);
  });

  it("quiet hours are Bangladesh time, and can run past midnight", async () => {
    const { inQuietHours } = await import("@/lib/admin/unpaid-alert-rules");
    const q = { on: true, from: 0, to: 8 };
    // 00:30, 01:30 and 07:59 Dhaka are quiet; 08:00 and 23:00 are not.
    expect([at("2026-10-25T18:30:00Z"), at("2026-10-25T19:30:00Z"), at("2026-10-26T01:59:00Z"), at("2026-10-26T02:00:00Z"), at("2026-10-26T17:00:00Z")].map((d) => inQuietHours(q, d))).toEqual([true, true, true, false, false]);
    const late = { on: true, from: 22, to: 7 };
    expect([at("2026-10-26T16:30:00Z"), at("2026-10-26T00:30:00Z"), at("2026-10-26T06:00:00Z")].map((d) => inQuietHours(late, d))).toEqual([true, true, false]);
    expect(inQuietHours({ ...q, on: false }, at("2026-10-25T19:30:00Z"))).toBe(false);
  });

  it("a follow-up is due in the [10 min] before its time, and overdue once its day is over", async () => {
    const { isDueSoon, isOverdueDay } = await import("@/lib/admin/unpaid-alert-rules");
    const now = at("2026-10-26T05:00:00Z"); // 11:00 Dhaka
    expect(isDueSoon(at("2026-10-26T05:09:00Z"), now, 10)).toBe(true);
    expect(isDueSoon(at("2026-10-26T05:11:00Z"), now, 10)).toBe(false);
    // Just missed by a run (the 15-minute job alone): still told once; long past: no.
    expect(isDueSoon(at("2026-10-26T04:50:00Z"), now, 10)).toBe(true);
    expect(isDueSoon(at("2026-10-26T04:40:00Z"), now, 10)).toBe(false);
    // Planned yesterday (Dhaka) and not done: overdue. Earlier today: not yet. Older days: told already.
    expect(isOverdueDay(at("2026-10-25T12:00:00Z"), now)).toBe(true);
    expect(isOverdueDay(at("2026-10-26T03:00:00Z"), now)).toBe(false);
    expect(isOverdueDay(at("2026-10-23T12:00:00Z"), now)).toBe(false);
  });

  it("\"Remind me by\" decides how a follow-up's owner is told; SMS can't be chosen yet", async () => {
    const { cleanRemindBy, followUpWays } = await import("@/lib/admin/unpaid-alert-rules");
    const send = { popup: true, sound: true, push: true, email: false };
    expect(cleanRemindBy(["alert", "sms", "email", "x", "alert"])).toEqual(["alert", "email"]);
    expect(cleanRemindBy(null)).toBeNull();
    expect(followUpWays(send, null)).toEqual({ push: true, email: false });
    expect(followUpWays(send, ["email"])).toEqual({ push: false, email: true });
    expect(followUpWays({ ...send, push: false }, ["alert"])).toEqual({ push: false, email: false });
  });

  it("keeps phone numbers and emails out of free text that reaches bells and phones", async () => {
    const { scrubContacts } = await import("@/lib/admin/unpaid-alert-rules");
    expect(scrubContacts("No payment from 01712-345678 received")).toBe("No payment from … received");
    expect(scrubContacts("Sender +880 1712 345678")).toBe("Sender …");
    expect(scrubContacts("mail rahim@example.com")).toBe("mail …");
    expect(scrubContacts("০১৭১২৩৪৫৬৭৮ থেকে আসেনি")).toBe("… থেকে আসেনি");
    expect(scrubContacts("Sample Tea 2026 · TrxID 9B7XK2LQ")).toBe("Sample Tea 2026 · TrxID 9B7XK2LQ");
  });

  it("every alert type has its event, and guests who left a number count as new unpaid contests", async () => {
    const { eventOf, POP_TYPES } = await import("@/lib/admin/unpaid-alert-rules");
    expect(eventOf("lead_new_admin")).toBe("new_unpaid");
    expect(eventOf("followup_overdue_admin")).toBe("followup_overdue");
    expect(eventOf("payment_received")).toBeNull();
    expect(POP_TYPES).toHaveLength(8);
  });
});

describe("automatic reminder rules", () => {
  const H = 3_600_000;
  const base = { firstHours: 1, lastHours: 48, trashHours: 72, sent: { first: false, last: false }, on: { first: true, last: true } };
  const t0 = at("2026-10-26T04:00:00Z");
  const after = (h: number) => new Date(t0.getTime() + h * H);

  it("the first email an hour after their last activity, the last one at 2 days, before the Trash", async () => {
    const { reminderDue } = await import("@/lib/admin/unpaid-alert-rules");
    expect(reminderDue({ ...base, createdAt: t0, lastActivity: t0, now: after(0.5) })).toBeNull();
    expect(reminderDue({ ...base, createdAt: t0, lastActivity: t0, now: after(1) })).toBe("first");
    // Still busy on it 2 hours later: not yet.
    expect(reminderDue({ ...base, createdAt: t0, lastActivity: after(1.5), now: after(2) })).toBeNull();
    expect(reminderDue({ ...base, createdAt: t0, lastActivity: t0, now: after(1), sent: { first: true, last: false } })).toBeNull();
    expect(reminderDue({ ...base, createdAt: t0, lastActivity: t0, now: after(49), sent: { first: true, last: false } })).toBe("last");
    // Off (the default), too late, or the Trash is near: none.
    expect(reminderDue({ ...base, on: { first: true, last: false }, createdAt: t0, lastActivity: t0, now: after(49), sent: { first: true, last: false } })).toBeNull();
    expect(reminderDue({ ...base, createdAt: t0, lastActivity: t0, now: after(71.8), sent: { first: true, last: false } })).toBeNull();
    // Set close to the Trash, the last one moves earlier so its window has daytime hours.
    expect(reminderDue({ ...base, lastHours: 70, createdAt: t0, lastActivity: t0, now: after(58), sent: { first: true, last: false } })).toBe("last");
    // A first reminder never comes after the last one, or once the last one's time has come.
    expect(reminderDue({ ...base, createdAt: t0, lastActivity: t0, now: after(50), sent: { first: false, last: true } })).toBeNull();
    expect(reminderDue({ ...base, on: { first: true, last: false }, createdAt: t0, lastActivity: t0, now: after(50) })).toBeNull();
  });

  it("stop when they paid, wait for a bKash check, replied, or the team closed or stopped the lead", async () => {
    const { remindersStopped } = await import("@/lib/admin/unpaid-alert-rules");
    const ok = { status: "draft", awaitingApproval: false, lead: null, replied: false, blockedContact: false };
    expect(remindersStopped(ok)).toBe(false);
    expect(remindersStopped({ ...ok, status: "pending_payment" })).toBe(false);
    for (const stop of [{ status: "open" }, { awaitingApproval: true }, { replied: true }, { blockedContact: true }, { lead: { status: "closed", stop: false, hidden: false, blocked: false } }, { lead: { status: "in_touch", stop: true, hidden: false, blocked: false } }]) {
      expect(remindersStopped({ ...ok, ...stop }), JSON.stringify(stop)).toBe(true);
    }
  });

  it("only between 8 am and 10 pm in Bangladesh", async () => {
    const { clientHour } = await import("@/lib/admin/unpaid-alert-rules");
    expect([at("2026-10-26T01:59:00Z"), at("2026-10-26T02:00:00Z"), at("2026-10-26T15:59:00Z"), at("2026-10-26T16:00:00Z")].map(clientHour)).toEqual([false, true, true, false]);
  });
});

// ---- The senders, with a small fake database ------------------------------------------------------------------------------

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, settings: {} as Record<string, unknown>, seq: 0, down: new Set<string>() }));
const who = vi.hoisted(() => ({ admin: null as null | Row, perm: [] as string[] }));
const sent = vi.hoisted(() => ({ push: [] as unknown[][], email: [] as Row[], audits: [] as unknown[][], emailStatus: "sent" }));

const val = (v: unknown) => (typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v) ? Date.parse(v) : v);
function cond(expr: string): (r: Row) => boolean {
  const [col, op, ...rest] = expr.split(".");
  const raw = rest.join(".");
  if (op === "is") return (r) => (r[col] ?? null) === null;
  if (op === "in") {
    const list = raw.replace(/^\(|\)$/g, "").split(",");
    return (r) => list.includes(String(r[col]));
  }
  const v = raw.startsWith('"') ? JSON.parse(raw) : raw;
  return op === "neq" ? (r) => val(r[col]) !== val(v) : (r) => val(r[col]) === val(v);
}
const splitOr = (s: string) => s.split(/,(?![^(]*\))/);

function table(name: string) {
  const rows = () => (db.tables[name] ??= []);
  const filters: ((r: Row) => boolean)[] = [];
  let op: { kind: "select" } | { kind: "insert"; rows: Row[] } | { kind: "update"; patch: Row } | { kind: "delete" } | { kind: "upsert"; row: Row } = { kind: "select" };
  let single = false;
  let head = false;
  let returning = false;
  let limit = Infinity;
  const cmp = (k: string, f: (a: number, b: number) => boolean) => (v: unknown) => (filters.push((r) => r[k] != null && f(Number(val(r[k])), Number(val(v)))), q);
  const q = {
    select: (_c?: string, o?: { head?: boolean }) => ((head = Boolean(o?.head)), (returning = op.kind !== "select"), q),
    insert: (r: Row | Row[]) => ((op = { kind: "insert", rows: Array.isArray(r) ? r : [r] }), q),
    upsert: (r: Row) => ((op = { kind: "upsert", row: r }), q),
    update: (p: Row) => ((op = { kind: "update", patch: p }), q),
    delete: () => ((op = { kind: "delete" }), q),
    eq: (k: string, v: unknown) => (filters.push((r) => val(r[k]) === val(v)), q),
    neq: (k: string, v: unknown) => (filters.push((r) => val(r[k]) !== val(v)), q),
    is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
    in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), q),
    not: (k: string, _o: string, v: unknown) => (filters.push((r) => (r[k] ?? null) !== v), q),
    like: (k: string, v: string) => (filters.push((r) => String(r[k] ?? "").startsWith(v.replace(/%$/, ""))), q),
    or: (s: string) => (filters.push((r) => splitOr(s).some((c) => cond(c)(r))), q),
    gt: (k: string, v: unknown) => cmp(k, (a, b) => a > b)(v),
    gte: (k: string, v: unknown) => cmp(k, (a, b) => a >= b)(v),
    lt: (k: string, v: unknown) => cmp(k, (a, b) => a < b)(v),
    lte: (k: string, v: unknown) => cmp(k, (a, b) => a <= b)(v),
    order: () => q,
    limit: (n: number) => ((limit = n), q),
    maybeSingle: () => ((single = true), q),
    then: (ok: (v: unknown) => unknown) => {
      if (db.down.has(name)) return Promise.resolve({ data: null, count: null, error: { code: "08006", message: "down" } }).then(ok);
      if (op.kind === "insert") {
        const made: Row[] = op.rows.map((r) => ({ id: `id${++db.seq}`, created_at: new Date().toISOString(), ...r }));
        if (name === "lifecycle_events" && made.some((m) => rows().some((x) => x.contest_id === m.contest_id && x.kind === m.kind))) return Promise.resolve({ data: null, error: { code: "23505" } }).then(ok);
        rows().push(...made);
        return Promise.resolve({ data: single ? made[0] : made, error: null }).then(ok);
      }
      if (op.kind === "upsert") {
        const at = rows().findIndex((x) => x.key === (op as { row: Row }).row.key);
        if (at >= 0) rows()[at] = (op as { row: Row }).row;
        else rows().push((op as { row: Row }).row);
        return Promise.resolve({ data: null, error: null }).then(ok);
      }
      const hit = rows().filter((r) => filters.every((f) => f(r))).slice(0, limit);
      if (op.kind === "update") for (const r of hit) Object.assign(r, op.patch);
      if (op.kind === "delete") db.tables[name] = rows().filter((r) => !hit.includes(r));
      const data = hit.map((r) => ({ ...r }));
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
vi.mock("@/lib/admin/core", () => ({
  adminUser: async (perm?: string) => (who.admin && (!perm || who.perm.includes(perm)) ? who.admin : null),
  audit: async (...args: unknown[]) => void sent.audits.push(args),
}));
vi.mock("@/lib/admin/recipients", () => ({ adminIdsWith: async (perm: string) => (perm === "unpaid.manage" ? ["m1", "m2"] : ["m1", "m2", "v1"]) }));
vi.mock("@/lib/notifications/switches", () => ({ typeChannelOn: async () => true, noticeOn: async () => true }));
vi.mock("@/lib/push", () => ({ notifyUser: async (...args: unknown[]) => (sent.push.push(args), 1) }));
vi.mock("@/lib/email/events", () => ({ emailText: async (input: Row) => (sent.email.push(input), sent.emailStatus) }));
vi.mock("@/lib/content/texts", () => ({ translatorFor: async () => (key: string, p?: Record<string, unknown>) => (p ? `${key} ${JSON.stringify(p)}` : key) }));
vi.mock("@/lib/i18n/server", () => ({ getI18n: async () => ({ locale: "en", t: (key: string, p?: Record<string, unknown>) => (p ? `${key} ${JSON.stringify(p)}` : key) }) }));
vi.mock("@/lib/site-origin", () => ({ linkOrigin: async () => "https://logocontest.bd" }));
vi.mock("@/lib/payments/manual", () => ({ awaitingApproval: async (ids: string[]) => new Map((db.tables.manual_payments ?? []).filter((m) => m.status === "pending" && ids.includes(m.contest_id as string)).map((m) => [m.contest_id as string, m.id as string])) }));
vi.mock("@/lib/auth/contact-blocks", () => ({ contactBlocked: async () => false }));
// The reminder's button is the client's resume link (owner, 2026-10-26; tests/resume-link.test.ts).
vi.mock("@/lib/contests/resume", () => ({ resumeLink: async (id: string) => `https://logocontest.bd/r/link-${id}` }));

const NOW = at("2026-10-26T06:00:00Z"); // noon in Dhaka
const C = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";
const admins = () => [
  { id: "m1", role: "admin", status: "active", locale: "en", email: "m1@example.com" },
  { id: "m2", role: "admin", status: "active", locale: "bn", email: "m2@example.com" },
  { id: "v1", role: "admin", status: "active", locale: "en", email: "v1@example.com" },
];

beforeEach(() => {
  db.tables = { profiles: admins() };
  db.settings = {};
  db.down = new Set();
  who.admin = { id: "m1", locale: "en" };
  who.perm = ["unpaid.view", "unpaid.manage"];
  sent.push = [];
  sent.email = [];
  sent.audits = [];
  sent.emailStatus = "sent";
});

describe("sending an alert", () => {
  it("goes to the bell (and pop-up) of each admin, by push, and by email only when chosen; never a number", async () => {
    const { sendUnpaidAlert } = await import("@/lib/admin/unpaid-alerts");
    const n = await sendUnpaidAlert({ event: "new_unpaid", type: "unpaid_new_admin", to: ["m1", "m2", "x9"], data: { brand: "Sample Tea", step: 9, amount: 6250, lead: `c:${C}` }, link: `/admin/unpaid?sel=c:${C}#lead`, ref: `c:${C}`, now: NOW });
    expect(n).toBe(2);
    expect(db.tables.notifications.map((r) => r.user_id)).toEqual(["m1", "m2"]);
    expect(sent.push).toHaveLength(2);
    expect(sent.email).toHaveLength(0);
    expect(JSON.stringify(db.tables.notifications)).not.toMatch(/\+?8801|01\d{9}/);
  });

  it("in quiet hours only collects in the bell; an event switched off sends nothing", async () => {
    const { sendUnpaidAlert } = await import("@/lib/admin/unpaid-alerts");
    db.settings["notify.unpaid_alerts"] = { send: { email: true } };
    const night = at("2026-10-25T20:00:00Z"); // 2 am Dhaka
    await sendUnpaidAlert({ event: "payment_failed", type: "unpaid_failed_admin", to: ["m1"], data: { brand: "X" }, link: "/admin/unpaid", ref: "c:x", now: night });
    expect(db.tables.notifications).toHaveLength(1);
    expect(sent.push).toHaveLength(0);
    expect(sent.email).toHaveLength(0);
    // By day, with email on: no brand or name in the email.
    await sendUnpaidAlert({ event: "payment_failed", type: "unpaid_failed_admin", to: ["m1"], data: { brand: "Secret Brand" }, link: "/admin/unpaid", ref: "c:x", now: NOW });
    expect(sent.email).toHaveLength(1);
    expect(JSON.stringify(sent.email[0])).not.toContain("Secret Brand");
    db.settings["notify.unpaid_alerts"] = { events: { payment_failed: false } };
    expect(await sendUnpaidAlert({ event: "payment_failed", type: "unpaid_failed_admin", to: ["m1"], data: {}, link: "/admin/unpaid", ref: "c:x", now: NOW })).toBe(0);
  });
});

describe("the checks", () => {
  it("a saved draft that stopped [15 min] ago alerts once; one still on the page, closed or waiting for bKash doesn't", async () => {
    const { runUnpaidAlerts } = await import("@/lib/admin/unpaid-alerts");
    const stopped = new Date(NOW.getTime() - 20 * 60_000).toISOString();
    db.tables.contests = [
      { id: C, brand_name: "Sample Tea", total_amount: 6250, status: "pending_payment", client_id: "u1", created_at: stopped, updated_at: stopped },
      { id: "c2", brand_name: "Still here", total_amount: 3000, status: "draft", client_id: "u2", created_at: stopped, updated_at: stopped },
      { id: "c3", brand_name: "Closed", total_amount: 3000, status: "draft", client_id: "u3", created_at: stopped, updated_at: stopped },
      { id: "c4", brand_name: "bKash", total_amount: 3000, status: "pending_payment", client_id: "u4", created_at: stopped, updated_at: stopped },
    ];
    db.tables.wizard_live = [{ contest_id: "c2", updated_at: new Date(NOW.getTime() - 60_000).toISOString() }];
    db.tables.unpaid_leads = [{ contest_id: "c3", status: "closed" }];
    db.tables.manual_payments = [{ id: "mp", contest_id: "c4", status: "pending" }];
    const first = await runUnpaidAlerts(NOW);
    expect(first.newUnpaid).toBe(1);
    expect(db.tables.notifications.every((r) => r.type === "unpaid_new_admin" && (r.data as Row).brand === "Sample Tea" && (r.data as Row).step === 9)).toBe(true);
    expect((await runUnpaidAlerts(NOW)).newUnpaid).toBe(0);
  });

  it("a failed card payment or a bKash payment the team couldn't approve alerts once, with why (not to the admin who rejected it)", async () => {
    const { runUnpaidAlerts } = await import("@/lib/admin/unpaid-alerts");
    db.tables.contests = [{ id: C, brand_name: "Sample Tea", total_amount: 6250, status: "draft", client_id: "u1" }];
    db.tables.payments = [{ id: "p1", contest_id: C, purpose: "contest", status: "failed", updated_at: new Date(NOW.getTime() - 60_000).toISOString() }];
    db.tables.manual_payments = [{ id: "mp1", contest_id: C, kind: "contest", status: "rejected", note: "Wrong transaction ID", reviewed_by: "m1", reviewed_at: new Date(NOW.getTime() - 60_000).toISOString() }];
    expect((await runUnpaidAlerts(NOW)).failed).toBe(2);
    const reasons = db.tables.notifications.map((r) => `${r.user_id}:${(r.data as Row).reason}`);
    expect(reasons).toContain("m2:Wrong transaction ID");
    expect(reasons).not.toContain("m1:Wrong transaction ID");
    expect(reasons).toContain("m1:admin.unpaid.alerts.reasons.card");
    expect((await runUnpaidAlerts(NOW)).failed).toBe(0);
  });

  it("a follow-up due soon tells its owner once; a new time alerts again; overdue once its day is over", async () => {
    const { runUnpaidAlerts } = await import("@/lib/admin/unpaid-alerts");
    const soon = new Date(NOW.getTime() + 8 * 60_000).toISOString();
    db.tables.unpaid_leads = [
      { id: "L1", kind: "contest", contest_id: C, brand_snapshot: "Sample Tea", owner_id: "m2", status: "in_touch", next_followup_at: soon, remind_by: ["alert"] },
      { id: "L2", kind: "guest", guest_mobile: "+8801711111111", brand_snapshot: "Guest Tea", owner_id: "m1", status: "new", next_followup_at: "2026-10-25T10:00:00.000Z" },
    ];
    db.tables.wizard_leads = [{ visit_id: "11111111-1111-4111-8111-111111111111", mobile: "+8801711111111", updated_at: "2026-10-25T09:00:00Z" }];
    db.tables.contests = [{ id: C, status: "draft" }, { id: "paid", status: "open" }];
    // Paid since: no follow-up alert any more.
    db.tables.unpaid_leads.push({ id: "L3", kind: "contest", contest_id: "paid", brand_snapshot: "Paid Co", owner_id: "m1", status: "promised", next_followup_at: soon });
    expect(await runUnpaidAlerts(NOW)).toMatchObject({ due: 1, overdue: 1 });
    const due = db.tables.notifications.find((r) => r.type === "followup_due_admin")!;
    expect(due.user_id).toBe("m2");
    const overdue = db.tables.notifications.find((r) => r.type === "followup_overdue_admin")!;
    expect(overdue.link).toBe("/admin/unpaid?sel=g:11111111-1111-4111-8111-111111111111#lead");
    expect(JSON.stringify(db.tables.notifications)).not.toContain("8801711111111");
    expect(await runUnpaidAlerts(NOW)).toMatchObject({ due: 0, overdue: 0 });
    db.tables.unpaid_leads[0].next_followup_at = new Date(NOW.getTime() + 5 * 60_000).toISOString();
    expect((await runUnpaidAlerts(NOW)).due).toBe(1);
  });

  it("overdue waits for the end of quiet hours; \"Remind me by\" without Admin alert stays out of pop-ups and push", async () => {
    const { runUnpaidAlerts } = await import("@/lib/admin/unpaid-alerts");
    db.tables.unpaid_leads = [{ id: "L2", kind: "contest", contest_id: C, brand_snapshot: "Sample Tea", owner_id: "m1", status: "new", next_followup_at: "2026-10-25T10:00:00.000Z", remind_by: ["email"] }];
    db.tables.contests = [{ id: C, status: "draft" }];
    expect((await runUnpaidAlerts(at("2026-10-25T20:00:00Z"))).overdue).toBe(0);
    expect((await runUnpaidAlerts(at("2026-10-26T03:00:00Z"))).overdue).toBe(1);
    expect(db.tables.notifications[0].data).toMatchObject({ pop: false });
    expect(sent.push).toHaveLength(0);
    expect(sent.email).toHaveLength(1);
  });

  it("one \"New unpaid contest\" a day per client, however many drafts they save", async () => {
    const { runUnpaidAlerts } = await import("@/lib/admin/unpaid-alerts");
    const stopped = new Date(NOW.getTime() - 20 * 60_000).toISOString();
    db.tables.contests = ["d1", "d2", "d3"].map((id) => ({ id, brand_name: id, total_amount: 1000, status: "draft", client_id: "u1", created_at: stopped, updated_at: stopped }));
    expect((await runUnpaidAlerts(NOW)).newUnpaid).toBe(1);
    expect((await runUnpaidAlerts(NOW)).newUnpaid).toBe(0);
  });
});

describe("automatic reminders", () => {
  const client = (more: Row = {}) => ({ id: "u1", role: "client", status: "active", email: "client@example.com", mobile: "+8801711111111", locale: "en", email_off: [], ...more });
  const draft = (more: Row = {}) => ({ id: C, brand_name: "Sample Tea", status: "draft", client_id: "u1", created_at: new Date(NOW.getTime() - 2 * 3_600_000).toISOString(), updated_at: new Date(NOW.getTime() - 90 * 60_000).toISOString(), ...more });

  it("sends the first email once, with a link that works when signed out, to its own Unsubscribe", async () => {
    const { runUnpaidReminders } = await import("@/lib/admin/unpaid-reminders");
    db.tables.profiles.push(client());
    db.tables.contests = [draft()];
    expect(await runUnpaidReminders(NOW)).toBe(1);
    expect(sent.email[0]).toMatchObject({ key: "contest-reminder", userId: "u1", notice: "unpaid_reminders", ref: `remind:${C}:first` });
    // The resume link: it opens the draft without a password (owner, 2026-10-26).
    expect(String(sent.email[0].body)).toContain(`https://logocontest.bd/r/link-${C}`);
    expect(await runUnpaidReminders(NOW)).toBe(0);
    expect(db.tables.lifecycle_events.map((e) => e.kind)).toEqual(["remind_first"]);
  });

  it("never at night, never to guests' placeholder emails, and not once they paid, replied or were closed", async () => {
    const { runUnpaidReminders } = await import("@/lib/admin/unpaid-reminders");
    db.tables.profiles.push(client());
    db.tables.contests = [draft()];
    expect(await runUnpaidReminders(at("2026-10-25T20:00:00Z"))).toBe(0);
    for (const setup of [
      () => (db.tables.profiles[3].email = "8801711111111@phone.logocontest.bd"),
      () => (db.tables.contests[0].status = "open"),
      () => (db.tables.unpaid_leads = [{ id: "L1", contest_id: C, status: "closed" }]),
      () => (db.tables.help_offers = [{ contest_id: C, user_id: "u1", status: "replied" }]),
      () => (db.tables.unpaid_leads = [{ id: "L1", contest_id: C, status: "in_touch" }], (db.tables.lead_activities = [{ lead_id: "L1", result: "talked" }])),
    ]) {
      db.tables.profiles[3] = client();
      db.tables.contests = [draft()];
      db.tables.unpaid_leads = [];
      db.tables.help_offers = [];
      db.tables.lead_activities = [];
      setup();
      expect(await runUnpaidReminders(NOW), setup.toString()).toBe(0);
    }
    expect(sent.email).toHaveLength(0);
  });

  it("an unsubscribed client is skipped for good; a reminder held back by the daily limit is tried again", async () => {
    const { runUnpaidReminders } = await import("@/lib/admin/unpaid-reminders");
    db.tables.profiles.push(client({ email_off: ["contest-reminder"] }));
    db.tables.contests = [draft()];
    expect(await runUnpaidReminders(NOW)).toBe(0);
    expect(sent.email).toHaveLength(0);
    // Not marked as sent (History shows only reminders that really went).
    expect(db.tables.lifecycle_events ?? []).toHaveLength(0);
    db.tables.profiles[3] = client();
    db.tables.lifecycle_events = [];
    sent.emailStatus = "skipped";
    expect(await runUnpaidReminders(NOW)).toBe(0);
    expect(db.tables.lifecycle_events).toHaveLength(0);
  });
});

describe("reminders can't be used to send mail", () => {
  const draftOf = (id: string, client: string, hoursAgo: number) => ({ id, brand_name: id, status: "draft", client_id: client, created_at: new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString(), updated_at: new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString() });
  const person = (id: string) => ({ id, role: "client", status: "active", email: `${id}@example.com`, locale: "en", email_off: [] });

  it("one at a time per client, none again within a day, and a share of the daily limit", async () => {
    const { runUnpaidReminders } = await import("@/lib/admin/unpaid-reminders");
    db.tables.profiles.push(person("u1"));
    db.tables.contests = [draftOf("d1", "u1", 2), draftOf("d2", "u1", 3), draftOf("d3", "u1", 4)];
    expect(await runUnpaidReminders(NOW)).toBe(1);
    // Their newest draft.
    expect(sent.email.map((e) => e.ref)).toEqual(["remind:d1:first"]);
    db.tables.email_log = [{ user_id: "u1", template: "contest-reminder", status: "sent", created_at: NOW.toISOString(), ref: "remind:d1:first" }];
    expect(await runUnpaidReminders(NOW)).toBe(0);
    // 20 clients at once, daily limit 10: at most 3 (30%).
    db.tables.email_log = [];
    db.settings["email.daily_limit"] = 10;
    db.tables.lifecycle_events = [];
    db.tables.contests = Array.from({ length: 20 }, (_, i) => draftOf(`c${i}`, `p${i}`, 2));
    db.tables.profiles.push(...Array.from({ length: 20 }, (_, i) => person(`p${i}`)));
    expect(await runUnpaidReminders(NOW)).toBe(3);
  });

  it("a check that can't be read stops the run (nobody who should be left alone is emailed)", async () => {
    const { runUnpaidReminders } = await import("@/lib/admin/unpaid-reminders");
    db.tables.profiles.push(person("u1"));
    db.tables.contests = [draftOf("d1", "u1", 2)];
    for (const t of ["unpaid_leads", "manual_payments", "help_offers", "support_messages", "lead_activities"]) {
      db.down = new Set([t]);
      if (t === "support_messages") db.tables.support_threads = [{ id: "th1", user_id: "u1" }];
      if (t === "lead_activities") db.tables.unpaid_leads = [{ id: "L1", contest_id: "d1", status: "in_touch" }];
      expect(await runUnpaidReminders(NOW), t).toBe(0);
    }
    expect(sent.email).toHaveLength(0);
    db.down = new Set();
    db.tables.unpaid_leads = [];
    // Only the client's own support message is a reply (not the team's or a broadcast).
    db.tables.support_messages = [{ thread_id: "th1", from_admin: true, created_at: NOW.toISOString() }];
    expect(await runUnpaidReminders(NOW)).toBe(1);
  });
});

describe("settings, pop-ups and wiring", () => {
  it("Instant alerts and reminders need Unpaid · Manage, are checked and logged", async () => {
    const { saveUnpaidAlerts, saveUnpaidReminders } = await import("@/lib/admin/unpaid-alert-actions");
    who.perm = ["unpaid.view"];
    expect(await saveUnpaidAlerts({})).toEqual({ ok: false, error: "auth.errors.generic" });
    who.perm = ["unpaid.view", "unpaid.manage"];
    expect(await saveUnpaidAlerts({ quiet: { from: 99 } })).toEqual({ ok: false, error: "admin.errors.generic" });
    expect(await saveUnpaidAlerts({ events: { creating_now: true } })).toEqual({ ok: true });
    expect((db.tables.settings.find((s) => s.key === "notify.unpaid_alerts")!.value as Row).events).toMatchObject({ creating_now: true, new_unpaid: true });
    expect(await saveUnpaidReminders({ first: true, last: true })).toEqual({ ok: true });
    expect(sent.audits.map((a) => a[1])).toEqual(["unpaid_alert_settings", "unpaid_reminder_settings"]);
  });

  it("pop-ups: only unpaid alerts that came in since, events switched on, not in quiet hours, for Unpaid · View", async () => {
    const { GET } = await import("@/app/api/admin/alerts/route");
    const { NextRequest } = await import("next/server");
    vi.setSystemTime(NOW);
    const since = new Date(NOW.getTime() - 60_000).toISOString();
    db.tables.notifications = [
      { id: "n1", user_id: "m1", type: "unpaid_new_admin", data: { brand: "Sample Tea", lead: `c:${C}` }, link: `/admin/unpaid?sel=c:${C}#lead`, read_at: null, created_at: NOW.toISOString() },
      { id: "n2", user_id: "m1", type: "lead_new_admin", data: { name: "Rahim" }, link: "/admin/unpaid?sel=g:11111111-1111-4111-8111-111111111111#lead", read_at: null, created_at: NOW.toISOString() },
      { id: "n3", user_id: "m1", type: "unpaid_live_admin", data: { step: 2 }, link: "/admin/unpaid#live", read_at: null, created_at: NOW.toISOString() },
      { id: "n4", user_id: "m1", type: "payment_submitted_admin", data: {}, link: "/admin/payments", read_at: null, created_at: NOW.toISOString() },
    ];
    who.admin = { id: "m1", locale: "en", role: "admin", status: "active", adminActive: true, isSuperAdmin: false, adminPermissions: ["unpaid.view"] };
    who.perm = ["unpaid.view"];
    const res = await (await GET(new NextRequest(`http://localhost/api/admin/alerts?after=${since}`))).json();
    expect(res.pops.map((p: Row) => [p.id, p.key]).sort()).toEqual([
      ["n1", `c:${C}`],
      ["n2", "g:11111111-1111-4111-8111-111111111111"],
    ]);
    expect(res.canCall).toBe(false);
    expect(res.unread).toBe(4);
    // A tab back from sleep doesn't pop what came in hours ago (it is in the bell).
    vi.setSystemTime(new Date(NOW.getTime() + 3 * 3_600_000));
    expect((await (await GET(new NextRequest(`http://localhost/api/admin/alerts?after=${since}`))).json()).pops).toEqual([]);
    // A follow-up whose owner chose "Remind me by" without Admin alert doesn't pop up.
    vi.setSystemTime(NOW);
    db.tables.notifications = [{ id: "n5", user_id: "m1", type: "followup_due_admin", data: { brand: "X", lead: `c:${C}`, pop: false }, link: "/admin/unpaid", read_at: null, created_at: NOW.toISOString() }];
    expect((await (await GET(new NextRequest(`http://localhost/api/admin/alerts?after=${since}`))).json()).pops).toEqual([]);
    vi.setSystemTime(at("2026-10-25T20:00:00Z"));
    expect((await (await GET(new NextRequest(`http://localhost/api/admin/alerts?after=${since}`))).json()).pops).toEqual([]);
    vi.useRealTimers();
  });

  it("is wired into the jobs, the live route and the admin panel", () => {
    const run = read("src/lib/lifecycle/run.ts");
    expect(run.indexOf("report.unpaidAlerts = await runUnpaidAlerts(now);")).toBeGreaterThan(-1);
    expect(run.indexOf("report.unpaidReminders = await runUnpaidReminders(now);")).toBeLessThan(run.indexOf("report.leadAlerts = await alertNewLeads(now);"));
    expect(read("src/app/api/cron/alerts/route.ts")).toContain('auth === `Bearer ${secret}`');
    const live = read("src/app/api/wizard/live/route.ts");
    expect(live).toContain("if (!row) after(() => alertCreating(visitId, stage, now));");
    expect(read("src/components/admin/admin-nav.tsx")).toContain("<AdminAlerts />");
    // Guests' "New client to call": quiet hours and the team's push choice apply (their bell always).
    const leads = read("src/lib/admin/lead-alerts.ts");
    expect(leads).toContain("const awake = team.events.new_unpaid && !inQuietHours(team.quiet, now);");
    expect(leads.match(/push: pushOn,/g)).toHaveLength(2);
    const sql = read("supabase/migrations/0078_unpaid_alerts.sql");
    expect(sql).toContain("add column if not exists remind_by");
    expect(sql).not.toMatch(/create policy/i);
    expect(read("supabase/rollback/0078_unpaid_alerts_down.sql")).toContain("drop column if exists due_alerted_for");
    // SMS shows, off, until there is an SMS provider.
    expect(read("src/components/admin/unpaid/alerts.tsx")).toContain('<Switch on={false} disabled label={t("admin.unpaid.reminders.sms")}');
  });
});
