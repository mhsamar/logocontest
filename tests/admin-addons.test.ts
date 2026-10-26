import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Owner, 2026-10-26: the Super admin adds an add-on to any client's live contest, free; and the content-rules
// agreement is asked once per contest.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]> }));
const who = vi.hoisted(() => ({ superAdmin: null as null | Row }));
const sent = vi.hoisted(() => ({ audits: [] as unknown[][], pushes: [] as unknown[][], rpcs: [] as unknown[][], expired: [] as string[], stripeCloses: true }));

function table(name: string) {
  const rows = () => (db.tables[name] ??= []);
  const filters: ((r: Row) => boolean)[] = [];
  let op: { kind: "select" } | { kind: "update"; patch: Row } | { kind: "insert"; rows: Row[] } = { kind: "select" };
  let single = false;
  let head = false;
  const q = {
    select: (_c?: string, o?: { head?: boolean }) => ((head = Boolean(o?.head)), q),
    update: (p: Row) => ((op = { kind: "update", patch: p }), q),
    insert: (r: Row | Row[]) => ((op = { kind: "insert", rows: Array.isArray(r) ? r : [r] }), q),
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
    in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), q),
    is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
    order: () => q,
    maybeSingle: () => ((single = true), q),
    then: (ok: (v: unknown) => unknown) => {
      if (op.kind === "insert") {
        rows().push(...op.rows);
        return Promise.resolve({ data: null, error: null }).then(ok);
      }
      const hit = rows().filter((r) => filters.every((f) => f(r)));
      if (op.kind === "update") for (const r of hit) Object.assign(r, op.patch);
      const data = hit.map((r) => ({ ...r }));
      return Promise.resolve({ data: head ? null : single ? (data[0] ?? null) : data, count: hit.length, error: null }).then(ok);
    },
  };
  return q;
}

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: vi.fn(), unstable_cache: (fn: unknown) => fn, revalidateTag: vi.fn() }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (n: string) => table(n),
    rpc: async (name: string, args: Row) => {
      sent.rpcs.push([name, args]);
      if (name === "fail_addon_payment") for (const p of db.tables.payments ?? []) if (p.id === args.p_payment_id && p.status === "initiated") p.status = "failed";
      return { error: null };
    },
  }),
}));
vi.mock("@/lib/admin/core", () => ({
  UUID: /^[0-9a-f-]{36}$/i,
  adminUser: async () => who.superAdmin,
  superAdmin: async () => who.superAdmin,
  audit: async (...a: unknown[]) => void sent.audits.push(a),
  cleanReason: (v: unknown) => (typeof v === "string" && v.trim().length >= 3 ? v.trim() : null),
}));
vi.mock("@/lib/notifications/broadcast", () => ({ notifyWithPush: async (...a: unknown[]) => void sent.pushes.push(a) }));
vi.mock("@/lib/notifications", () => ({ notify: vi.fn(), contestDesignerIds: async () => [] }));
vi.mock("@/lib/settings", async () => {
  const { SETTINGS } = await import("@/lib/settings/registry");
  return { getSettings: async (keys: string[]) => Object.fromEntries(keys.map((k) => [k, SETTINGS[k as keyof typeof SETTINGS].default])) };
});
vi.mock("@/lib/payments", () => ({ getPaymentGateway: vi.fn() }));
vi.mock("@/lib/payments/stripe-api", () => ({ openStripeCheckout: vi.fn(), expireSession: async (id: string) => (sent.expired.push(id), sent.stripeCloses) }));

const C = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";
const contest = (more: Row = {}) => ({ id: C, slug: "purple-holdings", brand_name: "Purple Holdings LTD", client_id: "u1", status: "open", prize_amount: 5000, is_promoted: false, is_private: false, is_blind: false, logo_scan: false, ...more });

beforeEach(() => {
  db.tables = { contests: [contest()] };
  who.superAdmin = { id: "sa", isSuperAdmin: true };
  sent.audits = [];
  sent.pushes = [];
  sent.rpcs = [];
  sent.expired = [];
  sent.stripeCloses = true;
});

describe("Super admin: add an add-on for free", () => {
  it("only the Super admin, with a reason, and only Featured, Private or Blind", async () => {
    const { grantAddon } = await import("@/lib/admin/contest-actions");
    who.superAdmin = null;
    expect(await grantAddon(C, { addon: "promote", reason: "Paid in cash" })).toEqual({ ok: false, error: "auth.errors.generic" });
    who.superAdmin = { id: "sa", isSuperAdmin: true };
    expect(await grantAddon(C, { addon: "promote", reason: "" })).toEqual({ ok: false, error: "admin.errors.reason" });
    expect(await grantAddon(C, { addon: "logo_scan", reason: "Paid in cash" })).toEqual({ ok: false, error: "admin.errors.generic" });
    expect(db.tables.contests[0]).toMatchObject({ is_promoted: false, logo_scan: false });
  });

  it("switches it on, logs it, tells the client, and records no payment", async () => {
    const { grantAddon } = await import("@/lib/admin/contest-actions");
    expect(await grantAddon(C, { addon: "promote", reason: "Gift for a regular client" })).toEqual({ ok: true });
    expect(db.tables.contests[0].is_promoted).toBe(true);
    expect(sent.audits).toEqual([["sa", "grant_addon", "contest", C, { addon: "promote", reason: "Gift for a regular client" }]]);
    expect(sent.pushes).toEqual([[["u1"], "addon_granted", { brand: "Purple Holdings LTD", addon: "promote" }, "/client/contests/purple-holdings?tab=payment#addons", "sa"]]);
    expect(db.tables.payments ?? []).toHaveLength(0);
    // Twice: already on.
    expect(await grantAddon(C, { addon: "promote", reason: "Again" })).toEqual({ ok: false, error: "manage.addons.alreadyActive" });
  });

  it("not after the contest closed, nor while a bKash payment for it waits for approval", async () => {
    const { grantAddon } = await import("@/lib/admin/contest-actions");
    db.tables.contests = [contest({ status: "judging" })];
    expect(await grantAddon(C, { addon: "private", reason: "Gift" })).toEqual({ ok: false, error: "manage.addons.closed" });
    db.tables.contests = [contest()];
    db.tables.payments = [{ id: "p1", contest_id: C, addon: "blind", status: "initiated" }];
    db.tables.manual_payments = [{ payment_id: "p1", status: "pending" }];
    expect(await grantAddon(C, { addon: "blind", reason: "Gift" })).toEqual({ ok: false, error: "admin.contests.addonWaiting" });
    expect(db.tables.contests[0].is_blind).toBe(false);
  });

  it("closes the client's open checkouts for that add-on first, so they can't pay for one given free", async () => {
    const { grantAddon } = await import("@/lib/admin/contest-actions");
    db.tables.payments = [
      { id: "card", contest_id: C, addon: "promote", status: "initiated", gateway: "stripe", provider_ref: "cs_test_123" },
      { id: "bk", contest_id: C, addon: "promote", status: "initiated", gateway: "bkash_personal", provider_ref: null },
    ];
    expect(await grantAddon(C, { addon: "promote", reason: "Gift" })).toEqual({ ok: true });
    expect(sent.expired).toEqual(["cs_test_123"]);
    expect(db.tables.payments.map((p) => p.status)).toEqual(["failed", "failed"]);
    expect(db.tables.contests[0].is_promoted).toBe(true);
  });

  it("waits when an open card page can't be closed (paid already, or Stripe can't be reached)", async () => {
    const { grantAddon } = await import("@/lib/admin/contest-actions");
    sent.stripeCloses = false;
    db.tables.payments = [{ id: "card", contest_id: C, addon: "private", status: "initiated", gateway: "stripe", provider_ref: "cs_test_456" }];
    expect(await grantAddon(C, { addon: "private", reason: "Gift" })).toEqual({ ok: false, error: "admin.contests.addonWaiting" });
    expect(db.tables.contests[0].is_private).toBe(false);
    expect(db.tables.payments[0].status).toBe("initiated");
  });

  it("a client's own free add-on still works as before (same safe switch)", async () => {
    const { activateFreeAddon } = await import("@/lib/contests/addon-payments");
    const client = { id: "u1" } as never;
    // A ৳5,000 prize with ৳1,000 add-ons: not free for the client (they pay).
    expect(await activateFreeAddon(client, C, "promote")).toEqual({ ok: false, error: "not_free" });
    expect(await activateFreeAddon({ id: "someone-else" } as never, C, "promote")).toEqual({ ok: false, error: "not_found" });
    // A ৳30,000 prize: every add-on free, switched on at once.
    db.tables.contests = [contest({ prize_amount: 30000 })];
    expect(await activateFreeAddon(client, C, "promote")).toEqual({ ok: true, slug: "purple-holdings" });
    expect(db.tables.contests[0].is_promoted).toBe(true);
  });

  it("is offered on the admin contest page and on the client's page, to the Super admin only", () => {
    const admin = read("src/app/admin/contests/[slug]/page.tsx");
    expect(admin).toContain("{me.isSuperAdmin && c.status === \"open\" && ");
    expect(admin).toContain("run={grantAddon.bind(null, c.id)}");
    const view = read("src/app/dashboard/contests/[slug]/page.tsx");
    expect(view).toContain("open={(!adminView || user.isSuperAdmin) && contest.status === \"open\"}");
    expect(view).toContain("grant={adminView && user.isSuperAdmin}");
    const panel = read("src/components/manage/addons-panel.tsx");
    expect(panel).toContain('buying === "extend" ? await extendContest(contestId, { days: String(days), reason }) : await grantAddon(contestId, { addon: buying, reason })');
    // In grant mode there is no payment method and no payment.
    expect(panel).toContain("{buying && !isFree(buying) && !grant && (");
  });
});

describe("the content-rules agreement is asked once per contest", () => {
  it("is kept with the draft when it is saved, and only the first time", () => {
    const actions = read("src/lib/contests/actions.ts");
    expect(actions).toContain('.eq("client_id", clientId).is("content_rules_agreed_at", null);');
    expect(actions.match(/await rememberContentRules\(/g)).toHaveLength(2);
    const wizard = read("src/components/wizard/wizard.tsx");
    expect(wizard.match(/acceptedContentRules: s\.contentOk === true/g)).toHaveLength(2);
    expect(wizard).toContain("acceptedContentRules: state.contentOk === true,");
  });

  it("a reopened draft (after inviting designers, a cancelled card payment, Finish on the dashboard) doesn't ask again", () => {
    const wizard = read("src/components/wizard/wizard.tsx");
    expect(wizard).toContain("const agreed = props.resume.contentOk === true || (saved?.contestId === props.resume.contestId && saved.contentOk === true);");
    expect(read("src/app/start/start-flow.tsx")).toContain("contentOk: Boolean(agreed?.content_rules_agreed_at),");
    expect(read("src/components/services/service-wizard.tsx")).toContain("useState(resume?.contentOk === true)");
  });

  it("a reload or Back after the contest is saved reopens that contest, not a new blank one", () => {
    const wizard = read("src/components/wizard/wizard.tsx");
    expect(wizard).toContain("...(draftRef.current ? { draft: draftRef.current } : {}), step: String(to)");
    expect(wizard).toContain('if (push) window.history.pushState({ step: to }, "", stepUrl(to));');
    // A fresh history state, so Next's router keeps the address (it puts back its own otherwise).
    expect(wizard).toContain('window.history.replaceState({ step }, "", stepUrl(step));');
    expect(wizard.match(/draftRef\.current = (contestId|res\.contestId);/g)?.length).toBeGreaterThanOrEqual(3);
    // Back still finds the step when Next rewrote that entry's state.
    expect(wizard).toContain('?? Number(new URLSearchParams(window.location.search).get("step"));');
    const service = read("src/components/services/service-wizard.tsx");
    expect(service).toContain('const at = step === "pay" ? "pay" : "edit";');
    expect(service).toContain('window.history.replaceState(null, "", `?${q}`);');
    // Only the client's own draft is reopened; any other draft link starts that design type as before.
    expect(read("src/app/start/[service]/page.tsx")).toContain('if (typeof query.draft === "string" && (await serviceDraftOf(user, query.draft))) {');
    expect(read("src/app/start/page.tsx")).toContain('(typeof params.step === "string" && /^\\d+$/.test(params.step))');
  });
});
