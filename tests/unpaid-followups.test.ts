import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Owner, 2026-10-25 (Design/unpaid-contests): Admin › Unpaid contests rebuilt as the follow-up page.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

// ---- Pure rules -------------------------------------------------------------------------------------------------------

describe("stages and the funnel", () => {
  it("maps today's wizard steps as they are, and the old 12-step numbering onto them", async () => {
    const { stageOf } = await import("@/lib/admin/unpaid-rules");
    const now = "2026-10-20T10:00:00Z";
    const old = "2026-10-10T10:00:00Z";
    expect([1, 2, 7, 8, 9, 12].map((n) => stageOf(n, now))).toEqual([1, 2, 7, 8, 9, 9]);
    // Old: 1 Logo name, 4 Styles, 5 Colours (same screen now), 7 Files, 10 Password (on Prize now), 11 Review, 12 payment.
    expect([1, 4, 5, 7, 10, 11, 12].map((n) => stageOf(n, old))).toEqual([2, 5, 5, 6, 7, 8, 9]);
  });

  it("counts how many reached each step, the drop from the one before, and the biggest drops (later step on a tie)", async () => {
    const { funnelCounts, biggestDrops } = await import("@/lib/admin/unpaid-rules");
    const visits = [
      ...Array.from({ length: 4 }, () => ({ stage: 1, paid: false })),
      ...Array.from({ length: 3 }, () => ({ stage: 2, paid: false })),
      ...Array.from({ length: 2 }, () => ({ stage: 8, paid: false })),
      { stage: 9, paid: false },
      { stage: 9, paid: true },
    ];
    const f = funnelCounts(visits);
    expect(f.map((s) => s.count)).toEqual([11, 7, 4, 4, 4, 4, 4, 4, 2, 1]);
    expect(f.map((s) => s.drop)).toEqual([null, 4, 3, 0, 0, 0, 0, 0, 2, 1]);
    expect(biggestDrops(f)).toEqual([
      { from: 1, to: 2, lost: 4, pct: 36 },
      { from: 2, to: 3, lost: 3, pct: 43 },
    ]);
    // Two steps losing one each: the later one first.
    expect(biggestDrops(funnelCounts([{ stage: 2, paid: false }, { stage: 3, paid: false }]), 2).map((d) => d.from)).toEqual([3, 2]);
  });
});

describe("status rules from the result", () => {
  it("Will pay → Promised; No answer twice → Not reachable; Wrong number; Needs help; Not interested closes", async () => {
    const { afterResult } = await import("@/lib/admin/unpaid-rules");
    expect(afterResult({ status: "new", streak: 0 }, "will_pay")).toEqual({ status: "promised", streak: 0 });
    const once = afterResult({ status: "new", streak: 0 }, "no_answer");
    expect(once).toEqual({ status: "in_touch", streak: 1 });
    expect(afterResult({ status: once.status, streak: once.streak }, "no_answer")).toEqual({ status: "not_reachable", streak: 2 });
    expect(afterResult({ status: "promised", streak: 1 }, "talked")).toEqual({ status: "promised", streak: 0 });
    expect(afterResult({ status: "not_reachable", streak: 2 }, "talked")).toEqual({ status: "in_touch", streak: 0 });
    expect(afterResult({ status: "in_touch", streak: 0 }, "wrong_number").status).toBe("not_reachable");
    expect(afterResult({ status: "in_touch", streak: 0 }, "needs_help").status).toBe("needs_help");
    expect(afterResult({ status: "in_touch", streak: 0 }, "not_interested")).toEqual({ status: "closed", streak: 0, close: "not_interested" });
    // A note only changes nothing.
    expect(afterResult({ status: "promised", streak: 1 }, null)).toEqual({ status: "promised", streak: 1 });
  });
});

describe("follow-up times (Bangladesh time)", () => {
  it("tonight, tomorrow, a picked time, and no more", async () => {
    const { nextFollowUpAt } = await import("@/lib/admin/unpaid-rules");
    const afternoon = new Date("2026-10-25T09:00:00Z"); // 15:00 in Dhaka
    expect(nextFollowUpAt("2h", afternoon)).toEqual(new Date("2026-10-25T11:00:00Z"));
    expect(nextFollowUpAt("tonight", afternoon)).toEqual(new Date("2026-10-25T14:00:00Z"));
    expect(nextFollowUpAt("tonight", new Date("2026-10-25T15:00:00Z"))).toEqual(new Date("2026-10-26T14:00:00Z"));
    expect(nextFollowUpAt("tomorrow", afternoon)).toEqual(new Date("2026-10-26T04:00:00Z"));
    expect(nextFollowUpAt("week", afternoon)).toEqual(new Date("2026-11-01T04:00:00Z"));
    expect(nextFollowUpAt("pick", afternoon, "2026-10-27T18:30")).toEqual(new Date("2026-10-27T12:30:00Z"));
    expect(nextFollowUpAt("pick", afternoon, "2026-10-01T10:00")).toBe("invalid");
    expect(nextFollowUpAt("pick", afternoon, "tomorrow")).toBe("invalid");
    expect(nextFollowUpAt("none", afternoon)).toBeNull();
  });
});

describe("tabs, overdue, filters and the address", () => {
  const base = { status: "in_touch" as const, closedReason: null, hidden: false, contacts: 1, nextAt: null, wonBackAt: null, amount: 6000, stage: 8, ownerId: null, createdAt: new Date("2026-10-24T10:00:00Z"), lastActivityAt: new Date("2026-10-24T10:00:00Z") };
  const now = new Date("2026-10-25T09:00:00Z");

  it("one tab per lead (owner, 2026-10-30): Unread until something is saved, then Due now when the follow-up time comes, otherwise Waiting", async () => {
    const { inTab, queueOf, shownStatus, TABS } = await import("@/lib/admin/unpaid-rules");
    const late = { ...base, nextAt: new Date("2026-10-25T08:00:00Z") };
    expect(queueOf(late, now)).toBe("due");
    expect(inTab(late, "due", now) && !inTab(late, "waiting", now) && !inTab(late, "unread", now)).toBe(true);
    expect(shownStatus(late, now)).toBe("overdue");
    // Later today: Waiting until its time, or already Due within the alert's minutes.
    const later = { ...base, nextAt: new Date("2026-10-25T12:00:00Z") };
    expect(queueOf(later, now)).toBe("waiting");
    expect(queueOf({ ...base, nextAt: new Date(now.getTime() + 5 * 60_000) }, now, 10 * 60_000)).toBe("due");
    // Nothing saved yet: Unread. A note (handled) or a plan takes them out of it.
    const fresh = { ...base, status: "new" as const, contacts: 0 };
    expect(queueOf(fresh, now)).toBe("unread");
    expect(shownStatus(fresh, now)).toBe("unread");
    expect(queueOf({ ...fresh, handled: true }, now)).toBe("waiting");
    expect(shownStatus({ ...fresh, handled: true }, now)).toBe("followed_up");
    expect(queueOf({ ...fresh, nextAt: later.nextAt }, now)).toBe("waiting");
    expect(queueOf({ ...fresh, handled: false, nextAt: null }, now)).toBe("unread");
    const fake = { ...late, status: "closed" as const, closedReason: "fake" as const, hidden: true };
    expect(queueOf(fake, now)).toBe("closed");
    expect(inTab(fake, "all", now)).toBe(false);
    expect(shownStatus(fake, now)).toBe("closed_fake");
    const won = { ...base, wonBackAt: now };
    expect(queueOf(won, now)).toBe("won");
    expect(inTab(won, "all", now)).toBe(false);
    // Every lead is in exactly one tab, and All is Unread + Due now + Waiting.
    for (const l of [late, later, fresh, { ...fresh, handled: true }, fake, won, { ...base, status: "promised" as const }, { ...base, status: "not_reachable" as const, nextAt: late.nextAt }]) {
      expect(TABS.filter((tab) => tab !== "all" && inTab(l, tab, now)).length).toBe(1);
      expect(inTab(l, "all", now)).toBe(["unread", "due", "waiting"].includes(queueOf(l, now)));
    }
    expect(TABS[0]).toBe("unread");
  });

  it("Due now looks ahead by the due alert's minutes, at most 30: the usual 2 hours is never Due at once", async () => {
    const { dueSoonMs, queueOf } = await import("@/lib/admin/unpaid-rules");
    expect(dueSoonMs(10)).toBe(10 * 60_000);
    expect(dueSoonMs(120)).toBe(30 * 60_000);
    expect(queueOf({ ...base, nextAt: new Date(now.getTime() + 2 * 3_600_000) }, now, dueSoonMs(120))).toBe("waiting");
  });

  it("a link to one person keeps its tab, Unread too, so a save there doesn't jump the list; an alert's link has none", async () => {
    const { DEFAULT_QUERY, parseUnpaidQuery, unpaidHref } = await import("@/lib/admin/unpaid-rules");
    expect(unpaidHref(DEFAULT_QUERY)).toBe("/admin/unpaid");
    expect(unpaidHref(DEFAULT_QUERY, { sel: "c:1" })).toBe("/admin/unpaid?tab=unread&sel=c%3A1");
    expect(parseUnpaidQuery({ tab: "unread", sel: "c:1" }).tab).toBe("unread");
    expect(read("src/lib/admin/unpaid-alerts.ts")).toContain("export const leadLink = (key: string) => `/admin/unpaid?sel=${key}#lead`;");
    // Only a link with no tab opens the tab the person is in now.
    const page = read("src/app/admin/unpaid/page.tsx");
    expect(page).toContain("if (q.sel && sp.tab === undefined) {");
    expect(page).toContain("const soon = dueSoonMs(settings[\"notify.followup_due_minutes\"]);");
    // The plan opens each person in their own tab; Follow-ups today opens the plan, which lists what it counts.
    expect(page).toContain("tab: queueOf(l, now, soon) })),");
    expect(read("src/components/admin/unpaid/overview.tsx")).toContain('href={unpaidHref({ ...DEFAULT_QUERY, range: q.range }, { sel: i.key, tab: i.tab ?? "all" }, "#lead")}');
    expect(page).toContain('href: unpaidHref(q, {}, "#uplan"), tone: "today" },');
  });

  it("a Call or WhatsApp tap moves no one; it opens that person's Log a follow-up (list, details, alert pop-up, Live now)", async () => {
    // Reaching someone only writes the audit log.
    const actions = read("src/lib/admin/unpaid-followup-actions.ts");
    const reach = actions.slice(actions.indexOf("export async function reachLead"), actions.indexOf("export async function resumeLinkFor"));
    expect(reach).not.toMatch(/from\("(unpaid_leads|lead_activities)"\)/);
    const ui = read("src/components/admin/unpaid/actions.tsx");
    expect(ui).toContain("showLogAfterReach(router, leadKey, channel, openHref);");
    // The arrival mark is read once per person and taken out of the address, so a refresh or a save can't repeat it.
    expect(ui).toContain("const arrived = /^#log-(note|call|whatsapp|sms|email)$/.exec(window.location.hash);");
    expect(ui).toContain('window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);');
    expect(ui).toMatch(/window\.removeEventListener\(REACHED_EVENT, onReached\);\s*\};\s*\}, \[leadKey\]\);/);
    // On the Unpaid page the person opens in the admin's own view (tab, search, filters, order).
    expect(read("src/components/admin/unpaid/reached.ts")).toContain('const tab = document.querySelector("[data-unpaid-list]")?.getAttribute("data-tab");');
    expect(read("src/components/admin/unpaid/lead-list.tsx")).toContain("data-unpaid-list data-tab={q.tab}");
    expect(ui).toContain('t(unread ? "admin.unpaid.fu.log.reachedHint" : "admin.unpaid.fu.log.reachedHintSaved")');
    expect(ui).toContain("t(`admin.unpaid.fu.list.tabs.${r.queue}`)");
    expect(ui).toContain("if (!nextTouched) setNext(NEXT_FOR[r]);");
    expect(read("src/components/admin/unpaid/lead-list.tsx")).toContain("openHref={unpaidHref(q, { sel: l.key })}");
    expect(read("src/components/admin/unpaid/lead-details.tsx")).toContain("openHref={openHref} />");
    expect(read("src/components/admin/admin-alerts.tsx")).toContain('showLogAfterReach(router, p.key, "call", p.link);');
    expect(read("src/components/admin/unpaid/live.tsx")).toContain('showLogAfterReach(router, c.leadKey!, "call",');
    // The pop-ups are on every admin page: the helper is a small file of its own.
    expect(read("src/components/admin/admin-alerts.tsx")).not.toContain("./unpaid/actions");
  });

  it("each tab opens in its own order, and Clear also clears Status", async () => {
    const { DEFAULT_QUERY, unpaidHref } = await import("@/lib/admin/unpaid-rules");
    // Any link to another tab (stat cards, funnel) drops the sort picked on this one, unless it gives its own.
    expect(unpaidHref({ ...DEFAULT_QUERY, tab: "due", sort: "money" }, { tab: "won" })).toBe("/admin/unpaid?tab=won");
    expect(unpaidHref({ ...DEFAULT_QUERY, tab: "due", sort: "money" }, { tab: "all", sort: "money" })).toBe("/admin/unpaid?tab=all&sort=money");
    expect(unpaidHref({ ...DEFAULT_QUERY, tab: "due", sort: "money" }, { step: 3 })).toBe("/admin/unpaid?tab=due&sort=money&step=3");
    const list = read("src/components/admin/unpaid/lead-list.tsx");
    expect(list).toContain("href={unpaidHref(q, { tab, sort: null, sel: null })}");
    expect(list).toContain('q: "", status: null, step: null');
  });

  it("a result suggests its next follow-up: again in 2 hours after no answer, tomorrow after talking", async () => {
    const { NEXT_FOR } = await import("@/lib/admin/unpaid-rules");
    expect(NEXT_FOR).toMatchObject({ no_answer: "2h", busy: "2h", needs_help: "2h", talked: "tomorrow", will_pay: "tomorrow", wrong_number: "none", not_interested: "none" });
  });

  it("filters by step, owner, amount and when they started; sorts by money", async () => {
    const { matchesFilters, sortLeads, DEFAULT_QUERY } = await import("@/lib/admin/unpaid-rules");
    const q = { ...DEFAULT_QUERY };
    expect(matchesFilters(base, { ...q, step: 8 }, now, "me1")).toBe(true);
    expect(matchesFilters(base, { ...q, step: 9 }, now, "me1")).toBe(false);
    expect(matchesFilters({ ...base, ownerId: "me1" }, { ...q, owner: "me" }, now, "me1")).toBe(true);
    expect(matchesFilters(base, { ...q, owner: "none" }, now, "me1")).toBe(true);
    expect(matchesFilters(base, { ...q, amount: "5to10k" }, now, "me1")).toBe(true);
    expect(matchesFilters({ ...base, amount: null }, { ...q, amount: "lt5k" }, now, "me1")).toBe(false);
    expect(matchesFilters(base, { ...q, started: "today" }, now, "me1")).toBe(false);
    expect(matchesFilters(base, { ...q, started: "7" }, now, "me1")).toBe(true);
    expect(sortLeads([{ ...base, amount: 3000 }, { ...base, amount: null }, { ...base, amount: 9000 }], "money").map((l) => l.amount)).toEqual([9000, 3000, null]);
  });

  it("never keeps a phone number or email in the address; a contact search shows the found leads by key", async () => {
    const { parseUnpaidQuery, unpaidHref, isContactSearch } = await import("@/lib/admin/unpaid-rules");
    expect(isContactSearch("01711111111")).toBe(true);
    expect(isContactSearch("client@example.com")).toBe(true);
    expect(isContactSearch("LC-0016")).toBe(false);
    expect(isContactSearch("Sample Tea")).toBe(false);
    expect(parseUnpaidQuery({ q: "01711111111" }).q).toBe("");
    expect(parseUnpaidQuery({ q: "a@b.co" }).q).toBe("");
    const a = "c:0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";
    const b = "g:1f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";
    const q = parseUnpaidQuery({ only: `${a},${b},+8801711111111` });
    expect(q.only).toEqual([a, b]);
    expect(unpaidHref(q)).toBe(`/admin/unpaid?only=${encodeURIComponent(`${a},${b}`)}`);
  });

  it("reads and writes the view in the address; a lead is a contest or visit id, never a phone number", async () => {
    const { parseUnpaidQuery, unpaidHref } = await import("@/lib/admin/unpaid-rules");
    const id = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";
    // An old tab in a link opens the tab it became (owner, 2026-10-30).
    const q = parseUnpaidQuery({ tab: "overdue", sort: "next", step: "8", owner: "me", range: "90", sel: `c:${id}`, q: "  LC-0016 " });
    expect(q).toMatchObject({ tab: "due", sort: "next", step: 8, owner: "me", range: "90", sel: `c:${id}`, q: "LC-0016" });
    expect(unpaidHref(q, { sel: null }, "#ulist")).toBe("/admin/unpaid?tab=due&q=LC-0016&sort=next&step=8&owner=me&range=90#ulist");
    expect(unpaidHref(parseUnpaidQuery({}))).toBe("/admin/unpaid");
    expect(parseUnpaidQuery({ sel: "g:+8801711111111", tab: "nope", step: "1; drop" })).toMatchObject({ sel: null, tab: "unread", step: null });
    expect(parseUnpaidQuery({ tab: "promised" })).toMatchObject({ tab: "all", status: "promised" });
    expect(unpaidHref(parseUnpaidQuery({ tab: "unreachable" }))).toBe("/admin/unpaid?tab=all&status=not_reachable");
    expect(parseUnpaidQuery({ tab: "new" }).tab).toBe("unread");
    // Each tab has its own order until another is picked.
    const { sortOf } = await import("@/lib/admin/unpaid-rules");
    expect(sortOf(parseUnpaidQuery({}))).toBe("money");
    expect(sortOf(parseUnpaidQuery({ tab: "due" }))).toBe("next");
    expect(sortOf(parseUnpaidQuery({ tab: "due", sort: "newest" }))).toBe("newest");
    expect(parseUnpaidQuery({ sel: `l:${id}` }).sel).toBe(`l:${id}`);
  });

  it("Close as fake needs the tick, a reason and a note", async () => {
    const { fakeCloseErrors } = await import("@/lib/admin/unpaid-rules");
    expect(fakeCloseErrors({ confirmed: false, reason: "", note: "" })).toEqual(["confirm", "reason", "note"]);
    expect(fakeCloseErrors({ confirmed: true, reason: "made-up", note: "Called, test" })).toEqual(["reason"]);
    expect(fakeCloseErrors({ confirmed: true, reason: "test", note: "Called, it was their test" })).toEqual([]);
  });
});

// ---- Server actions (permission, rules, audit, blocks) -----------------------------------------------------------------

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, failAudit: false, seq: 0 }));
const who = vi.hoisted(() => ({ admin: null as null | { id: string; isSuperAdmin: boolean }, perm: "" }));
const audits = vi.hoisted(() => [] as unknown[][]);

function table(name: string) {
  const rows = () => (db.tables[name] ??= []);
  const filters: ((r: Row) => boolean)[] = [];
  let op: { kind: "select" } | { kind: "insert"; rows: Row[] } | { kind: "update"; patch: Row } | { kind: "delete" } = { kind: "select" };
  let single = false;
  let returning = false;
  let counting = false;
  const q = {
    select: (_cols?: string, o?: { count?: string }) => ((counting = Boolean(o?.count) || counting), (returning = op.kind !== "select" || returning), q),
    delete: () => ((op = { kind: "delete" }), q),
    insert: (r: Row | Row[]) => ((op = { kind: "insert", rows: Array.isArray(r) ? r : [r] }), q),
    update: (p: Row) => ((op = { kind: "update", patch: p }), q),
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
    neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), q),
    is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
    in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), q),
    not: (k: string, _o: string, v: unknown) => (filters.push((r) => (r[k] ?? null) !== v), q),
    ilike: (k: string, v: string) => (filters.push((r) => String(r[k] ?? "").toLowerCase().includes(v.replace(/%/g, "").toLowerCase())), q),
    order: () => q,
    limit: () => q,
    maybeSingle: () => ((single = true), q),
    then: (ok: (v: unknown) => unknown) => {
      if (name === "audit_logs" && op.kind === "insert" && db.failAudit) return Promise.resolve({ data: null, error: { message: "down" } }).then(ok);
      if (op.kind === "insert") {
        const made: Row[] = op.rows.map((r) => ({ id: `id${++db.seq}`, status: "new", contacts_count: 0, no_answer_streak: 0, created_at: new Date().toISOString(), ...r }));
        for (const m of made) {
          if (name === "unpaid_leads" && rows().some((x) => (m.contest_id && x.contest_id === m.contest_id) || (m.guest_mobile && x.guest_mobile === m.guest_mobile))) return Promise.resolve({ data: null, error: { code: "23505" } }).then(ok);
          if (name === "blocked_contacts" && rows().some((x) => x.kind === m.kind && x.value === m.value && !x.lifted_at)) return Promise.resolve({ data: null, error: { code: "23505" } }).then(ok);
        }
        rows().push(...made);
        return Promise.resolve({ data: single ? made[0] : returning ? made : null, error: null }).then(ok);
      }
      const hit = rows().filter((r) => filters.every((f) => f(r)));
      if (op.kind === "delete") db.tables[name] = rows().filter((r) => !hit.includes(r));
      if (counting) return Promise.resolve({ data: null, count: hit.length, error: null }).then(ok);
      if (op.kind === "update") for (const r of hit) Object.assign(r, op.patch);
      const data = hit.map((r) => ({ ...r }));
      return Promise.resolve({ data: single ? (data[0] ?? null) : data, error: null }).then(ok);
    },
  };
  return q;
}

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (n: string) => table(n) }) }));
vi.mock("@/lib/admin/core", () => ({
  adminUser: async (perm?: string) => (who.admin && (!perm || who.perm === perm || who.admin.isSuperAdmin) ? who.admin : null),
  superAdmin: async () => (who.admin?.isSuperAdmin ? who.admin : null),
  audit: async (...args: unknown[]) => void audits.push(args),
}));
vi.mock("@/lib/admin/recipients", () => ({ adminIdsWith: async () => ["a1", "a2"] }));
const purged = vi.hoisted(() => [] as string[]);
vi.mock("@/lib/admin/trash", () => ({ purgeUser: async (id: string) => void purged.push(id) }));
vi.mock("@/lib/settings", () => ({ getSettings: async () => ({ "notify.followup_due_minutes": 10 }) }));
// The resume link has its own tests (tests/resume-link.test.ts).
vi.mock("@/lib/contests/resume", () => ({ noteResume: vi.fn(), resumeLink: async (id: string) => `https://logocontest.bd/r/link-${id}`, resumeTarget: async () => ({}) }));

const C = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";
const KEY = `c:${C}`;
beforeEach(() => {
  db.tables = {
    contests: [{ id: C, brand_name: "Sample Tea", total_amount: 6250, client_id: "u1", status: "draft" }],
    profiles: [{ id: "u1", mobile: "+8801711111111", email: "client@example.com" }],
  };
  db.failAudit = false;
  who.admin = { id: "a1", isSuperAdmin: false };
  who.perm = "unpaid.manage";
  audits.length = 0;
});

describe("follow-up actions", () => {
  it("need Unpaid contests · manage", async () => {
    const { logFollowUp, closeAsFake, reachLead } = await import("@/lib/admin/unpaid-followup-actions");
    who.perm = "unpaid.view";
    expect(await logFollowUp(KEY, { how: "call", result: "talked", next: "2h" })).toEqual({ ok: false, error: "auth.errors.generic" });
    expect((await closeAsFake(KEY, { confirmed: true, reason: "test", note: "called", hide: true, block: false, stopReminders: true })).ok).toBe(false);
    expect(await reachLead(KEY, "reveal")).toEqual({ ok: false });
    expect(db.tables.unpaid_leads ?? []).toHaveLength(0);
  });

  it("a call with Will pay makes the lead Promised to pay, plans the next one, and logs it without the number", async () => {
    const { logFollowUp } = await import("@/lib/admin/unpaid-followup-actions");
    // Tonight is Due now only within its last minutes before 8 pm: the tab is checked below with fixed times.
    expect(await logFollowUp(KEY, { how: "call", result: "will_pay", note: "Pays tonight", next: "tonight" })).toMatchObject({ ok: true });
    const lead = db.tables.unpaid_leads[0];
    expect(lead).toMatchObject({ kind: "contest", contest_id: C, status: "promised", contacts_count: 1, last_contact_type: "call", last_result: "will_pay", owner_id: "a1", next_followup_type: "call" });
    expect(lead.next_followup_at).toBeTruthy();
    expect(db.tables.lead_activities[0]).toMatchObject({ lead_id: lead.id, kind: "call", result: "will_pay", note: "Pays tonight" });
    expect(JSON.stringify(audits)).not.toMatch(/1711111111/);
    // "Fake contest" never logs: it goes through Close as fake.
    expect(await logFollowUp(KEY, { how: "call", result: "fake", next: "none" })).toEqual({ ok: false, error: "admin.unpaid.fu.errors.result" });
  });

  it("a note keeps the planned follow-up and doesn't count it as done; Done on a later one isn't today's work", async () => {
    const { logFollowUp, followUpDone } = await import("@/lib/admin/unpaid-followup-actions");
    await logFollowUp(KEY, { how: "call", result: "talked", next: "tomorrow" });
    const planned = db.tables.unpaid_leads[0].next_followup_at;
    expect(await logFollowUp(KEY, { how: "note", note: "Sent the price list", next: "keep" })).toEqual({ ok: true, queue: "waiting" });
    expect(db.tables.unpaid_leads[0]).toMatchObject({ next_followup_at: planned, contacts_count: 1 });
    expect(db.tables.lead_activities.at(-1)).toMatchObject({ kind: "note", completes_at: null });
    expect(await followUpDone(KEY)).toEqual({ ok: true });
    expect(db.tables.lead_activities.at(-1)).toMatchObject({ event: "followup_done", completes_at: null });
    expect(db.tables.unpaid_leads[0].next_followup_at).toBeNull();
  });

  it("a guest who signs up keeps their follow-up: the draft takes over the guest's row", async () => {
    const { logFollowUp } = await import("@/lib/admin/unpaid-followup-actions");
    db.tables.unpaid_leads = [{ id: "g1", kind: "guest", guest_mobile: "+8801711111111", contest_id: null, status: "promised", contacts_count: 2, no_answer_streak: 0, owner_id: "a2" }];
    expect(await logFollowUp(KEY, { how: "call", result: "talked", next: "2h" })).toEqual({ ok: true, queue: "waiting" });
    expect(db.tables.unpaid_leads).toHaveLength(1);
    expect(db.tables.unpaid_leads[0]).toMatchObject({ id: "g1", kind: "contest", contest_id: C, guest_mobile: null, client_id: "u1", status: "promised", contacts_count: 3, owner_id: "a2" });
  });

  it("two No answers in a row make it Not reachable", async () => {
    const { logFollowUp } = await import("@/lib/admin/unpaid-followup-actions");
    await logFollowUp(KEY, { how: "call", result: "no_answer", next: "2h" });
    await logFollowUp(KEY, { how: "call", result: "no_answer", next: "tomorrow" });
    expect(db.tables.unpaid_leads[0]).toMatchObject({ status: "not_reachable", no_answer_streak: 2, contacts_count: 2 });
  });

  it("a save says the tab the lead is in now: Waiting until its time, Closed for Not interested (owner, 2026-10-30)", async () => {
    const { logFollowUp } = await import("@/lib/admin/unpaid-followup-actions");
    expect(await logFollowUp(KEY, { how: "note", note: "Asked for the price list", next: "none" })).toEqual({ ok: true, queue: "waiting" });
    expect(await logFollowUp(KEY, { how: "call", result: "no_answer", next: "2h" })).toEqual({ ok: true, queue: "waiting" });
    expect(await logFollowUp(KEY, { how: "whatsapp", result: "not_interested", next: "2h" })).toEqual({ ok: true, queue: "closed" });
  });

  it("a save lands in Due now when its follow-up is due within the alert's minutes, or already overdue", async () => {
    const { logFollowUp } = await import("@/lib/admin/unpaid-followup-actions");
    // A time picked 8 minutes ahead, in Dhaka time (the alert's minutes are 10 here).
    const soon = new Date(Date.now() + 8 * 60_000 + 6 * 3_600_000).toISOString().slice(0, 16);
    expect(await logFollowUp(KEY, { how: "call", result: "talked", next: "pick", pickAt: soon })).toEqual({ ok: true, queue: "due" });
    // A note that keeps a plan whose time has passed.
    db.tables.unpaid_leads[0].next_followup_at = new Date(Date.now() - 3_600_000).toISOString();
    expect(await logFollowUp(KEY, { how: "note", note: "Will call back", next: "keep" })).toEqual({ ok: true, queue: "due" });
  });

  it("Close as fake needs the tick, a reason and a note; it hides, blocks the phone and email, and never deletes", async () => {
    const { closeAsFake, logFollowUp } = await import("@/lib/admin/unpaid-followup-actions");
    expect(await closeAsFake(KEY, { confirmed: false, reason: "test", note: "called them", hide: true, block: true, stopReminders: true })).toEqual({ ok: false, error: "admin.unpaid.fu.fake.errors.confirm" });
    expect(await closeAsFake(KEY, { confirmed: true, reason: "test", note: "", hide: true, block: true, stopReminders: true })).toEqual({ ok: false, error: "admin.unpaid.fu.fake.errors.note" });
    expect(db.tables.blocked_contacts ?? []).toHaveLength(0);
    expect(await closeAsFake(KEY, { confirmed: true, reason: "test", note: "Called: it was their own test", hide: true, block: true, stopReminders: true })).toEqual({ ok: true });
    expect(db.tables.unpaid_leads[0]).toMatchObject({ status: "closed", closed_reason: "fake", fake_reason: "test", hidden: true, stop_reminders: true, closed_by: "a1" });
    expect(db.tables.blocked_contacts.map((b) => [b.kind, b.value])).toEqual([
      ["mobile", "+8801711111111"],
      ["email", "client@example.com"],
    ]);
    expect(db.tables.contests).toHaveLength(1);
    expect(audits.at(-1)).toEqual(["a1", "unpaid_close_fake", "lead", KEY, expect.objectContaining({ reason: "test", block: 2 })]);
    // A closed lead takes no more follow-ups.
    expect(await logFollowUp(KEY, { how: "call", result: "talked", next: "2h" })).toEqual({ ok: false, error: "admin.unpaid.fu.errors.closed" });
  });

  it("a guest's email is never blocked (they only typed it); a client's account email is", async () => {
    const { closeAsFake } = await import("@/lib/admin/unpaid-followup-actions");
    const V = "1f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";
    db.tables.wizard_leads = [{ visit_id: V, mobile: "+8801722222222", brand_name: "Guest Co", email: "someone@example.com", updated_at: new Date().toISOString() }];
    expect(await closeAsFake(`g:${V}`, { confirmed: true, reason: "spam", note: "Called: spam", hide: true, block: true, stopReminders: true })).toEqual({ ok: true });
    expect(db.tables.blocked_contacts.map((b) => [b.kind, b.value])).toEqual([["mobile", "+8801722222222"]]);
  });

  it("only an unpaid draft, or a contest this page already follows, can be reached or closed", async () => {
    const { reachLead, closeAsFake } = await import("@/lib/admin/unpaid-followup-actions");
    db.tables.contests[0].status = "open";
    expect(await reachLead(KEY, "reveal")).toEqual({ ok: false });
    expect((await closeAsFake(KEY, { confirmed: true, reason: "test", note: "Called: test", hide: true, block: true, stopReminders: true })).ok).toBe(false);
    expect(db.tables.audit_logs ?? []).toHaveLength(0);
  });

  it("only a Super admin reopens, and reopening lifts the blocks it made", async () => {
    const { closeAsFake, reopenLead } = await import("@/lib/admin/unpaid-followup-actions");
    await closeAsFake(KEY, { confirmed: true, reason: "spam", note: "Called: spam", hide: true, block: true, stopReminders: true });
    expect((await reopenLead(KEY, { reason: "my mistake" })).ok).toBe(false);
    // Another fake-closed lead keeps its own block row for the same person.
    db.tables.blocked_contacts.push({ id: "other", kind: "mobile", value: "+8801711111111", lead_id: "another-lead", lifted_at: null });
    who.admin = { id: "s1", isSuperAdmin: true };
    expect(await reopenLead(KEY, { reason: "my mistake" })).toEqual({ ok: true });
    // Not blocked any more either (its resume link works again; owner, 2026-10-26).
    expect(db.tables.unpaid_leads[0]).toMatchObject({ status: "new", hidden: false, blocked: false, closed_reason: null });
    const mine = db.tables.blocked_contacts.filter((b) => b.lead_id === db.tables.unpaid_leads[0].id);
    expect(mine.length).toBe(2);
    expect(mine.every((b) => b.lifted_at && b.lifted_by === "s1")).toBe(true);
    expect(db.tables.blocked_contacts.find((b) => b.id === "other")!.lifted_at).toBeNull();
  });

  it("a phone or email search finds the draft and the guest by key (Unpaid · Manage only)", async () => {
    const { findLeadsByContact } = await import("@/lib/admin/unpaid-followup-actions");
    const V = "1f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";
    db.tables.profiles[0].role = "client";
    db.tables.wizard_leads = [{ visit_id: V, mobile: "+8801711111111", updated_at: new Date().toISOString() }];
    expect(await findLeadsByContact("01711-111111")).toEqual({ ok: true, keys: [KEY, `g:${V}`] });
    expect(await findLeadsByContact("client@example")).toEqual({ ok: true, keys: [KEY] });
    expect(await findLeadsByContact("0171")).toEqual({ ok: true, keys: [] });
    who.perm = "unpaid.view";
    expect(await findLeadsByContact("01711111111")).toEqual({ ok: false });
  });

  it("reaching someone is logged first: no log, no number", async () => {
    const { reachLead } = await import("@/lib/admin/unpaid-followup-actions");
    expect(await reachLead(KEY, "call")).toEqual({ ok: true, href: "tel:+8801711111111" });
    expect(await reachLead(KEY, "whatsapp")).toEqual({ ok: true, href: "https://wa.me/8801711111111" });
    expect(await reachLead(KEY, "reveal")).toEqual({ ok: true, mobile: "01711-111111", email: "client@example.com" });
    expect(db.tables.audit_logs.map((a) => a.action)).toEqual(["unpaid_contact", "unpaid_contact", "unpaid_reveal_contact"]);
    expect(JSON.stringify(db.tables.audit_logs)).not.toMatch(/1711111111/);
    db.failAudit = true;
    expect(await reachLead(KEY, "call")).toEqual({ ok: false });
  });
});

describe("blocks and the rest of the site", () => {
  it("a blocked phone or email can't start a new contest (sign-up, a new draft, or come back as a lead)", () => {
    const actions = read("src/lib/contests/actions.ts");
    expect(actions).toContain('if (await contactBlocked({ mobile, email })) return err("wizard.errors.blocked");');
    expect(actions).toContain('if (!input.contestId && (await contactBlocked({ mobile: user.mobile, email: user.email }))) return err("wizard.errors.blocked");');
    // The account itself (shared by the wizards and onboarding v2 since 2026-10-28): checked before it is made.
    const account = read("src/lib/contests/client-account.ts");
    // Checked with the others at once (owner, 2026-10-29), still before the account is made.
    expect(account).toContain("contactBlocked({ mobile, email })");
    expect(account).toContain('if (answer(blockedR)) return fail("wizard.errors.blocked");');
    expect(account.indexOf("contactBlocked({ mobile, email })")).toBeLessThan(account.indexOf("auth.admin.createUser"));
    expect(actions).toContain("const account = await createClientAccount(input,");
    expect(read("src/lib/onboarding/v2-actions.ts")).toContain('if (await contactBlocked({ mobile: user.mobile, email: user.email })) return err("wizard.errors.blocked");');
    expect(read("src/lib/wizard-tracking.ts")).toContain("if (await contactBlocked({ mobile })) return;");
  });

  it("a draft closed as fake and hidden leaves the admin lists and counts (it stays in Fake · closed)", () => {
    expect(read("src/lib/admin/contests.ts")).toContain('const hidden = q.status === "draft" || q.status === "pending_payment" ? notIn(await hiddenUnpaidIds()) : null;');
    expect(read("src/lib/admin/contests.ts")).toContain('hidden ? unpaidCount.not("id", "in", hidden) : unpaidCount');
    expect(read("src/lib/admin/badges.ts")).toContain('hidden ? fresh.not("id", "in", hidden) : fresh');
  });

  it("everything in a lead's details starts over when another person is shown (no action on the wrong person)", () => {
    expect(read("src/components/admin/unpaid/lead-details.tsx")).toContain('<AdmCard key={lead.key} as="section" id="lead"');
  });

  it("a link to someone who left the list never opens someone else", () => {
    expect(read("src/app/admin/unpaid/page.tsx")).toContain("const selected = q.sel ? (board.leads.find(");
    expect(read("src/app/admin/unpaid/page.tsx")).toContain("gone={Boolean(q.sel && !selected)}");
  });

  it("clicking a person opens them at once: the row and the details show it's loading, and links don't prefetch the page", () => {
    const actions = read("src/components/admin/unpaid/actions.tsx");
    expect(actions).toContain("start(() => router.push(href, { scroll: false }));");
    expect(actions).toContain('className={cx("min-w-0 transition-opacity", pending && "pointer-events-none opacity-45")}');
    const page = read("src/app/admin/unpaid/page.tsx");
    expect(page).toContain("<LeadSelection>");
    expect(page).toContain("<DetailsWhileLoading>");
    expect(page).toContain("cachedStuckFunnel(q.range)");
    for (const f of ["overview", "lead-list", "lead-details", "actions"]) {
      const src = read(`src/components/admin/unpaid/${f}.tsx`);
      expect(src.match(/<Link\b/g)?.length, f).toBe(src.match(/<Link\b[^>]*?prefetch=\{false\}|<Link\s+prefetch=\{false\}/g)?.length);
    }
  });

  it("a draft the team is following up is not moved to the Trash after 72 hours, and never stalls the others", () => {
    const trash = read("src/lib/admin/trash.ts");
    expect(trash).toContain(".range(kept, kept + limit - 1)");
    expect(trash).toContain('db().from("unpaid_leads").select("contest_id, contacts_count, next_followup_at").neq("status", "closed").in("contest_id", ids)');
  });

  it("phone and email reach the page only for Unpaid · Manage, worked out on the server", () => {
    const page = read("src/app/admin/unpaid/page.tsx");
    expect(page).toContain("const masked = canManage && contact?.mobile ?");
    // A phone or email search never matches from the address: it goes through findLeadsByContact (Unpaid · Manage).
    expect(page).toContain('const needle = isContactSearch(q.q) ? "" : q.q.toLowerCase();');
    expect(read("src/components/admin/unpaid/actions.tsx")).toContain("if (canManage && isContactSearch(value))");
    // The lead list and details never get the contacts map, only flags and a masked number.
    for (const f of ["src/components/admin/unpaid/lead-list.tsx", "src/components/admin/unpaid/lead-details.tsx", "src/components/admin/unpaid/overview.tsx"]) expect(read(f), f).not.toMatch(/contacts\.get|board\.contacts|type Contact\b/);
    expect(read("src/lib/admin/unpaid-board.ts")).toContain("contacts: Map<string, Contact>;");
  });

  it("the new tables are server-only (RLS on, no policies) and nothing is deleted with a draft", () => {
    const sql = read("supabase/migrations/0076_unpaid_followups.sql");
    for (const t of ["unpaid_leads", "lead_activities", "blocked_contacts"]) expect(sql).toContain(`alter table public.${t} enable row level security;`);
    expect(sql).not.toMatch(/create policy/);
    expect(sql).toContain("contest_id         uuid unique references public.contests (id) on delete set null");
    expect(read("supabase/rollback/0076_unpaid_followups_down.sql")).toContain("drop table if exists public.unpaid_leads;");
  });
});

// Owner, 2026-10-31: a client who meant to sign up as a designer gets their email back.
describe("Delete account on Unpaid contests", () => {
  beforeEach(() => {
    purged.length = 0;
    audits.length = 0;
    db.tables.profiles = [{ id: "u1", role: "client", mobile: "+8801711111111", email: "client@example.com" }];
    db.tables.unpaid_leads = [{ id: "L1", contest_id: C, client_id: "u1", status: "new" }];
    db.tables.lead_activities = [];
    db.tables.payments = [];
    db.tables.manual_payments = [];
  });
  const run = async (f: Record<string, string> = { reason: "Meant to be a designer" }) => (await import("@/lib/admin/unpaid-followup-actions")).deleteUnpaidAccount(KEY, f);

  it("only a Super admin, with a reason", async () => {
    who.admin = { id: "a1", isSuperAdmin: false };
    expect((await run()).ok).toBe(false);
    who.admin = { id: "a1", isSuperAdmin: true };
    expect(await run({ reason: " " })).toEqual({ ok: false, error: "admin.errors.reason" });
    expect(purged).toEqual([]);
  });

  it("erases a client who never paid, with their lead, and logs no contact details", async () => {
    who.admin = { id: "a1", isSuperAdmin: true };
    expect(await run()).toEqual({ ok: true });
    expect(purged).toEqual(["u1"]);
    expect(db.tables.unpaid_leads).toEqual([]);
    expect(audits).toHaveLength(1);
    expect(JSON.stringify(audits)).not.toMatch(/8801711111111|client@example/);
  });

  it("never someone who paid, sent a bKash payment, has a live contest, or isn't a client", async () => {
    who.admin = { id: "a1", isSuperAdmin: true };
    db.tables.payments = [{ id: "p1", client_id: "u1", status: "paid" }];
    expect(await run()).toEqual({ ok: false, error: "admin.unpaid.fu.delete.errors.paid" });
    db.tables.payments = [];
    db.tables.manual_payments = [{ id: "m1", user_id: "u1", status: "pending" }];
    expect(await run()).toEqual({ ok: false, error: "admin.unpaid.fu.delete.errors.paid" });
    db.tables.manual_payments = [];
    db.tables.contests.push({ id: "c2", client_id: "u1", status: "open" });
    expect(await run()).toEqual({ ok: false, error: "admin.unpaid.fu.delete.errors.paid" });
    db.tables.contests.pop();
    db.tables.profiles = [{ id: "u1", role: "designer" }];
    expect(await run()).toEqual({ ok: false, error: "admin.unpaid.fu.delete.errors.notClient" });
    expect(purged).toEqual([]);
  });
});
