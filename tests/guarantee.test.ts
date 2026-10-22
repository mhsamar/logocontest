import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  claimErrorOf,
  cleanExclusions,
  cleanRefundRef,
  COUNTED_STATUSES,
  countedDesigners,
  guaranteeState,
  needsBkashNumber,
  refundAmountText,
  refundRoutes,
  refundsComplete,
  routeAmounts,
  refundTotals,
  suggestedRefundNumber,
  type CountEntry,
  type GuaranteeContest,
  type PaidLine,
} from "@/lib/guarantee/rules";

// Money-back guarantee (owner, 2026-10-21; BLUEPRINT §7.10; migration 0069).

const NOW = new Date("2026-11-10T12:00:00Z");
const DAY = 86_400_000;
const e = (designerId: string, status: string, more: Partial<CountEntry> = {}): CountEntry => ({ designerId, status, rejected: false, designerIsTest: false, ...more });

describe("who counts", () => {
  const counted = (list: CountEntry[], withHeld = false, testContest = false) => countedDesigners(list, { withHeld, testContest }).sort();

  it("counts different designers, not designs", () => {
    expect(counted([e("a", "active"), e("a", "active"), e("a", "rejected")])).toEqual(["a"]);
    expect(counted([e("a", "active"), e("b", "rejected"), e("c", "winner"), e("d", "forfeited")])).toEqual(["a", "b", "c", "d"]);
  });

  it("leaves out withdrawn and removed designs, but not one the client rejected before it was taken back", () => {
    expect(counted([e("a", "withdrawn"), e("b", "removed")])).toEqual([]);
    expect(counted([e("a", "withdrawn", { rejected: true })])).toEqual(["a"]);
  });

  it("counts held designs only when the team decides", () => {
    expect(counted([e("a", "held")])).toEqual([]);
    expect(counted([e("a", "held")], true)).toEqual(["a"]);
  });

  it("leaves out test designers only in a test client's contest", () => {
    expect(counted([e("a", "active", { designerIsTest: true })])).toEqual(["a"]);
    expect(counted([e("a", "active", { designerIsTest: true })], false, true)).toEqual([]);
  });
});

describe("when the client can claim", () => {
  const base: GuaranteeContest = { status: "judging", guaranteeDesigners: 3, judgingEndsAt: new Date(NOW.getTime() + DAY), completedAt: null, adminReview: false, hadHandover: false, contestPaid: true, hadPayout: false };
  const state = (c: Partial<GuaranteeContest>, designers = 2, claim: Parameters<typeof guaranteeState>[2] = null) => guaranteeState({ ...base, ...c }, designers, claim, NOW, 30);

  it("is available while judging, before the deadline, with fewer designers than promised", () => {
    expect(state({})).toEqual({ kind: "available", late: false, until: base.judgingEndsAt, designers: 2, min: 3 });
  });

  it("offers only a check of the count with enough designers", () => {
    expect(state({}, 3).kind).toBe("check");
  });

  it("is shown as a promise while the contest runs", () => {
    expect(state({ status: "open" })).toEqual({ kind: "covered", min: 3 });
  });

  it("is not there without the stamp, unpaid, after a pick or after the deadline", () => {
    expect(state({ guaranteeDesigners: null }).kind).toBe("none");
    expect(state({ contestPaid: false }).kind).toBe("none");
    expect(state({ hadHandover: true }).kind).toBe("none");
    expect(state({ judgingEndsAt: new Date(NOW.getTime() - 1) }).kind).toBe("none");
    expect(state({ status: "completed" }).kind).toBe("none");
  });

  it("allows a late claim after a no-result end where nobody got a share, for a limited time", () => {
    const late = { status: "no_result", adminReview: true, completedAt: new Date(NOW.getTime() - 5 * DAY) };
    expect(state(late)).toMatchObject({ kind: "available", late: true });
    expect(state({ ...late, hadPayout: true }).kind).toBe("none");
    expect(state({ ...late, adminReview: false }).kind).toBe("none");
    expect(state({ ...late, completedAt: new Date(NOW.getTime() - 31 * DAY) }).kind).toBe("none");
  });

  it("shows the claim once there is one", () => {
    expect(state({}, 2, "pending")).toEqual({ kind: "claimed", status: "pending" });
    expect(state({ status: "cancelled" }, 2, "refunded")).toEqual({ kind: "claimed", status: "refunded" });
  });
});

describe("paying the money back", () => {
  const line = (more: Partial<PaidLine>): PaidLine => ({ id: "p1", purpose: "contest", gateway: "bkash_personal", method: "bkash", currency: "BDT", amount: 3750, cents: null, txn: "ABC123XYZ9", intent: null, sender: "+8801711111111", qa: false, ...more });

  it("sends every manual bKash payment back in one transfer and each card payment on its own", () => {
    const routes = refundRoutes([line({}), line({ id: "p2", purpose: "extension", amount: 500, gateway: "bkash_merchant" }), line({ id: "p3", gateway: "stripe", method: "card", currency: "USD", cents: 3100, intent: "pi_123" })]);
    expect(routes.map((r) => [r.key, r.kind, r.taka, r.usdCents])).toEqual([
      ["bkash", "bkash", 4250, 0],
      ["p3", "stripe", 3750, 3100],
    ]);
    expect(routes[1].intent).toBe("pi_123");
  });

  it("sends nothing back for QA and test payments", () => {
    const routes = refundRoutes([line({ qa: true })]);
    expect(routes.map((r) => r.kind)).toEqual(["none"]);
    expect(needsBkashNumber([line({ qa: true })])).toBe(false);
    expect(refundsComplete(routes, {})).toBe(true);
  });

  it("adds up taka and only the dollars Stripe charged", () => {
    expect(refundTotals([line({}), line({ id: "p2", gateway: "stripe", currency: "USD", cents: 3100 })])).toEqual({ taka: 7500, usdCents: 3100, bkashTaka: 3750 });
  });

  it("needs a bKash number only for manual bKash money", () => {
    expect(needsBkashNumber([line({})])).toBe(true);
    expect(needsBkashNumber([line({ gateway: "stripe", currency: "USD", cents: 3100 })])).toBe(false);
    expect(needsBkashNumber([line({ gateway: "sslcommerz", method: "card" })])).toBe(false);
    expect(suggestedRefundNumber([line({})])).toBe("+8801711111111");
  });

  it("writes the amount the way it goes back: card refunds in dollars, the rest in taka", () => {
    const mixed = routeAmounts([line({ amount: 6250 }), line({ id: "p2", gateway: "stripe", currency: "USD", amount: 1000, cents: 820 })]);
    expect(refundAmountText(mixed, "en")).toBe("৳6,250 + $8.20");
    expect(refundAmountText(routeAmounts([line({ gateway: "stripe", currency: "USD", cents: 3100 })]), "en")).toBe("$31");
    expect(refundAmountText(routeAmounts([line({ qa: true })]), "en")).toBe("৳3,750");
    expect(refundAmountText([], "en", 4250)).toBe("৳4,250");
  });

  it("checks references by route", () => {
    expect(cleanRefundRef("bkash", " abc 123 xyz9 ")).toBe("ABC123XYZ9");
    expect(cleanRefundRef("bkash", "12")).toBeNull();
    expect(cleanRefundRef("stripe", "re_3PabcDEF123")).toBe("re_3PabcDEF123");
    expect(cleanRefundRef("stripe", "pi_3PabcDEF123")).toBeNull();
    expect(cleanRefundRef("none", "x")).toBeNull();
    expect(refundsComplete(refundRoutes([line({})]), {})).toBe(false);
    expect(refundsComplete(refundRoutes([line({})]), { bkash: "ABC123XYZ9" })).toBe(true);
  });
});

describe("the team's decision", () => {
  const A = "11111111-1111-4111-8111-111111111111";
  const B = "22222222-2222-4222-8222-222222222222";

  it("takes designers out of the count only with a reason, and only counted ones", () => {
    expect(cleanExclusions(undefined, [A])).toEqual([]);
    expect(cleanExclusions([{ designer_id: A, reason: "Same person as @x" }], [A, B])).toEqual([{ designer_id: A, reason: "Same person as @x" }]);
    expect(cleanExclusions([{ designer_id: A, reason: "no" }], [A])).toBeNull();
    expect(cleanExclusions([{ designer_id: B, reason: "Same person" }], [A])).toBeNull();
    expect(cleanExclusions([{ designer_id: A, reason: "Same person" }, { designer_id: A, reason: "Same person" }], [A])).toBeNull();
  });

  it("reads the database's errors", () => {
    expect(claimErrorOf("guarantee:enough")).toBe("enough");
    expect(claimErrorOf("duplicate key", "23505")).toBe("already");
    expect(claimErrorOf("something else")).toBeNull();
  });
});

describe("the database counts the same way (migration 0069)", () => {
  const sql = readFileSync("supabase/migrations/0069_money_back_guarantee.sql", "utf8");

  it("counts the same statuses, held only on request, and the rejected-then-withdrawn ones", () => {
    const fn = sql.slice(sql.indexOf("function public.guarantee_designer_ids"), sql.indexOf("function public.guarantee_paid"));
    const list = /e\.status in \(([^)]*)\)/.exec(fn)?.[1].split(",").map((s) => s.trim().replace(/'/g, ""));
    expect(list).toEqual([...COUNTED_STATUSES]);
    expect(fn).toContain("(p_with_held and e.status = 'held')");
    expect(fn).toContain("(e.status = 'withdrawn' and e.rejected_at is not null)");
    expect(fn).toContain("not (p.is_test and cl.is_test)");
  });

  it("freezes the contest while a claim waits, and only server code can call the functions", () => {
    expect(sql).toContain("raise exception 'guarantee:frozen'");
    for (const f of ["guarantee_designer_ids(uuid, boolean)", "guarantee_paid(uuid)", "open_guarantee_claim(uuid, uuid, text, text, boolean)", "decide_guarantee_claim(uuid, uuid, boolean, text, text, jsonb, int)"]) {
      expect(sql).toContain(`revoke all on function public.${f} from public, anon, authenticated;`);
    }
    expect(sql).toContain("alter table public.guarantee_claims enable row level security;");
    expect(sql).not.toContain("create policy");
  });

  it("raises only errors the site knows", () => {
    const raised = [...sql.matchAll(/'guarantee:([a-z_]+)'/g)].map((m) => m[1]);
    expect(raised.length).toBeGreaterThan(5);
    for (const code of raised) expect(claimErrorOf(`guarantee:${code}`)).toBe(code);
  });
});

describe("the landing pages follow the guarantee switch", async () => {
  const { fillFacts } = await import("@/lib/seo/fill-facts");
  const pages = [(await import("@/lib/landing/content/about")).content, (await import("@/lib/landing/content/logo-design")).content, (await import("@/lib/landing/content/logo-design-price")).content];
  const facts = { minPrize: 3000, minTotal: 3750, fee: 25, largeFee: 15, largeFrom: 30000, customStep: 500, defaultDays: 7, minDays: 3, maxDays: 30, judgingDays: 3, packages: [], guaranteeDesigners: 3 };
  /** Every text of a page in one language: sections (gated ones only when on) and the rest. */
  const texts = (copy: Record<string, unknown>, on: boolean): string[] => {
    const sections = (copy.sections as { onlyWithGuarantee?: boolean }[]).filter((s) => on || !s.onlyWithGuarantee);
    const walk = (v: unknown): string[] => (typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(walk) : v && typeof v === "object" ? Object.entries(v).filter(([k]) => k !== "onlyWithGuarantee").flatMap(([, x]) => walk(x)) : []);
    return [...walk({ ...copy, sections: undefined }), ...walk(sections)];
  };

  it("keeps {?g:…} only while on and {!g:…} only while off", () => {
    const f = (on: boolean) => fillFacts("Not refunded{?g:, except under our {guaranteeDesigners}-designer guarantee}{!g:, ever}.", { ...facts, guaranteeOn: on }, "en", 2026);
    expect(f(true)).toBe("Not refunded, except under our 3-designer guarantee.");
    expect(f(false)).toBe("Not refunded, ever.");
  });

  it("never mentions the guarantee while it is off, and leaves no markers either way", () => {
    for (const page of pages) {
      for (const lang of ["en", "bn"] as const) {
        const off = texts(page[lang], false).map((t) => fillFacts(t, { ...facts, guaranteeOn: false }, lang, 2026));
        const on = texts(page[lang], true).map((t) => fillFacts(t, { ...facts, guaranteeOn: true }, lang, 2026));
        for (const t of [...off, ...on]) expect(t).not.toMatch(/\{[?!]g:|\{\w+\}/);
        for (const t of off) expect(t).not.toMatch(/money-back|মানি-ব্যাক|your money back|পুরো টাকা ফেরত/i);
        // While it is on, no line says payments are never refunded without the exception.
        for (const t of on) expect(t).not.toMatch(/No refunds:|there are no refunds|\(no refunds\)|টাকা ফেরত নেই/);
      }
    }
  });
});
