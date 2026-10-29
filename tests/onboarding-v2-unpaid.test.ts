import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Onboarding v2, phase C (owner, 2026-10-29; client-onboarding-v2-spec.md §4): Admin › Unpaid contests understands the
// new wizard's drafts (their step from the contest itself), its step-1 sign-ups, business type and package, time since
// the last activity, and the Last active and New wizard step filters. The old wizard's leads stay exactly as they were.

// ---- Pure rules -------------------------------------------------------------------------------------------------------

describe("the new wizard's steps", () => {
  it("come from the contest: payment step, a picked package, the prizes seen, else the logo name", async () => {
    const { v2StepOf } = await import("@/lib/admin/unpaid-rules");
    const base = { status: "draft", lastStep: 2, pricingViewedAt: null, packageSelectedAt: null };
    expect(v2StepOf(base)).toBe("s2");
    expect(v2StepOf({ ...base, lastStep: 3 })).toBe("s3viewed");
    expect(v2StepOf({ ...base, pricingViewedAt: "2026-10-29T08:00:00Z" })).toBe("s3viewed");
    expect(v2StepOf({ ...base, lastStep: 3, pricingViewedAt: "x", packageSelectedAt: "y" })).toBe("s3picked");
    expect(v2StepOf({ ...base, lastStep: 4, packageSelectedAt: "y" })).toBe("s4");
    expect(v2StepOf({ ...base, status: "pending_payment" })).toBe("s4");
    expect(v2StepOf({ ...base, lastStep: 4, proofSent: true })).toBe("sent");
  });

  it("sit on the shared 1..10 bar (prizes = Prize, payment = Went to payment); a visit without its contest by its own step", async () => {
    const { V2_STEP_STAGE, v2VisitStage } = await import("@/lib/admin/unpaid-rules");
    expect(V2_STEP_STAGE).toEqual({ s1: 1, s2: 2, s3viewed: 7, s3picked: 7, s4: 9, sent: 9 });
    expect([1, 2, 3, 4, 5].map(v2VisitStage)).toEqual([1, 2, 7, 9, 9]);
  });

  it("the total counts once a package was picked, or the client went on to pay the one shown", async () => {
    const { v2AmountKnown } = await import("@/lib/admin/unpaid-rules");
    const base = { status: "draft", lastStep: 3, pricingViewedAt: "x", packageSelectedAt: null };
    expect(v2AmountKnown(base)).toBe(false);
    expect(v2AmountKnown({ ...base, lastStep: 2, pricingViewedAt: null })).toBe(false);
    expect(v2AmountKnown({ ...base, packageSelectedAt: "y" })).toBe(true);
    expect(v2AmountKnown({ ...base, status: "pending_payment", lastStep: 4 })).toBe(true);
  });
});

describe("Last active and New wizard step filters", () => {
  const now = new Date("2026-10-29T09:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
  const base = { status: "new" as const, closedReason: null, hidden: false, contacts: 0, nextAt: null, wonBackAt: null, amount: 6000, stage: 7, ownerId: null, createdAt: hoursAgo(200), lastActivityAt: hoursAgo(23) };

  it("Last active keeps who did something in the last 24 hours, 3 or 7 days", async () => {
    const { matchesFilters, DEFAULT_QUERY } = await import("@/lib/admin/unpaid-rules");
    const q = { ...DEFAULT_QUERY };
    expect(matchesFilters(base, { ...q, active: "24h" }, now, "me")).toBe(true);
    expect(matchesFilters({ ...base, lastActivityAt: hoursAgo(25) }, { ...q, active: "24h" }, now, "me")).toBe(false);
    expect(matchesFilters({ ...base, lastActivityAt: hoursAgo(71) }, { ...q, active: "3d" }, now, "me")).toBe(true);
    expect(matchesFilters({ ...base, lastActivityAt: hoursAgo(73) }, { ...q, active: "3d" }, now, "me")).toBe(false);
    expect(matchesFilters({ ...base, lastActivityAt: hoursAgo(167) }, { ...q, active: "7d" }, now, "me")).toBe(true);
    expect(matchesFilters({ ...base, lastActivityAt: hoursAgo(169) }, { ...q, active: "7d" }, now, "me")).toBe(false);
    expect(matchesFilters({ ...base, lastActivityAt: hoursAgo(900) }, q, now, "me")).toBe(true);
  });

  it("Last active is the client's own activity: a call the team logged doesn't count, and unknown is not active", async () => {
    const { matchesFilters, DEFAULT_QUERY } = await import("@/lib/admin/unpaid-rules");
    const q = { ...DEFAULT_QUERY, active: "24h" as const };
    expect(matchesFilters({ ...base, lastActivityAt: hoursAgo(1), clientActivityAt: hoursAgo(30) }, q, now, "me")).toBe(false);
    expect(matchesFilters({ ...base, lastActivityAt: hoursAgo(1), clientActivityAt: hoursAgo(2) }, q, now, "me")).toBe(true);
    expect(matchesFilters({ ...base, clientActivityAt: null }, q, now, "me")).toBe(false);
    expect(matchesFilters({ ...base, clientActivityAt: null }, DEFAULT_QUERY, now, "me")).toBe(true);
    // The list and the details say "Last active" from it; the activity sort keeps the team's contacts.
    for (const f of ["lead-list", "lead-details"]) {
      const src = readFileSync(`src/components/admin/unpaid/${f}.tsx`, "utf8");
      expect(src, f).toMatch(/lastActive", \{ when: when\((l|lead)\.clientActivityAt\) \}/);
      expect(src, f).not.toContain("lastActivityAt");
    }
  });

  it("New wizard step lists only the new wizard's leads at that step", async () => {
    const { matchesFilters, DEFAULT_QUERY } = await import("@/lib/admin/unpaid-rules");
    const q = { ...DEFAULT_QUERY, v2step: "s3viewed" as const };
    expect(matchesFilters({ ...base, v2Step: "s3viewed" }, q, now, "me")).toBe(true);
    expect(matchesFilters({ ...base, v2Step: "s3picked" }, q, now, "me")).toBe(false);
    // An old-wizard lead at the same place on the bar is not the new wizard's.
    expect(matchesFilters(base, q, now, "me")).toBe(false);
    expect(matchesFilters({ ...base, v2Step: null }, q, now, "me")).toBe(false);
  });

  it("are in the address like the others; old addresses read and write as before", async () => {
    const { parseUnpaidQuery, unpaidHref } = await import("@/lib/admin/unpaid-rules");
    const q = parseUnpaidQuery({ started: "7", active: "24h", v2step: "s4", range: "90" });
    expect(q).toMatchObject({ started: "7", active: "24h", v2step: "s4", range: "90" });
    expect(unpaidHref(q)).toBe("/admin/unpaid?started=7&active=24h&v2step=s4&range=90");
    expect(unpaidHref(q, { active: null, v2step: null })).toBe("/admin/unpaid?started=7&range=90");
    // A sent bKash ID is paid for following up: not a step to filter by. Junk is dropped.
    expect(parseUnpaidQuery({ active: "1y", v2step: "sent" })).toMatchObject({ active: null, v2step: null });
    const old = parseUnpaidQuery({ tab: "overdue", sort: "next", step: "8", owner: "me", range: "90", q: "LC-0016" });
    expect(old).toMatchObject({ active: null, v2step: null });
    expect(unpaidHref(old)).toBe("/admin/unpaid?tab=overdue&q=LC-0016&sort=next&step=8&owner=me&range=90");
  });

  it("a draft without a package has no amount: out of the amount filter, last when sorted by money", async () => {
    const { matchesFilters, sortLeads, DEFAULT_QUERY } = await import("@/lib/admin/unpaid-rules");
    expect(matchesFilters({ ...base, amount: null }, { ...DEFAULT_QUERY, amount: "lt5k" }, now, "me")).toBe(false);
    expect(sortLeads([{ ...base, amount: null }, { ...base, amount: 3000 }, { ...base, amount: 12000 }], "money").map((l) => l.amount)).toEqual([12000, 3000, null]);
  });
});

// ---- The board, the lead list and the funnel over an in-memory database -----------------------------------------------

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, before0079: false }));

/** Columns onboarding v2's migration (0079) adds: reading or filtering them fails before it has run. */
const V2_COLUMNS: Record<string, string[]> = { contests: ["last_step", "pricing_viewed_at", "package_selected_at", "brief_completion"], wizard_visits: ["flow"] };

function query(name: string) {
  const filters: ((r: Row) => boolean)[] = [];
  const keys: string[] = [];
  let cols = "*";
  let sort: { key: string; asc: boolean } | null = null;
  let max = Infinity;
  let single = false;
  const on = (k: string, f: (r: Row) => boolean) => (keys.push(k), filters.push(f), q);
  const q = {
    select: (c = "*") => ((cols = c), q),
    eq: (k: string, v: unknown) => on(k, (r) => r[k] === v),
    neq: (k: string, v: unknown) => on(k, (r) => r[k] !== v),
    is: (k: string, v: unknown) => on(k, (r) => (r[k] ?? null) === v),
    not: (k: string, _op: string, v: unknown) => on(k, (r) => (r[k] ?? null) !== v),
    in: (k: string, vs: unknown[]) => on(k, (r) => vs.includes(r[k])),
    or: () => q,
    gte: (k: string, v: string) => on(k, (r) => String(r[k]) >= v),
    lt: (k: string, v: string) => on(k, (r) => String(r[k]) < v),
    order: (k: string, o?: { ascending?: boolean }) => ((sort = { key: k, asc: o?.ascending !== false }), q),
    limit: (n: number) => ((max = n), q),
    maybeSingle: () => ((single = true), q),
    then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => {
      const list = cols === "*" ? [] : cols.split(",").map((c) => c.trim());
      if (db.before0079 && [...list, ...keys].some((c) => (V2_COLUMNS[name] ?? []).includes(c))) return Promise.resolve({ data: null, error: { code: "42703", message: `column ${name}.x does not exist` } }).then(ok, bad);
      let hit = (db.tables[name] ?? []).filter((r) => filters.every((f) => f(r)));
      if (sort) hit = [...hit].sort((a, b) => String(a[sort!.key]).localeCompare(String(b[sort!.key])) * (sort!.asc ? 1 : -1));
      // Only the columns asked for, as the database gives them.
      const data = hit.slice(0, max).map((r) => (list.length ? Object.fromEntries(list.map((c) => [c, r[c] ?? null])) : { ...r }));
      return Promise.resolve({ data: single ? (data[0] ?? null) : data, error: null }).then(ok, bad);
    },
  };
  return q;
}

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (name: string) => query(name) }) }));
vi.mock("@/lib/admin/recipients", () => ({ adminIdsWith: async () => [] }));

const NOW = new Date("2026-10-29T09:00:00Z");
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const contest = (n: number, more: Row = {}): Row => ({
  id: id(n),
  slug: `c${n}`,
  brand_name: `Brand ${n}`,
  status: "draft",
  total_amount: 6250,
  prize_amount: 5000,
  upgrades_amount: 0,
  client_id: `u${n}`,
  created_at: ago(300),
  updated_at: ago(60),
  contest_number: null,
  starts_at: null,
  business_type: "food",
  package: "standard",
  ...more,
});
const V2 = { brief_completion: { v: 2, edited: [] } };
const profile = (n: number | string, more: Row = {}): Row => ({ id: `u${n}`, name: `Client ${n}`, mobile: `+88017000000${String(n).padStart(2, "0")}`, email: null, whatsapp: true, is_test: false, last_seen_at: ago(30), created_at: ago(400), role: "client", ...more });
const lead = (visit: string, mobile: string, more: Row = {}): Row => ({ visit_id: visit, mobile, name: null, email: null, whatsapp: null, brand_name: null, service: "logo", furthest_step: 1, created_at: ago(120), updated_at: ago(90), alerted_at: null, ...more });

beforeEach(() => {
  db.before0079 = false;
  db.tables = {
    unpaid_leads: [],
    lead_activities: [],
    user_sessions: [],
    payments: [],
    contests: [
      // Old wizard: its stage from its own visits, as before (a stray new-wizard visit never counts on the old numbering).
      contest(1, { business_type: "beauty", package: "premium", total_amount: 11000 }),
      // New wizard: logo name saved (the default package's total is a placeholder) …
      contest(2, { ...V2, last_step: 2 }),
      // … saw the prizes …
      contest(3, { ...V2, last_step: 3, pricing_viewed_at: ago(50) }),
      // … picked Pro …
      contest(4, { ...V2, last_step: 3, pricing_viewed_at: ago(50), package_selected_at: ago(40), package: "pro", total_amount: 9000 }),
      // … opened the payment without tapping a card (it pays the one shown) …
      contest(5, { ...V2, last_step: 4, status: "pending_payment", pricing_viewed_at: ago(50) }),
      // … and sent the bKash ID: paid as far as following up goes.
      contest(6, { ...V2, last_step: 4, status: "pending_payment", pricing_viewed_at: ago(50), package_selected_at: ago(45) }),
    ],
    manual_payments: [{ contest_id: id(6), kind: "contest", status: "pending", note: null, created_at: ago(20) }],
    wizard_visits: [
      { id: id(101), contest_id: id(1), furthest_step: 8, created_at: ago(300), flow: "v1" },
      { id: id(102), contest_id: id(1), furthest_step: 9, created_at: ago(200), flow: "v2" },
      { id: id(103), contest_id: id(2), furthest_step: 2, created_at: ago(280), flow: "v2" },
    ],
    profiles: [1, 2, 3, 4, 5, 6].map((n) => profile(n)),
    wizard_leads: [],
  };
});

describe("the board: new-wizard drafts", () => {
  it("take their step from the contest, show business type and package, and hide the default package's total", async () => {
    const { unpaidBoard } = await import("@/lib/admin/unpaid-board");
    const { leads } = await unpaidBoard(NOW);
    const by = new Map(leads.map((l) => [l.key, l]));
    expect([...by.keys()].sort()).toEqual([1, 2, 3, 4, 5].map((n) => `c:${id(n)}`));

    const old = by.get(`c:${id(1)}`)!;
    expect(old).toMatchObject({ v2: false, v2Step: null, stage: 8, amount: 11000, noPackage: false, businessType: "beauty", package: "premium", visits: 2 });
    expect(by.get(`c:${id(2)}`)).toMatchObject({ v2: true, v2Step: "s2", stage: 2, amount: null, prize: null, noPackage: true, businessType: "food", package: "standard" });
    expect(by.get(`c:${id(3)}`)).toMatchObject({ v2: true, v2Step: "s3viewed", stage: 7, amount: null, noPackage: true });
    expect(by.get(`c:${id(4)}`)).toMatchObject({ v2: true, v2Step: "s3picked", stage: 7, amount: 9000, noPackage: false, package: "pro" });
    expect(by.get(`c:${id(5)}`)).toMatchObject({ v2: true, v2Step: "s4", stage: 9, amount: 6250, noPackage: false });
    // Last activity: the contest's own last save (updated_at moves on each of the new wizard's saves).
    expect(by.get(`c:${id(2)}`)!.lastActivityAt.toISOString()).toBe(ago(60));
  });

  it("before migration 0079 every draft is the old wizard's, as before", async () => {
    const { unpaidBoard } = await import("@/lib/admin/unpaid-board");
    db.before0079 = true;
    const { leads } = await unpaidBoard(NOW);
    const by = new Map(leads.map((l) => [l.key, l]));
    expect(leads.every((l) => !l.v2 && !l.v2Step && !l.noPackage)).toBe(true);
    // No flow column: every visit counts on the old numbering, and a saved draft is at least past Prize.
    expect(by.get(`c:${id(1)}`)).toMatchObject({ stage: 9, amount: 11000, businessType: "beauty", package: "premium" });
    expect(by.get(`c:${id(2)}`)).toMatchObject({ stage: 7, amount: 6250 });
    expect(by.get(`c:${id(5)}`)).toMatchObject({ stage: 9 });
  });
});

describe("the board: step-1 sign-ups of the new wizard", () => {
  beforeEach(() => {
    db.tables.profiles.push(
      profile(20, { name: "Rina", email: "rina@example.com", created_at: ago(100), last_seen_at: ago(95) }),
      profile(21),
      profile(22, { role: "designer" }),
      profile(23),
    );
    db.tables.profiles[1].email = "client2@example.com";
    db.tables.wizard_leads = [
      // A new-wizard account with no contest yet (the email typed with the number is the account's).
      lead(id(200), "+8801700000020", { name: "Rina", email: "rina@example.com", whatsapp: true }),
      // A new-wizard account that has a contest: listed by its draft instead (here: contest 2's client).
      lead(id(202), "+8801700000002", { email: "client2@example.com" }),
      // A designer's number, and an old-wizard client without a contest: left out as before.
      lead(id(222), "+8801700000022"),
      lead(id(223), "+8801700000023"),
      // A guest without an account (the newest): as before.
      lead(id(299), "+8801799999999", { name: "Guest", updated_at: ago(10) }),
    ];
    db.tables.wizard_visits.push(
      { id: id(200), contest_id: null, furthest_step: 2, created_at: ago(120), flow: "v2" },
      { id: id(202), contest_id: null, furthest_step: 1, created_at: ago(120), flow: "v2" },
      { id: id(222), contest_id: null, furthest_step: 1, created_at: ago(120), flow: "v2" },
      { id: id(223), contest_id: null, furthest_step: 1, created_at: ago(120), flow: "v1" },
    );
  });

  it("stay on the list at step 1 with the New wizard chip; numbers with a contest, staff and old-wizard accounts stay out", async () => {
    const { unpaidBoard } = await import("@/lib/admin/unpaid-board");
    const { leads, contacts } = await unpaidBoard(NOW);
    const guests = leads.filter((l) => l.kind === "guest");
    expect(guests.map((l) => l.key).sort()).toEqual([`g:${id(200)}`, `g:${id(299)}`]);
    const rina = guests.find((l) => l.key === `g:${id(200)}`)!;
    expect(rina).toMatchObject({ v2: true, v2Step: "s1", stage: 1, clientId: "u20", clientName: "Rina", amount: null, noPackage: false, businessType: null });
    expect(rina.signedUpAt?.toISOString()).toBe(ago(100));
    // Reached through its number, like any guest (never in the page's props).
    expect(contacts.get(`g:${id(200)}`)).toEqual({ mobile: "+8801700000020", email: "rina@example.com", whatsapp: true });
    expect(guests.find((l) => l.key === `g:${id(299)}`)).toMatchObject({ v2: false, v2Step: null, clientId: null, stage: 1 });
  });

  it("the lead list (also the badge's) keeps them with their account; before migration 0079 they stay out", async () => {
    const { wizardLeads, wizardLeadsByMobile } = await import("@/lib/admin/leads");
    expect((await wizardLeads()).map((l) => [l.visitId, l.account])).toEqual([
      [id(299), null],
      [id(200), "u20"],
    ]);
    expect((await wizardLeadsByMobile(["+8801700000020", "+8801700000023"])).map((l) => l.account)).toEqual(["u20"]);
    // An alert's link to their visit finds them past the list's limit.
    expect((await wizardLeads(1)).map((l) => l.visitId)).toEqual([id(299)]);
    expect((await wizardLeads(1, id(200))).map((l) => [l.visitId, l.account])).toEqual([
      [id(200), "u20"],
      [id(299), null],
    ]);
    db.before0079 = true;
    expect((await wizardLeads()).map((l) => l.visitId)).toEqual([id(299)]);
  });

  it("leave once they save a logo name: the draft takes over", async () => {
    const { unpaidBoard } = await import("@/lib/admin/unpaid-board");
    db.tables.contests.push(contest(20, { ...V2, last_step: 2 }));
    const { leads } = await unpaidBoard(NOW);
    expect(leads.some((l) => l.key === `g:${id(200)}`)).toBe(false);
    expect(leads.find((l) => l.key === `c:${id(20)}`)).toMatchObject({ v2: true, v2Step: "s2", clientName: "Rina" });
  });
});

describe("Where they get stuck", () => {
  it("counts only the old wizard's visits, on the old numbering (the new wizard has its own funnel card)", async () => {
    const { stuckFunnel } = await import("@/lib/admin/unpaid-board");
    db.tables.contests.push(contest(7, { ...V2, last_step: 4, status: "open" }));
    db.tables.wizard_visits = [
      { id: id(301), contest_id: id(1), furthest_step: 8, created_at: ago(300), flow: "v1" },
      { id: id(302), contest_id: id(3), furthest_step: 3, created_at: ago(300), flow: "v2" },
      { id: id(303), contest_id: null, furthest_step: 1, created_at: ago(300), flow: "v2" },
      { id: id(304), contest_id: null, furthest_step: 2, created_at: ago(300), flow: "v2" },
      { id: id(305), contest_id: id(5), furthest_step: 4, created_at: ago(300), flow: "v2" },
      { id: id(306), contest_id: id(7), furthest_step: 4, created_at: ago(300), flow: "v2" },
      // Older than the range.
      { id: id(307), contest_id: null, furthest_step: 1, created_at: "2026-08-01T00:00:00Z", flow: "v1" },
    ];
    // Only the old wizard's visit (stage 8): the new wizard's 1–5 never land on the old steps 3–6.
    expect((await stuckFunnel("30", NOW)).map((s) => s.count)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 0, 0]);
    // Before migration 0079 there is no flow: every visit is read as before.
    db.before0079 = true;
    expect((await stuckFunnel("30", NOW)).map((s) => s.count)).toEqual([6, 5, 4, 3, 2, 2, 2, 2, 1, 1]);
  });
});

// ---- Review fixes (phase C) ---------------------------------------------------------------------------------------------

describe("a bKash payment the new wizard closed is not a failed card payment", () => {
  it("not on the list nor in the History; a gateway's failure still is", async () => {
    const { unpaidBoard, leadHistory } = await import("@/lib/admin/unpaid-board");
    db.tables.payments = [
      // The client opened the payment step, then went back and changed the package: the open payment was closed.
      { contest_id: id(4), purpose: "contest", status: "failed", gateway: "bkash_personal", created_at: ago(35) },
      { contest_id: id(3), purpose: "contest", status: "failed", gateway: "bkash_merchant", created_at: ago(35) },
      // The old wizard's card payment that didn't go through: as before.
      { contest_id: id(1), purpose: "contest", status: "failed", gateway: "sslcommerz", created_at: ago(35) },
    ];
    const { leads } = await unpaidBoard(NOW);
    const by = new Map(leads.map((l) => [l.key, l]));
    expect(by.get(`c:${id(4)}`)!.paymentFailed).toBeNull();
    expect(by.get(`c:${id(3)}`)!.paymentFailed).toBeNull();
    expect(by.get(`c:${id(1)}`)!.paymentFailed).toEqual({ kind: "card" });
    const events = async (n: number) => (await leadHistory(by.get(`c:${id(n)}`)!, undefined)).filter((h) => h.kind === "system").map((h) => [h.event, h.tone]);
    expect(await events(4)).toContainEqual(["payment_started", "neutral"]);
    expect(await events(4)).not.toContainEqual(["payment_failed", "bad"]);
    expect(await events(1)).toContainEqual(["payment_failed", "bad"]);
  });
});

describe("a closed step-1 lead whose visits left the newest 200", () => {
  it("stays from its own copy (Closed tab, fake count, Reopen); a number whose account has a contest, or a designer's, stays out", async () => {
    const { unpaidBoard } = await import("@/lib/admin/unpaid-board");
    db.tables.profiles.push(profile(20, { name: "Rina", email: "rina@example.com", last_seen_at: ago(95) }), profile(22, { role: "designer" }), profile(30));
    // Contest 30 is paid and live: not on the list, but its client is no step-1 account.
    db.tables.contests.push(contest(30, { status: "completed" }));
    const closed = (n: number): Row => ({ id: id(500 + n), kind: "guest", guest_mobile: `+88017000000${n}`, contest_id: null, client_id: null, brand_snapshot: null, amount_snapshot: null, status: "closed", closed_reason: "fake", fake_reason: "spam", close_note: "Not real", closed_at: ago(200), hidden: true, contacts_count: 0, created_at: ago(300), updated_at: ago(200) });
    db.tables.unpaid_leads = [closed(20), closed(22), closed(30)];
    db.tables.wizard_leads = [lead(id(200), "+8801700000020", { email: "rina@example.com", updated_at: ago(500) }), ...Array.from({ length: 200 }, (_, i) => lead(id(600 + i), "+8801788888888", { updated_at: ago(10) }))];
    db.tables.wizard_visits.push({ id: id(200), contest_id: null, furthest_step: 1, created_at: ago(500), flow: "v2" });
    const { leads, contacts } = await unpaidBoard(NOW);
    expect(leads.find((l) => l.key === `l:${id(520)}`)).toMatchObject({ kind: "guest", status: "closed", closedReason: "fake", fakeReason: "spam", clientId: "u20", clientName: "Rina", stage: 1 });
    expect(leads.find((l) => l.key === `l:${id(520)}`)!.clientActivityAt?.toISOString()).toBe(ago(95));
    expect(contacts.get(`l:${id(520)}`)).toEqual({ mobile: "+8801700000020", email: null, whatsapp: null });
    expect(leads.some((l) => l.key === `l:${id(522)}` || l.key === `l:${id(530)}`)).toBe(false);
  });

  it("an old guest number whose account lost its draft (no new-wizard visit) stays left out, as before", async () => {
    const { unpaidBoard } = await import("@/lib/admin/unpaid-board");
    // Client 21 signed up on the old wizard; the draft was trashed and purged, so the account has no contest now.
    db.tables.profiles.push(profile(21, { name: "Old", email: "old@example.com" }));
    db.tables.unpaid_leads = [{ id: id(521), kind: "guest", guest_mobile: "+8801700000021", contest_id: null, client_id: null, status: "in_touch", contacts_count: 1, created_at: ago(300), updated_at: ago(200) }];
    db.tables.wizard_leads = [lead(id(201), "+8801700000021", { email: "old@example.com", updated_at: ago(500) }), ...Array.from({ length: 200 }, (_, i) => lead(id(600 + i), "+8801788888888", { updated_at: ago(10) }))];
    db.tables.wizard_visits.push({ id: id(201), contest_id: null, furthest_step: 7, created_at: ago(500), flow: "v1" });
    const { leads } = await unpaidBoard(NOW);
    expect(leads.some((l) => l.key === `l:${id(521)}` || l.key === `g:${id(201)}`)).toBe(false);
  });

  it("an open one is loaded by its number, with its account's name and email", async () => {
    const { unpaidBoard } = await import("@/lib/admin/unpaid-board");
    db.tables.profiles.push(profile(20, { name: "Rina", email: "rina@example.com", last_seen_at: ago(95) }));
    db.tables.unpaid_leads = [{ id: id(520), kind: "guest", guest_mobile: "+8801700000020", status: "in_touch", contacts_count: 1, created_at: ago(300), updated_at: ago(200) }];
    db.tables.wizard_leads = [lead(id(200), "+8801700000020", { name: "Typed", email: "rina@example.com", updated_at: ago(500) }), ...Array.from({ length: 200 }, (_, i) => lead(id(600 + i), "+8801788888888", { updated_at: ago(10) }))];
    db.tables.wizard_visits.push({ id: id(200), contest_id: null, furthest_step: 1, created_at: ago(500), flow: "v2" });
    const { leads, contacts } = await unpaidBoard(NOW);
    expect(leads.find((l) => l.key === `g:${id(200)}`)).toMatchObject({ status: "in_touch", clientId: "u20", clientName: "Rina", v2Step: "s1", hasContact: { mobile: true, email: true, whatsapp: false } });
    expect(contacts.get(`g:${id(200)}`)?.email).toBe("rina@example.com");
  });
});

describe("Last active on the board", () => {
  it("a contact the team logged moves the activity sort, not Last active or its filter", async () => {
    const { unpaidBoard } = await import("@/lib/admin/unpaid-board");
    const { matchesFilters, sortLeads, DEFAULT_QUERY } = await import("@/lib/admin/unpaid-rules");
    db.tables.contests.push(contest(8, { ...V2, last_step: 2, created_at: ago(5 * 1440), updated_at: ago(3 * 1440) }));
    db.tables.profiles.push(profile(8));
    db.tables.unpaid_leads = [{ id: id(800), kind: "contest", contest_id: id(8), guest_mobile: null, status: "in_touch", contacts_count: 1, last_contact_at: ago(10), last_contact_type: "call", last_result: "talked", created_at: ago(100), updated_at: ago(10) }];
    const { leads } = await unpaidBoard(NOW);
    const l = leads.find((x) => x.key === `c:${id(8)}`)!;
    expect(l.lastActivityAt.toISOString()).toBe(ago(10));
    expect(l.clientActivityAt?.toISOString()).toBe(ago(3 * 1440));
    expect(matchesFilters(l, { ...DEFAULT_QUERY, active: "24h" }, NOW, "me")).toBe(false);
    expect(matchesFilters(l, { ...DEFAULT_QUERY, active: "7d" }, NOW, "me")).toBe(true);
    expect(sortLeads(leads, "activity")[0].key).toBe(`c:${id(8)}`);
  });

  it("a step-1 account counts its last sign-in, never the team's contact", async () => {
    const { unpaidBoard } = await import("@/lib/admin/unpaid-board");
    db.tables.profiles.push(profile(20, { name: "Rina", email: "rina@example.com", last_seen_at: ago(5) }));
    db.tables.wizard_leads = [lead(id(200), "+8801700000020", { email: "rina@example.com", updated_at: ago(90) })];
    db.tables.wizard_visits.push({ id: id(200), contest_id: null, furthest_step: 1, created_at: ago(120), flow: "v2" });
    db.tables.unpaid_leads = [{ id: id(820), kind: "guest", guest_mobile: "+8801700000020", status: "in_touch", contacts_count: 1, last_contact_at: ago(1), last_contact_type: "call", created_at: ago(60), updated_at: ago(1) }];
    const rina = (await unpaidBoard(NOW)).leads.find((l) => l.key === `g:${id(200)}`)!;
    expect(rina.clientActivityAt?.toISOString()).toBe(ago(5));
    expect(rina.lastActivityAt.toISOString()).toBe(ago(1));
    db.tables.profiles.find((p) => p.id === "u20")!.last_seen_at = null;
    expect((await unpaidBoard(NOW)).leads.find((l) => l.key === `g:${id(200)}`)!.clientActivityAt?.toISOString()).toBe(ago(90));
  });
});

describe("a number someone else typed on the new wizard", () => {
  beforeEach(() => {
    db.tables.profiles.push(profile(20, { name: "Rina", email: "rina@example.com" }), profile(24, { name: "Karim", email: "karim@example.com" }));
    db.tables.wizard_leads = [
      lead(id(200), "+8801700000020", { name: "Rina", email: "RINA@example.com ", brand_name: "Rina Cakes", updated_at: ago(90) }),
      // Someone else typed Rina's number on /start-v2 (their sign-up was refused: the number is taken) …
      lead(id(201), "+8801700000020", { name: "Other", email: "other@example.com", brand_name: "Other Brand", updated_at: ago(20) }),
      // … and Karim's, who has an account without a contest but never used the new wizard himself.
      lead(id(224), "+8801700000024", { name: "Other", email: "other@example.com", updated_at: ago(20) }),
    ];
    db.tables.wizard_visits.push(
      { id: id(200), contest_id: null, furthest_step: 2, created_at: ago(120), flow: "v2" },
      { id: id(201), contest_id: null, furthest_step: 1, created_at: ago(30), flow: "v2" },
      { id: id(224), contest_id: null, furthest_step: 1, created_at: ago(30), flow: "v2" },
    );
  });

  it("makes no account a lead and never mixes into the holder's: only visits typed with the account's email are its own", async () => {
    const { wizardLeads, wizardLeadsByMobile } = await import("@/lib/admin/leads");
    const list = await wizardLeads();
    expect(list.map((l) => [l.visitId, l.account])).toEqual([[id(200), "u20"]]);
    expect(list[0]).toMatchObject({ visitIds: [id(200)], name: "Rina", brand: "Rina Cakes", visits: 1 });
    expect((await wizardLeadsByMobile(["+8801700000020", "+8801700000024"])).map((l) => [l.visitIds, l.account])).toEqual([[[id(200)], "u20"]]);
  });

  it("the board and the reach actions use the account's own email, never the typed one", async () => {
    const { unpaidBoard } = await import("@/lib/admin/unpaid-board");
    const { resolve } = await import("@/lib/admin/unpaid-leads");
    const { leads, contacts } = await unpaidBoard(NOW);
    expect(leads.filter((l) => l.kind === "guest").map((l) => l.key)).toEqual([`g:${id(200)}`]);
    expect(contacts.get(`g:${id(200)}`)?.email).toBe("rina@example.com");
    expect(await resolve(`g:${id(200)}`)).toMatchObject({ kind: "guest", mobile: "+8801700000020", email: "rina@example.com" });
    expect((await resolve(`g:${id(201)}`))?.email).toBe("rina@example.com");
    // A guest without an account: the email they typed, as before.
    db.tables.wizard_leads.push(lead(id(299), "+8801799999999", { email: "guest@example.com" }));
    expect((await resolve(`g:${id(299)}`))?.email).toBe("guest@example.com");
  });
});

describe("a lead key's amount (also the lead's own copy)", () => {
  it("is none for a new-wizard draft without a package, as on the list; a picked package's and the old wizard's as before", async () => {
    const { resolve } = await import("@/lib/admin/unpaid-leads");
    const amount = async (n: number) => (await resolve(`c:${id(n)}`))?.amount;
    expect(await amount(2)).toBeNull();
    expect(await amount(3)).toBeNull();
    expect(await amount(4)).toBe(9000);
    expect(await amount(5)).toBe(6250);
    expect(await amount(1)).toBe(11000);
    // Before migration 0079 every draft is the old wizard's.
    db.before0079 = true;
    expect(await amount(2)).toBe(6250);
    expect(readFileSync("src/lib/admin/unpaid-leads.ts", "utf8")).toContain("amount_snapshot: who.amount");
  });
});
