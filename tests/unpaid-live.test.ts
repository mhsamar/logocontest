import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Owner, 2026-10-25 (Design/unpaid-contests, phase 2): "Creating a contest right now", Watch and Offer help.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

// ---- Pure rules -------------------------------------------------------------------------------------------------------

describe("what Start a contest sends", () => {
  it("keeps only the known form answers, checked, and never contact details, passwords or payment choices", async () => {
    const { cleanLiveAnswers } = await import("@/lib/wizard-live-rules");
    const raw = {
      brand: "  Sample   Tea  ",
      business: "food",
      businessOther: "ignored unless other",
      styles: ["wordmark", "nope", "wordmark", 3],
      colours: 2.7,
      designersChoose: true,
      links: -4,
      package: "pro",
      prize: 9000,
      days: 7,
      upgrades: ["blind", "free_money"],
      password: "secret123",
      method: "bkash",
      promo: "SAVE10",
      terms: true,
      name: "Rahim",
      mobile: "01711111111",
      email: "a@b.c",
    };
    expect(cleanLiveAnswers(raw)).toEqual({ brand: "Sample Tea", business: "food", styles: ["wordmark"], colours: 2, designersChoose: true, links: 0, package: "pro", prize: 9000, days: 7, upgrades: ["blind"] });
    expect(cleanLiveAnswers({ business: "other", businessOther: "Boat repair" })).toEqual({ business: "other", businessOther: "Boat repair" });
    for (const bad of [null, "x", [1], 5]) expect(cleanLiveAnswers(bad)).toEqual({});
    expect(cleanLiveAnswers({ brand: "x".repeat(500) }).brand).toHaveLength(80);
  });

  it("builds the logo and service snapshots from the form, never from the contact step", async () => {
    const { logoLiveAnswers, serviceLiveAnswers } = await import("@/lib/wizard-live-rules");
    const { emptyBrief, noUpgrades } = await import("@/lib/contests/brief");
    const brief = { ...emptyBrief(), brandName: "Sample Tea", businessType: "food" as const, styles: ["emblem" as const], colors: ["#000", "#fff"], requirements: ["trust" as const], links: [{ kind: "website" as const, url: "https://x.test" }, { kind: "facebook" as const, url: " " }] };
    const a = logoLiveAnswers(brief, { package: "custom", customPrize: 12000, durationDays: 5, upgrades: { ...noUpgrades(), nda: true } }, 3);
    expect(a).toMatchObject({ brand: "Sample Tea", business: "food", styles: ["emblem"], colours: 2, requirements: 1, links: 1, files: 3, package: "custom", prize: 12000, days: 5, upgrades: ["nda"] });
    expect(Object.keys(a).some((k) => /name$|mobile|email|password|method|promo|terms|whatsapp/i.test(k) && k !== "brand")).toBe(false);
    expect(serviceLiveAnswers({ title: "Card", prize: 3000, days: 4, upgrades: noUpgrades() }, 1)).toEqual({ brand: "Card", package: "custom", prize: 3000, days: 4, files: 1, upgrades: [] });
  });

  it("names the answer that changed, and the order the server prices", async () => {
    const { changedKey, orderFrom } = await import("@/lib/wizard-live-rules");
    expect(changedKey(null, { brand: "A" })).toBeNull();
    expect(changedKey({ brand: "A", styles: ["emblem"] }, { brand: "A", styles: ["emblem", "mascot"] })).toBe("styles");
    expect(changedKey({ brand: "A" }, { brand: "A" })).toBeNull();
    expect(orderFrom({ brand: "A" })).toBeNull();
    expect(orderFrom({ package: "custom", prize: 5000, days: 7, upgrades: ["blind"] })).toMatchObject({ package: "custom", customPrize: 5000, durationDays: 7, upgrades: { blind: true, nda: false } });
    expect(orderFrom({ package: "pro", prize: 5000, days: 7 })?.customPrize).toBeNull();
  });
});

describe("what the admin page shows", () => {
  const now = new Date("2026-10-25T12:00:00Z");
  const ago = (s: number) => new Date(now.getTime() - s * 1000);

  it("lists only people on the page this minute, before payment", async () => {
    const { isLive, isHot } = await import("@/lib/wizard-live-rules");
    expect(isLive({ stage: 5, updatedAt: ago(20), endedAt: null }, now)).toBe(true);
    expect(isLive({ stage: 5, updatedAt: ago(61), endedAt: null }, now)).toBe(false);
    expect(isLive({ stage: 9, updatedAt: ago(1), endedAt: null }, now)).toBe(false);
    expect(isLive({ stage: 5, updatedAt: ago(1), endedAt: ago(1) }, now)).toBe(false);
    expect([7, 8].map((stage) => isHot({ stage }))).toEqual([false, true]);
  });

  it("allows one help message per visit, only to someone on the page now and never at payment", async () => {
    const { offerBlock } = await import("@/lib/wizard-live-rules");
    const here = { stage: 8, updatedAt: ago(5), endedAt: null, away: false };
    expect(offerBlock(here, now, false)).toBeNull();
    expect(offerBlock(here, now, true)).toBe("already");
    expect(offerBlock({ ...here, stage: 9 }, now, false)).toBe("atPayment");
    expect(offerBlock({ ...here, updatedAt: ago(31) }, now, false)).toBe("gone");
    expect(offerBlock({ ...here, away: true }, now, false)).toBe("gone");
    expect(offerBlock({ ...here, endedAt: ago(1) }, now, false)).toBe("gone");
    expect(offerBlock(null, now, false)).toBe("gone");
  });

  it("says what they are doing and how long they have been there", async () => {
    const { activityOf, onPage, firstName } = await import("@/lib/wizard-live-rules");
    expect(activityOf({ stage: 2, doing: "brand", away: false })).toEqual({ kind: "typing", field: "brand" });
    expect(activityOf({ stage: 3, doing: "business", away: false })).toEqual({ kind: "picked", field: "business" });
    expect(activityOf({ stage: 5, doing: "styles", away: false })).toEqual({ kind: "changing", field: "styles" });
    expect(activityOf({ stage: 1, doing: null, away: false })).toEqual({ kind: "details" });
    expect(activityOf({ stage: 8, doing: null, away: false })).toEqual({ kind: "review" });
    expect(activityOf({ stage: 4, doing: "password", away: false })).toEqual({ kind: "idle" });
    expect(activityOf({ stage: 4, doing: "brand", away: true })).toEqual({ kind: "away" });
    expect(onPage(40_000)).toEqual({ n: 40, unit: "sec" });
    expect(onPage(9 * 60_000 + 5000)).toEqual({ n: 9, unit: "min" });
    expect(onPage(65 * 60_000)).toEqual({ h: 1, m: 5 });
    expect(onPage(-5)).toEqual({ n: 0, unit: "sec" });
    expect(firstName("  Sam Rahman ")).toBe("Sam");
    expect(firstName(null)).toBe("");
  });
});

// ---- The live route and the admin actions -------------------------------------------------------------------------------

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, seq: 0 }));
const who = vi.hoisted(() => ({ admin: null as null | { id: string; isSuperAdmin: boolean; locale: string }, perm: "", user: null as null | Row, as: "" }));
const audits = vi.hoisted(() => [] as unknown[][]);
const pushes = vi.hoisted(() => [] as unknown[][]);

function table(name: string) {
  const rows = () => (db.tables[name] ??= []);
  const filters: ((r: Row) => boolean)[] = [];
  let op: { kind: "select" } | { kind: "insert"; rows: Row[] } | { kind: "update"; patch: Row } | { kind: "delete" } = { kind: "select" };
  let single = false;
  let head = false;
  const q = {
    select: (_c?: string, o?: { head?: boolean }) => ((head = Boolean(o?.head)), q),
    insert: (r: Row | Row[]) => ((op = { kind: "insert", rows: Array.isArray(r) ? r : [r] }), q),
    update: (p: Row) => ((op = { kind: "update", patch: p }), q),
    delete: () => ((op = { kind: "delete" }), q),
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
    is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
    in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), q),
    gt: (k: string, v: string) => (filters.push((r) => String(r[k]) > v), q),
    lt: (k: string, v: string) => (filters.push((r) => String(r[k]) < v), q),
    order: () => q,
    limit: () => q,
    maybeSingle: () => ((single = true), q),
    then: (ok: (v: unknown) => unknown) => {
      if (op.kind === "insert") {
        const made: Row[] = op.rows.map((r) => ({ id: name === "help_messages" ? ++db.seq : `id${++db.seq}`, created_at: new Date().toISOString(), ...r }));
        if (name === "help_offers" && made.some((m) => rows().some((x) => x.visit_id === m.visit_id))) return Promise.resolve({ data: null, error: { code: "23505" } }).then(ok);
        rows().push(...made);
        return Promise.resolve({ data: single ? made[0] : made, error: null }).then(ok);
      }
      const hit = rows().filter((r) => filters.every((f) => f(r)));
      if (op.kind === "update") for (const r of hit) Object.assign(r, op.patch);
      if (op.kind === "delete") db.tables[name] = rows().filter((r) => !hit.includes(r));
      const data = hit.map((r) => ({ ...r }));
      return Promise.resolve({ data: head ? null : single ? (data[0] ?? null) : data, count: hit.length, error: null }).then(ok);
    },
  };
  return q;
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (n: string) => table(n) }) }));
vi.mock("@/lib/admin/core", () => ({
  UUID: /^[0-9a-f-]{36}$/i,
  adminUser: async (perm?: string) => (who.admin && (!perm || who.perm === perm || who.perm === "unpaid.manage" || who.admin.isSuperAdmin) ? who.admin : null),
  audit: async (...args: unknown[]) => {
    audits.push(args);
    (db.tables.audit_logs ??= []).push({ admin_id: args[0], action: args[1], subject_type: args[2], subject_id: args[3], created_at: new Date().toISOString() });
  },
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => who.user }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "lc_as" && who.as ? { value: who.as } : undefined) }) }));
vi.mock("@/lib/contests/pricing-config", () => ({ getPricingConfig: async () => { throw new Error("not needed"); } }));
vi.mock("@/lib/notifications/broadcast", () => ({ notifyWithPush: async (...args: unknown[]) => void pushes.push(args) }));
// Phase 3's instant alerts from this route (someone new on the page, a client back to their draft): recorded here.
const liveAlerts = vi.hoisted(() => ({ creating: [] as unknown[][], back: [] as unknown[][] }));
vi.mock("@/lib/admin/unpaid-alerts", () => ({ alertCreating: async (...a: unknown[]) => void liveAlerts.creating.push(a), alertCameBack: async (...a: unknown[]) => void liveAlerts.back.push(a) }));
// The bell and push go out after the visitor's answer is sent back; here, at once.
vi.mock("next/server", async (load) => ({ ...(await load<typeof import("next/server")>()), after: (fn: () => unknown) => void fn() }));

// A new visit per test: the per-visit guard counts across tests.
let V = "";
let visits = 0;
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile";
let ip = 0;
async function send(body: Row, from = `10.0.${++ip}.1`) {
  const { POST } = await import("@/app/api/wizard/live/route");
  const { NextRequest } = await import("next/server");
  // A different address per request keeps the per-address guards out of the way (except where a test wants them).
  const req = new NextRequest("http://localhost/api/wizard/live", { method: "POST", body: JSON.stringify({ v: V, ...body }), headers: { "user-agent": UA, "x-vercel-ip-city": "Dhaka%20City", "x-forwarded-for": from } });
  return POST(req);
}
async function ping(body: Row) {
  return (await (await send(body)).json()) as { took?: boolean; offer: null | { status: string; from?: string; canCall?: boolean; messages?: { mine: boolean; kind: string; body: string }[] } };
}

beforeEach(() => {
  V = `0f1e2d3c-4b5a-6978-8796-${String(++visits).padStart(12, "0")}`;
  db.tables = { profiles: [{ id: "a1", name: "Sam Rahman" }] };
  who.admin = { id: "a1", isSuperAdmin: false, locale: "en" };
  who.perm = "unpaid.manage";
  who.user = null;
  who.as = "";
  audits.length = 0;
  pushes.length = 0;
});

describe("the live route", () => {
  it("keeps a guest's step and form answers (never their details), with a rough city and no address", async () => {
    liveAlerts.creating.length = 0;
    expect(await ping({ s: "logo", st: 3, p: 3, n: 8, a: { brand: "Sample Tea", password: "x", email: "a@b.c" }, d: "brand", loc: "bn" })).toEqual({ offer: null });
    const row = db.tables.wizard_live[0];
    expect(row).toMatchObject({ visit_id: V, user_id: null, stage: 3, pos: 3, steps_total: 8, doing: "brand", answers: { brand: "Sample Tea" }, device: "mobile", city: "Dhaka City", locale: "bn", ended_at: null });
    expect(JSON.stringify(row)).not.toMatch(/10\.0\.|a@b\.c|password/);
    // A new visit: "Someone is creating a contest now" (phase 3) is told once, not on the next ping.
    await ping({ s: "logo", st: 3 });
    expect(liveAlerts.creating.map((a) => a.slice(0, 2))).toEqual([[V, 3]]);
  });

  it("checks \"They came back\" when a client opens their own draft on a new visit (phase 3)", async () => {
    const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab";
    db.tables.contests = [{ id: A, client_id: "ca" }];
    who.user = { id: "ca", role: "client", mobile: "+8801711111111" };
    liveAlerts.back.length = 0;
    await ping({ st: 8, c: A });
    await ping({ st: 8, c: A });
    expect(liveAlerts.back.map((a) => a[0])).toEqual([A]);
  });

  it("ignores the team, designers and the Super admin's \"Log in as\"", async () => {
    who.user = { id: "a1", role: "admin" };
    await ping({ st: 3 });
    who.user = { id: "d1", role: "designer" };
    await ping({ st: 3 });
    who.user = { id: "c1", role: "client", mobile: "+8801711111111" };
    who.as = "c1|a1";
    await ping({ st: 3 });
    expect(db.tables.wizard_live ?? []).toHaveLength(0);
  });

  it("takes them off the list when they leave or go to payment", async () => {
    await ping({ st: 8 });
    await ping({ st: 9 });
    expect(db.tables.wizard_live[0]).toMatchObject({ stage: 9 });
    expect(db.tables.wizard_live[0].ended_at).toBeTruthy();
    await ping({ st: 8 });
    expect(db.tables.wizard_live[0].ended_at).toBeNull();
    await ping({ bye: true });
    expect(db.tables.wizard_live[0].ended_at).toBeTruthy();
  });

  it("brings the help message, and their answers reach the chat and the admin who wrote (once)", async () => {
    await ping({ st: 5 });
    db.tables.help_offers = [{ id: "o1", visit_id: V, user_id: null, admin_id: "a1", status: "sent", answered_at: null, unread_by_admin: 0 }];
    db.tables.help_messages = [{ id: 1, offer_id: "o1", from_admin: true, admin_id: "a1", kind: "text", body: "Hi! Need help?" }];
    const first = await ping({ st: 5, h: { act: "seen" } });
    expect(first.offer).toMatchObject({ status: "seen", from: "Sam", canCall: false, messages: [{ mine: false, body: "Hi! Need help?" }] });
    // No number yet: "Call me" is refused.
    await ping({ st: 5, h: { act: "call_me" } });
    expect(db.tables.help_messages).toHaveLength(1);
    const replied = await ping({ st: 5, h: { act: "reply", text: "  Is ৳8,000 enough?  " } });
    expect(replied.took).toBe(true);
    expect(replied.offer?.status).toBe("replied");
    // An empty reply isn't stored, and says so (the card keeps what was typed).
    expect((await ping({ st: 5, h: { act: "reply", text: "   " } })).took).toBe(false);
    expect(replied.offer?.messages?.at(-1)).toMatchObject({ mine: true, kind: "text", body: "Is ৳8,000 enough?" });
    await ping({ st: 5, h: { act: "reply", text: "And the days?" } });
    expect(db.tables.help_offers[0]).toMatchObject({ unread_by_admin: 2 });
    expect(pushes).toHaveLength(1);
    expect(pushes[0].slice(0, 3)).toEqual([["a1"], "help_reply_admin", {}]);
    const no = await ping({ st: 5, h: { act: "no_thanks" } });
    expect(no.offer).toEqual({ status: "declined" });
    await ping({ st: 5, h: { act: "reply", text: "after" } });
    expect(db.tables.help_messages.filter((m) => !m.from_admin)).toHaveLength(3);
  });

  it("doesn't keep someone else's draft when another person signs in on the same tab", async () => {
    db.tables.contests = [{ id: "c-a", client_id: "ca" }];
    who.user = { id: "ca", role: "client", mobile: "+8801711111111" };
    // An id that isn't a UUID is never taken.
    await ping({ st: 8, c: "c-a" });
    expect(db.tables.wizard_live[0].contest_id).toBeNull();
    const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    db.tables.contests = [{ id: A, client_id: "ca" }];
    await ping({ st: 8, c: A });
    expect(db.tables.wizard_live[0].contest_id).toBe(A);
    who.user = { id: "cb", role: "client", mobile: "+8801822222222" };
    await ping({ st: 2, c: null });
    expect(db.tables.wizard_live[0]).toMatchObject({ user_id: "cb", contest_id: null });
    // And someone can't claim another client's draft.
    await ping({ st: 8, c: A });
    expect(db.tables.wizard_live[0].contest_id).toBeNull();
  });

  it("slows down a flood: one visit, one address, and new visits from one address", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 62; i++) codes.push((await send({ st: 3 }, `10.9.${i}.1`)).status);
    expect(codes.filter((c) => c === 429).length).toBe(2);
    // Fresh visits from one address: 20 new ones in 10 minutes, then no more rows.
    db.tables.wizard_live = [];
    const many: number[] = [];
    for (let i = 0; i < 22; i++) many.push((await send({ v: `bbbbbbbb-bbbb-4bbb-8bbb-${String(i).padStart(12, "0")}`, st: 3 }, "10.8.8.8")).status);
    expect(many.filter((c) => c === 429).length).toBe(2);
    expect(db.tables.wizard_live).toHaveLength(20);
  });

  it("ignores a body that isn't an object, and says a help action wasn't taken when there is no chat", async () => {
    const { POST } = await import("@/app/api/wizard/live/route");
    const { NextRequest } = await import("next/server");
    const res = await POST(new NextRequest("http://localhost/api/wizard/live", { method: "POST", body: "null", headers: { "user-agent": UA, "x-forwarded-for": "10.7.7.7" } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ offer: null });
    expect(await ping({ st: 4, h: { act: "reply", text: "Hello?" } })).toEqual({ offer: null, took: false });
  });

  it("shows a help chat only to the person it was sent to", async () => {
    who.user = { id: "c1", role: "client", mobile: "+8801711111111" };
    await ping({ st: 5 });
    db.tables.help_offers = [{ id: "o1", visit_id: V, user_id: "c2", admin_id: "a1", status: "sent", answered_at: null }];
    expect((await ping({ st: 5 })).offer).toBeNull();
  });
});

describe("offer help (admin)", () => {
  const fresh = () => ({ visit_id: V, stage: 6, user_id: null, contest_id: null, away: false, updated_at: new Date().toISOString(), ended_at: null });

  it("needs Unpaid contests · manage", async () => {
    const { offerHelp, helpReply } = await import("@/lib/admin/unpaid-live-actions");
    who.perm = "unpaid.view";
    db.tables.wizard_live = [fresh()];
    expect(await offerHelp(V, "Hi")).toEqual({ ok: false, error: "auth.errors.generic" });
    expect(await helpReply(V, "Hi")).toEqual({ ok: false, error: "auth.errors.generic" });
    expect(read("src/lib/admin/unpaid-live-actions.ts").match(/adminUser\("unpaid\.manage"\)/g)).toHaveLength(2);
  });

  it("sends one message per visit, logged without its text", async () => {
    const { offerHelp } = await import("@/lib/admin/unpaid-live-actions");
    db.tables.wizard_live = [fresh()];
    expect(await offerHelp(V, "  ")).toEqual({ ok: false, error: "admin.unpaid.fu.now.errors.empty" });
    expect(await offerHelp(V, "Hi! I'm Sam from logocontest.bd 👋")).toEqual({ ok: true });
    expect(db.tables.help_offers[0]).toMatchObject({ visit_id: V, admin_id: "a1", stage_at_send: 6 });
    expect(db.tables.help_messages[0]).toMatchObject({ from_admin: true, kind: "text", body: "Hi! I'm Sam from logocontest.bd 👋" });
    expect(audits).toEqual([["a1", "unpaid_offer_help", "visit", V, { stage: 6 }]]);
    expect(await offerHelp(V, "Again")).toEqual({ ok: false, error: "admin.unpaid.fu.now.errors.already" });
  });

  it("never at payment, and only to someone on the page now", async () => {
    const { offerHelp } = await import("@/lib/admin/unpaid-live-actions");
    db.tables.wizard_live = [{ ...fresh(), stage: 9 }];
    expect(await offerHelp(V, "Hi")).toEqual({ ok: false, error: "admin.unpaid.fu.now.errors.atPayment" });
    db.tables.wizard_live = [{ ...fresh(), updated_at: new Date(Date.now() - 60_000).toISOString() }];
    expect(await offerHelp(V, "Hi")).toEqual({ ok: false, error: "admin.unpaid.fu.now.errors.gone" });
    db.tables.wizard_live = [];
    expect(await offerHelp(V, "Hi")).toEqual({ ok: false, error: "admin.unpaid.fu.now.errors.gone" });
    expect(db.tables.help_offers ?? []).toHaveLength(0);
  });

  it("answers only after they replied, and not after no thanks", async () => {
    const { helpReply } = await import("@/lib/admin/unpaid-live-actions");
    db.tables.help_offers = [{ id: "o1", visit_id: V, status: "seen", answered_at: null }];
    expect(await helpReply(V, "Yes")).toEqual({ ok: false, error: "admin.unpaid.fu.now.errors.waiting" });
    db.tables.help_offers[0] = { id: "o1", visit_id: V, status: "replied", answered_at: new Date().toISOString() };
    expect(await helpReply(V, "Yes — most contests at this prize get 20+ designs.")).toEqual({ ok: true });
    expect(audits.at(-1)).toEqual(["a1", "unpaid_help_reply", "visit", V]);
    db.tables.help_offers[0].status = "declined";
    expect(await helpReply(V, "Still there?")).toEqual({ ok: false, error: "admin.unpaid.fu.now.errors.declined" });
  });
});

describe("the admin's live list and Watch", () => {
  const row = () => ({ visit_id: V, user_id: null, contest_id: null, service: "logo", stage: 7, pos: 7, steps_total: 8, doing: "package", answers: { brand: "Sample Tea", business: "food", styles: ["emblem"], package: "pro", days: 7 }, total: 9250, device: "mobile", country: "BD", city: "Dhaka", locale: "bn", away: false, started_at: new Date(Date.now() - 60_000).toISOString(), step_since: new Date().toISOString(), updated_at: new Date().toISOString(), ended_at: null });

  it("lists who is there without their answers, and shows a guest's name only once step 1 is saved", async () => {
    const { liveCards } = await import("@/lib/admin/unpaid-live");
    db.tables.wizard_live = [row()];
    const { cards } = await liveCards({ id: "a1", role: "admin", status: "active", adminActive: true, locale: "en", isSuperAdmin: false, adminPermissions: ["unpaid.view"] } as never);
    expect(cards[0]).toMatchObject({ visit: V, name: null, answers: { business: "food", package: "pro" }, total: null, contact: null, leadKey: null });
    db.tables.wizard_leads = [{ visit_id: V, name: "Rahim", mobile: "+8801711111111", email: "r@example.com" }];
    const view = (await liveCards({ id: "a1", role: "admin", status: "active", adminActive: true, locale: "en", isSuperAdmin: false, adminPermissions: ["unpaid.view"] } as never)).cards[0];
    expect(view).toMatchObject({ name: "Rahim", contact: "hidden", leadKey: `g:${V}`, hasNumber: true });
    const manage = (await liveCards({ id: "a1", role: "admin", status: "active", adminActive: true, locale: "en", isSuperAdmin: false, adminPermissions: ["unpaid.view", "unpaid.manage"] } as never)).cards[0];
    expect(manage.contact).toEqual({ mobile: "01711-•••111", email: true });
    expect(JSON.stringify(manage)).not.toContain("+8801711111111");
  });

  it("gives every answer to Watch, logged once per admin and person every 10 minutes, also after they left", async () => {
    const { watchCard } = await import("@/lib/admin/unpaid-live");
    db.tables.wizard_live = [row()];
    const me = { id: "a1", role: "admin", status: "active", adminActive: true, locale: "en", isSuperAdmin: false, adminPermissions: ["unpaid.view"] } as never;
    const card = await watchCard(me, V);
    expect(card).toMatchObject({ answers: { brand: "Sample Tea", business: "food", styles: ["emblem"], package: "pro", days: 7 }, total: 9250, gone: false });
    await watchCard(me, V);
    expect(audits).toEqual([["a1", "unpaid_watch", "visit", V]]);
    db.tables.wizard_live[0].ended_at = new Date().toISOString();
    expect((await watchCard(me, V))?.gone).toBe(true);
    expect(await watchCard(me, "ffffffff-ffff-4fff-8fff-ffffffffffff")).toBeNull();
  });
});

// ---- Where it is built ---------------------------------------------------------------------------------------------------

describe("phase 2 wiring", () => {
  it("keeps the new tables server-only, with one message per visit, and a rollback", () => {
    const sql = read("supabase/migrations/0077_wizard_live_help.sql");
    for (const t of ["wizard_live", "help_offers", "help_messages"]) expect(sql).toContain(`alter table public.${t} enable row level security;`);
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).toContain("visit_id          uuid not null unique,");
    expect(read("supabase/rollback/0077_wizard_live_help_down.sql")).toContain("drop table if exists public.wizard_live;");
  });

  it("shows the help card only inside the two wizards, hidden while the rules are open and once Pay is pressed", () => {
    const wizard = read("src/components/wizard/wizard.tsx");
    expect(wizard).toContain('<HelpCard offer={live.offer} act={live.act} onClose={live.close} hidden={!state.contentOk || paying} above={bar} onSpace={setHelpSpace} />');
    // Pay pressed: the team's list hears "went to payment" at once.
    // Only Pay itself counts, not saving the review (which is busy too).
    expect(wizard).toContain("stage: paying ? S.review + 1 : step");
    expect(wizard).toContain("// Pay pressed (not just saving the review): the team's live list hears \"went to payment\" and no help shows.\n      setPaying(true);");
    // Room under the last fields while the card shows, so it never covers the terms tick.
    expect(wizard).toContain("{helpSpace > 0 && <div aria-hidden style={{ height: helpSpace }} />}");
    // The hook runs before the wizard's early return (hooks can't follow it).
    expect(wizard.indexOf("useWizardLive({")).toBeLessThan(wizard.indexOf("if (!state) {"));
    const service = read("src/components/services/service-wizard.tsx");
    expect(service).toContain('<HelpCard offer={live.offer} act={live.act} onClose={live.close} hidden={paying} above={bar} onSpace={setHelpSpace} />');
    expect(service).toContain("stage: paying ? SERVICE_STAGE.pay + 1 : SERVICE_STAGE[step]");
    expect(service).toContain("{helpSpace > 0 && <div aria-hidden style={{ height: helpSpace }} />}");
    for (const f of ["src/app/layout.tsx", "src/app/pay/layout.tsx", "src/components/client/client-area.tsx"]) expect(read(f)).not.toContain("HelpCard");
  });

  it("never sends the contact step, password or payment choices from the wizard", () => {
    const wizard = read("src/components/wizard/wizard.tsx");
    expect(wizard).toContain("logoLiveAnswers(state.brief, state.order, state.localFiles.length + serverFiles.length)");
    const hook = read("src/components/wizard/use-wizard-live.ts");
    expect(hook).not.toMatch(/password|promo|\bterms\b|mobile|email|whatsapp|method:\s*method/);
  });

  it("keeps phone numbers on the server and masked, like the rest of the page", () => {
    const live = read("src/components/admin/unpaid/live.tsx");
    expect(live).not.toMatch(/contacts\.get|board\.contacts|type Contact\b/);
    expect(live).not.toContain("<Link");
    expect(read("src/lib/admin/unpaid-live.ts")).toContain('contact: !mobile && !email ? null : manage ? { mobile: mobile ? maskMobile(mobile) : null, email } : "hidden",');
    expect(read("src/app/api/admin/unpaid/live/route.ts")).toContain('adminUser("unpaid.view")');
  });

  it("cleans up live answers after a day and help chats after 90 days, and says so in the privacy policy", () => {
    const run = read("src/lib/lifecycle/run.ts");
    expect(run).toContain('db.from("wizard_live").delete().lt("updated_at", new Date(now.getTime() - day).toISOString());');
    expect(run).toContain('db.from("help_offers").delete().lt("created_at", new Date(now.getTime() - 90 * day).toISOString());');
    expect(read("src/lib/legal/en.ts")).toContain("our team sees you only as \\\"Guest\\\"");
    expect(read("src/lib/legal/en.ts")).toContain("help messages from that page are deleted after 90 days.");
    expect(read("src/lib/legal/bn.ts")).toContain("সাহায্যের মেসেজ ৯০ দিন পর মুছে যায়।");
  });
});
