import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { emptyBrief, validateBrief, validateBriefV2, type Brief, type Order, noUpgrades } from "@/lib/contests/brief";
import type { PricingConfig } from "@/lib/contests/pricing";
import { ContestService, type ContestRecord, type ContestRepository, type DraftData, type PaymentRecord } from "@/lib/contests/service";
import { applyDefaults, defaultsFor, feelToSlider, newCompletion, parseCompletion, SEED } from "@/lib/onboarding/brief-defaults";
import { V2, v2CanGo, v2StartStep } from "@/lib/onboarding/v2-steps";
import { FakeGateway } from "@/lib/payments/fake-gateway";
import { adsAllowedOn } from "@/components/ads/ads-script";
import { inClientArea, menuKeyForPath } from "@/lib/client/rules";
import { popupAllowedOn } from "@/lib/visitor-popup/rules";
import { SETTINGS } from "@/lib/settings/registry";
import en from "@/lib/i18n/messages/en";
import bn from "@/lib/i18n/messages/bn";

// Owner, 2026-10-28 (client-onboarding-v2-spec.md): /start-v2 asks for the account, then the logo name and business
// type (the contest is saved there), the prize at step 3 and bKash at step 4; the brief comes after paying, filled in
// from the business type.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("brief defaults per business type", () => {
  it("the spec's feel values become the brief's 1–5 sliders", () => {
    expect([35, 40, 30, 45, 25, 20, 60, 55, 50].map(feelToSlider)).toEqual([2, 3, 2, 3, 2, 2, 3, 3, 3]);
    expect(SEED.food).toMatchObject({ styles: ["wordmark", "pictorial", "emblem"], sliders: { complexity: 2, era: 2, tone: 3 }, usedOn: ["social", "signboard", "packaging", "print"], deliverables: ["icon_only", "versions"] });
    expect(SEED.education.sliders).toEqual({ complexity: feelToSlider(40), era: feelToSlider(55), tone: feelToSlider(60) });
    expect(SEED.technology.sliders).toEqual({ complexity: feelToSlider(20), era: feelToSlider(20), tone: feelToSlider(60) });
  });

  it("a type without its own (valid) entry uses its seed, then \"other\"; one broken entry doesn't break the rest", () => {
    expect(defaultsFor(undefined, "food")).toEqual(SEED.food);
    expect(defaultsFor({}, "beauty")).toEqual(SEED.other);
    expect(defaultsFor({ food: { styles: ["nope"] } }, "food")).toEqual(SEED.food);
    const mine = { styles: ["mascot"], sliders: { complexity: 1, era: 5, tone: 1 }, usedOn: ["video"], deliverables: [], requirements: ["trust"] };
    expect(defaultsFor({ beauty: mine, food: "broken" }, "beauty")).toEqual(mine);
    expect(defaultsFor({ other: mine }, "travel")).toEqual(mine);
    // The setting accepts the seed itself.
    expect(SETTINGS["onboarding.brief_defaults"].schema.safeParse(SEED).success).toBe(true);
    expect(SETTINGS["onboarding.approval_minutes"].default).toBe(30);
  });

  it("the defaults fill the brief: designers choose the colours, no links or competitors yet, the type's customers", () => {
    const b = applyDefaults({ ...emptyBrief(), brandName: "Rahim Tea", businessType: "food", slogan: "Hot tea" }, SEED.food, "Families nearby");
    expect(b).toMatchObject({ brandName: "Rahim Tea", slogan: "Hot tea", businessDescription: "", letDesignersChoose: true, colors: [], noLinks: true, links: [], noCompetitors: true, targetAudience: "Families nearby" });
    expect(b.requirements).toEqual(["trust", "simple", "strong_idea", "readable_small", "one_colour", "no_stock"]);
    expect(applyDefaults({ ...emptyBrief(), targetAudience: "My own" }, SEED.food, "x").targetAudience).toBe("My own");
  });

  it("a v2 contest's mark is read back safely; old contests have none", () => {
    expect(parseCompletion(newCompletion())).toEqual({ v: 2, edited: [], acceptedAt: null });
    expect(parseCompletion({ v: 2, edited: ["look", "bad"], acceptedAt: "2026-10-28T10:00:00Z" })).toEqual({ v: 2, edited: ["look"], acceptedAt: "2026-10-28T10:00:00Z" });
    expect(parseCompletion(null)).toBeNull();
    expect(parseCompletion({ edited: [] })).toBeNull();
  });
});

describe("only the logo name and business type are required", () => {
  const basics: Brief = applyDefaults({ ...emptyBrief(), brandName: "Rahim Tea", businessType: "food" }, SEED.food, "");
  it("a v2 brief needs no description, audience, styles or colours; what is given keeps its limits", () => {
    expect(validateBriefV2(basics)).toEqual({});
    expect(Object.keys(validateBrief(basics))).toContain("businessDescription");
    expect(validateBriefV2({ ...basics, businessDescription: "too short" })).toHaveProperty("businessDescription");
    expect(validateBriefV2({ ...basics, brandName: "R" })).toHaveProperty("brandName");
    expect(validateBriefV2({ ...basics, businessType: "" })).toHaveProperty("businessType");
    expect(validateBriefV2({ ...basics, businessType: "other" })).toEqual({});
    expect(validateBriefV2({ ...basics, styles: [], letDesignersChoose: false, colors: [] })).toEqual({});
  });

  it("the service saves a v2 draft with its mark and lets it be paid; the old wizard's check is unchanged", async () => {
    const repo = new MemoryRepo();
    const svc = new ContestService({ repo, gateway: new FakeGateway("t"), pricing: async () => cfg, slug: () => "rahim-tea-abc123" });
    expect((await svc.saveDraft("c1", basics, order)).ok).toBe(false);
    const saved = await svc.saveDraft("c1", basics, order, null, null, { completion: newCompletion() });
    expect(saved.ok && saved.contest.briefCompletion).toEqual(newCompletion());
    if (!saved.ok) return;
    // Saving it again (the prize step) keeps the lighter check; checkout too, read from the contest itself.
    expect((await svc.saveDraft("c1", basics, { ...order, durationDays: 10 }, saved.contest.id, null, {})).ok).toBe(true);
    const paid = await svc.startCheckout({ clientId: "c1", contestId: saved.contest.id, method: "bkash", customer: { name: "Rahim", mobile: "+8801712345678" }, provider: "bkash_personal" });
    expect(paid.ok && paid.redirectUrl).toBe(`/pay/contest/${paid.ok ? paid.payment.id : ""}`);
    expect(paid.ok && paid.payment.amount).toBe(6000);
  });
});

describe("steps", () => {
  it("opens at the right step: visitor 1, signed in 2, a saved contest at the prize or payment, a sent payment at thanks", () => {
    expect(v2StartStep({ signedIn: false, contest: null })).toBe(V2.account);
    expect(v2StartStep({ signedIn: true, contest: null })).toBe(V2.basics);
    expect(v2StartStep({ signedIn: true, contest: { lastStep: 2, waiting: false } })).toBe(V2.prize);
    expect(v2StartStep({ signedIn: true, contest: { lastStep: 3, waiting: false } })).toBe(V2.prize);
    expect(v2StartStep({ signedIn: true, contest: { lastStep: 4, waiting: false } })).toBe(V2.pay);
    expect(v2StartStep({ signedIn: true, contest: { lastStep: 4, waiting: true } })).toBe(V2.done);
  });

  it("Back never reaches a step that isn't ready, and never leaves the thanks once the payment was sent", () => {
    expect(v2CanGo(V2.prize, { signedIn: true, contestId: null, sent: false })).toBe(false);
    expect(v2CanGo(V2.account, { signedIn: true, contestId: "x", sent: false })).toBe(false);
    expect(v2CanGo(V2.pay, { signedIn: true, contestId: "x", sent: true })).toBe(false);
    expect(v2CanGo(V2.done, { signedIn: true, contestId: "x", sent: true })).toBe(true);
  });
});

describe("the page and the rest of the site", () => {
  it("is off unless ONBOARDING_V2=true, logo only, and the old /start sends v2 drafts there", () => {
    const page = read("src/app/start-v2/page.tsx");
    expect(page).toContain("if (!onboardingV2On()) notFound();");
    expect(page).toContain("const blocked = await cannotStart(user);");
    expect(read("src/lib/onboarding/v2-steps.ts")).toContain('process.env.ONBOARDING_V2 === "true"');
    expect(read("src/app/start/page.tsx")).toContain("if (draft?.briefCompletion && onboardingV2On()) redirect(`/start-v2?draft=${draft.id}`);");
  });

  it("no pop-up, ads, support button or email bar inside it; it sits in the client workspace for clients", () => {
    expect(popupAllowedOn("/start-v2")).toBe(false);
    expect(adsAllowedOn("/start-v2")).toBe(false);
    expect(inClientArea("/start-v2")).toBe(true);
    expect(menuKeyForPath("/start-v2")).toBe("start");
    expect(read("src/components/support/support-widget.tsx")).toContain('path.startsWith("/start-v2")');
    expect(read("src/components/auth/email-banner.tsx")).toContain('path.startsWith("/start-v2")');
  });

  it("bKash only, one open payment per amount, and nothing changes once a payment waits for approval", () => {
    const a = read("src/lib/onboarding/v2-actions.ts");
    expect(a).toContain('methods.find((r) => r.key === "bkash_personal") ?? methods[0]');
    expect(a).toContain('if ((await awaitingApproval([contest.id])).size > 0) return { ok: false, error: "pay.page.errors.awaiting" };');
    expect(a).toContain('.eq("status", "initiated").neq("id", result.payment.id)');
    expect(a).toContain('if (!row?.content_rules_agreed_at) return err("wizard.errors.contentRules");');
  });

  it("a changed order or logo name closes the open payment; an unchanged one keeps it and its promo code", () => {
    const a = read("src/lib/onboarding/v2-actions.ts");
    expect(a).toContain("if (!sameOrder(c.order, order.data)) {");
    expect(a.match(/await closeOpenPayments\(c\.id\);/g)?.length).toBe(2);
    // The code already on the contest stays on, unless it no longer lowers the fee or another unpaid contest carries it.
    expect(a).toContain("let kept = typed ? null : await promoOnContest(onContest);");
    expect(a).toContain("(!kept || !lowers(kept.value) || (await carriedElsewhere(onContest, c.id)))");
    // An open payment is reused only at today's price (or with its kept code), and a failed checkout never gives back the kept code.
    expect(a).toContain("(kept || open.amount === calculatePrice(c.order, cfg).total)");
    expect(a).toContain("if (promo && promo.redemptionId !== onContest) await releasePromo(promo.redemptionId);");
    // A code that lowers nothing is refused (not used up), and one reservation discounts one contest.
    expect(a).toContain('return err("pay.promo.noBetter", { normal });');
    expect(a).toContain('if (res.ok && typed && (await carriedElsewhere(res.promo.redemptionId, c.id))) return err("pay.promo.used");');
    expect(a).toContain('else await db.from("contests").update({ promo_redemption_id: null }).eq("id", c.id);');
  });

  it("a contest's payment can't take a bKash ID once the contest was deleted or cancelled", () => {
    expect(read("src/lib/payments/manual.ts")).toContain('p.status === "initiated" && (kind !== "contest" || c?.status === "draft" || c?.status === "pending_payment") ? "open" : "closed"');
  });

  it("the wizard never goes on with an unsaved order, never skips a Next with Forward, and reloads after sign-up", () => {
    const prize = read("src/components/wizard-v2/step-prize.tsx");
    expect(prize).toContain("if (!ok && !pending.current) pending.current = next;");
    expect(prize).toContain("if (failed.current && !pending.current) pending.current = { order, picked: false };");
    const w = read("src/components/wizard-v2/wizard-v2.tsx");
    expect(w).toContain("if (to && to <= step && can(to)) setStep(to);");
    expect(w).toContain('if (window.location.pathname !== "/start-v2") return;');
    expect(w).toContain('window.location.replace("/start-v2");');
  });

  it("an email is looked up exactly: % and _ are never wildcards", () => {
    expect(read("src/lib/auth/sign-in.ts")).toContain('query.ilike("email", email.replace(/[\\\\%_]/g, (c) => `\\\\${c}`))');
  });

  it("Meta gets ViewContent, InitiateCheckout with the total and AddPaymentInfo; Purchase stays on approval; all go to dataLayer", () => {
    expect(read("src/components/wizard-v2/step-prize.tsx")).toContain('trackPixel(`view:${contestId}`, "ViewContent")');
    expect(read("src/components/wizard-v2/step-prize.tsx")).toContain('"InitiateCheckout", { value: price.total, currency: "BDT" }');
    expect(read("src/components/wizard-v2/step-pay.tsx")).toContain('"AddPaymentInfo", { value: payment.amount, currency: "BDT" }');
    expect(read("src/components/wizard-v2/step-account.tsx")).toContain('if (res.created) trackPixel(`register:v2:${pixelStartId()}`, "CompleteRegistration");');
    expect(read("src/lib/analytics/meta-pixel.ts")).toContain("pushDataLayer(key, event, params);");
  });

  it("migration 0079 relaxes only the description and keeps v2 visits apart; its rollback can always run", () => {
    const sql = read("supabase/migrations/0079_onboarding_v2.sql");
    expect(sql).toContain("check (char_length(business_description) <= 300)");
    expect(sql).toContain("add column if not exists brief_completion jsonb");
    expect(sql).toContain("revoke all on function public.record_wizard_step(uuid, int, uuid, text) from public, anon, authenticated;");
    // The old 20–300 rule only comes back when no contest breaks it (else approving those payments would fail).
    const down = read("supabase/rollback/0079_onboarding_v2_down.sql");
    expect(down).toContain("if exists (select 1 from public.contests where char_length(business_description) < 20) then");
    expect(down).not.toContain("not valid");
  });

  it("every v2 text has its Bangla", () => {
    const keys = (o: object, p = ""): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [p + k] : keys(v, `${p}${k}.`)));
    expect(keys(bn.wizardV2)).toEqual(keys(en.wizardV2));
    expect(keys(bn.wizardV2).filter((k) => k !== "account.agreeEnd" && !String(k.split(".").reduce<unknown>((o, s) => (o as Record<string, unknown>)[s], bn.wizardV2)).trim())).toEqual([]);
  });
});

const cfg: PricingConfig = {
  serviceFeePercent: 20,
  largeFeePercent: 15,
  largeFeeFrom: 30000,
  packagePrizes: { economy: 3000, standard: 5000, pro: 8000, premium: 12000, elite: 15000 },
  customMin: 3000,
  customStep: 500,
  upgradePrices: { promoted: 1000, blind: 1000, private: 1000, logo_scan: 500, highlight: 500, urgent: 500, nda: 1500 },
  durationOptions: [3, 5, 7, 10, 14, 21, 30],
  durationMin: 3,
  durationMax: 30,
  defaultDuration: 7,
};
const order: Order = { package: "standard", customPrize: null, durationDays: 7, upgrades: noUpgrades() };

class MemoryRepo implements ContestRepository {
  contests = new Map<string, ContestRecord>();
  payments = new Map<string, PaymentRecord>();
  private seq = 0;
  private id() {
    return `00000000-0000-4000-8000-${String(++this.seq).padStart(12, "0")}`;
  }
  async findContest(id: string) {
    return structuredClone(this.contests.get(id) ?? null);
  }
  async insertDraft(clientId: string, slug: string, d: DraftData) {
    const c: ContestRecord = { id: this.id(), clientId, slug, status: "draft", ...d, service: d.service ?? "logo", serviceBrief: d.serviceBrief ?? {}, startsAt: null, endsAt: null, createdAt: new Date() };
    this.contests.set(c.id, c);
    return structuredClone(c);
  }
  async updateDraft(id: string, d: DraftData) {
    const c = this.contests.get(id)!;
    Object.assign(c, d, { status: "draft" });
    return structuredClone(c);
  }
  async setPendingPayment(id: string) {
    const c = this.contests.get(id)!;
    if (c.status === "draft") c.status = "pending_payment";
  }
  async listByClient(clientId: string) {
    return [...this.contests.values()].filter((c) => c.clientId === clientId);
  }
  async createPayment(p: Parameters<ContestRepository["createPayment"]>[0]) {
    const pay: PaymentRecord = { ...p, id: this.id(), status: "initiated", gatewayTxnId: null, paidAt: null };
    this.payments.set(pay.id, pay);
    return structuredClone(pay);
  }
  async findPayment(id: string) {
    return structuredClone(this.payments.get(id) ?? null);
  }
  async confirmPayment(): Promise<ContestRecord> {
    throw new Error("not used");
  }
  async failPayment() {}
}
