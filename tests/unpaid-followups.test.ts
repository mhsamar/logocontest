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

  it("overdue when the follow-up time has passed; closed and won back leave the open tabs", async () => {
    const { inTab, shownStatus } = await import("@/lib/admin/unpaid-rules");
    const late = { ...base, nextAt: new Date("2026-10-25T08:00:00Z") };
    expect(inTab(late, "overdue", now)).toBe(true);
    expect(inTab(late, "today", now)).toBe(true);
    expect(shownStatus(late, now)).toBe("overdue");
    expect(inTab({ ...base, nextAt: new Date("2026-10-25T12:00:00Z") }, "overdue", now)).toBe(false);
    const fake = { ...late, status: "closed" as const, closedReason: "fake" as const, hidden: true };
    expect(inTab(fake, "all", now) || inTab(fake, "overdue", now)).toBe(false);
    expect(inTab(fake, "closed", now)).toBe(true);
    expect(shownStatus(fake, now)).toBe("closed_fake");
    const won = { ...base, wonBackAt: now };
    expect(inTab(won, "all", now)).toBe(false);
    expect(inTab(won, "won", now)).toBe(true);
    expect(inTab({ ...base, status: "new" as const, contacts: 0 }, "new", now)).toBe(true);
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
    const q = parseUnpaidQuery({ tab: "overdue", sort: "next", step: "8", owner: "me", range: "90", sel: `c:${id}`, q: "  LC-0016 " });
    expect(q).toMatchObject({ tab: "overdue", sort: "next", step: 8, owner: "me", range: "90", sel: `c:${id}`, q: "LC-0016" });
    expect(unpaidHref(q, { sel: null }, "#ulist")).toBe("/admin/unpaid?tab=overdue&q=LC-0016&sort=next&step=8&owner=me&range=90#ulist");
    expect(unpaidHref(parseUnpaidQuery({}))).toBe("/admin/unpaid");
    expect(parseUnpaidQuery({ sel: "g:+8801711111111", tab: "nope", step: "1; drop" })).toMatchObject({ sel: null, tab: "all", step: null });
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
  let op: { kind: "select" } | { kind: "insert"; rows: Row[] } | { kind: "update"; patch: Row } = { kind: "select" };
  let single = false;
  let returning = false;
  const q = {
    select: () => ((returning = op.kind !== "select" || returning), q),
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
    expect(await logFollowUp(KEY, { how: "call", result: "will_pay", note: "Pays tonight", next: "tonight" })).toEqual({ ok: true });
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
    expect(await logFollowUp(KEY, { how: "note", note: "Sent the price list", next: "keep" })).toEqual({ ok: true });
    expect(db.tables.unpaid_leads[0]).toMatchObject({ next_followup_at: planned, contacts_count: 1 });
    expect(db.tables.lead_activities.at(-1)).toMatchObject({ kind: "note", completes_at: null });
    expect(await followUpDone(KEY)).toEqual({ ok: true });
    expect(db.tables.lead_activities.at(-1)).toMatchObject({ event: "followup_done", completes_at: null });
    expect(db.tables.unpaid_leads[0].next_followup_at).toBeNull();
  });

  it("a guest who signs up keeps their follow-up: the draft takes over the guest's row", async () => {
    const { logFollowUp } = await import("@/lib/admin/unpaid-followup-actions");
    db.tables.unpaid_leads = [{ id: "g1", kind: "guest", guest_mobile: "+8801711111111", contest_id: null, status: "promised", contacts_count: 2, no_answer_streak: 0, owner_id: "a2" }];
    expect(await logFollowUp(KEY, { how: "call", result: "talked", next: "2h" })).toEqual({ ok: true });
    expect(db.tables.unpaid_leads).toHaveLength(1);
    expect(db.tables.unpaid_leads[0]).toMatchObject({ id: "g1", kind: "contest", contest_id: C, guest_mobile: null, client_id: "u1", status: "promised", contacts_count: 3, owner_id: "a2" });
  });

  it("two No answers in a row make it Not reachable", async () => {
    const { logFollowUp } = await import("@/lib/admin/unpaid-followup-actions");
    await logFollowUp(KEY, { how: "call", result: "no_answer", next: "2h" });
    await logFollowUp(KEY, { how: "call", result: "no_answer", next: "tomorrow" });
    expect(db.tables.unpaid_leads[0]).toMatchObject({ status: "not_reachable", no_answer_streak: 2, contacts_count: 2 });
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
    expect(actions.indexOf("contactBlocked({ mobile, email })", actions.indexOf("export async function createAccountAndDraft"))).toBeLessThan(actions.indexOf("auth.admin.createUser"));
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
