"use server";

/**
 * Onboarding v2's server side (owner, 2026-10-28; client-onboarding-v2-spec.md): /start-v2 makes the account at step 1,
 * saves the contest after the logo name and business type (step 2) with the rest of the brief filled in from the
 * business type, keeps the prize, length and add-ons as the client picks them (step 3) and opens the bKash payment
 * (step 4). Prices are always worked out here from Admin › Pricing. Only the contest's owner changes it, only while it
 * is unpaid, and never once a bKash payment for it is waiting for approval.
 */
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { contactBlocked } from "@/lib/auth/contact-blocks";
import { normalizeEmail } from "@/lib/auth/identity";
import { clientIp } from "@/lib/auth/services";
import { getCurrentUser } from "@/lib/auth/session";
import { findProfileByEmail, signIn } from "@/lib/auth/sign-in";
import { BUSINESS_TYPES, emptyBrief, LIMITS, PACKAGES, UPGRADES, type Brief, type Order } from "@/lib/contests/brief";
import { createClientAccount } from "@/lib/contests/client-account";
import { calculatePrice, defaultOrder, feePercentFor, prizeFor, serviceFee, validateOrder } from "@/lib/contests/pricing";
import { getPricingConfig } from "@/lib/contests/pricing-config";
import { contestRepository, contestService } from "@/lib/contests/services";
import type { ContestRecord } from "@/lib/contests/service";
import { isSupabaseConfigured } from "@/lib/env";
import { translatorFor } from "@/lib/content/texts";
import { getI18n, getLocale } from "@/lib/i18n/server";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import { awaitingApproval } from "@/lib/payments/manual";
import { isManual } from "@/lib/payments/manual-rules";
import { isOpen, methodRows } from "@/lib/payments/methods";
import { noticeOn } from "@/lib/notifications/switches";
import { notifyUser, pushIsMine, savePushSubscription, viewingAs } from "@/lib/push";
import { applyContestPromo, lookupPromo, releasePromo, reservePromo, type Reserved } from "@/lib/promos/promos";
import { getService } from "@/lib/services/store";
import { LOGO } from "@/lib/services/types";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { saveWizardLead } from "@/lib/wizard-tracking";
import { applyDefaults, defaultsFor, newCompletion } from "./brief-defaults";

export type V2Result<T = object> = ({ ok: true } & T) | { ok: false; error: { key: MessageKey; params?: MessageParams; field?: string } };

const err = (key: MessageKey, params?: MessageParams) => ({ ok: false as const, error: { key, params } });

const SAVE_ERRORS: Record<string, MessageKey> = {
  invalid_brief: "wizard.errors.incomplete",
  invalid_order: "wizard.errors.incomplete",
  not_found: "wizard.errors.notSaved",
  not_editable: "wizard.errors.notEditable",
};

const OrderShape = z.object({
  package: z.enum(PACKAGES),
  customPrize: z.number().int().nullable(),
  durationDays: z.number().int(),
  upgrades: z.object(Object.fromEntries(UPGRADES.map((k) => [k, z.boolean().default(false)])) as Record<(typeof UPGRADES)[number], z.ZodDefault<z.ZodBoolean>>),
});

const UUID = /^[0-9a-f-]{36}$/i;

async function currentClient() {
  const user = await getCurrentUser();
  return user && user.role === "client" && user.status !== "banned" ? user : null;
}

/** A design type switched off in Admin → Services can't be started, also not through these actions. */
async function logoOff() {
  const logo = await getService(LOGO);
  return !logo || !logo.on;
}

/** The client's own v2 contest that can still change: made by v2, unpaid, and no bKash payment waiting. */
async function ownDraft(contestId: unknown, clientId: string): Promise<{ ok: true; contest: ContestRecord } | { ok: false; error: MessageKey }> {
  if (typeof contestId !== "string" || !UUID.test(contestId)) return { ok: false, error: "wizard.errors.notSaved" };
  const contest = await contestRepository().findContest(contestId);
  if (!contest || contest.clientId !== clientId || !contest.briefCompletion) return { ok: false, error: "wizard.errors.notSaved" };
  if (contest.status !== "draft" && contest.status !== "pending_payment") return { ok: false, error: "wizard.errors.notEditable" };
  if ((await awaitingApproval([contest.id])).size > 0) return { ok: false, error: "pay.page.errors.awaiting" };
  return { ok: true, contest };
}

/** How far the client got (2 = logo name, 3 = saw the prizes, 4 = payment step): it only ever goes up. */
async function raiseStep(contestId: string, step: number) {
  const { error } = await createAdminClient().from("contests").update({ last_step: step }).eq("id", contestId).or(`last_step.is.null,last_step.lt.${step}`);
  if (error) console.error("[onboarding-v2] step:", error.message);
}

/** The content rules and terms ticked on step 1 (or step 2 when signed in), kept with the contest the first time. */
async function rememberAgreement(contestId: string, clientId: string) {
  const { error } = await createAdminClient().from("contests").update({ content_rules_agreed_at: new Date().toISOString() }).eq("id", contestId).eq("client_id", clientId).is("content_rules_agreed_at", null);
  if (error) console.error("[onboarding-v2] agreement:", error.message);
}

/**
 * A changed order or logo name makes the payment opened on step 4 out of date: it is closed, so the client can't send
 * money for an amount that can no longer be approved (no payment is waiting here: ownDraft refuses that).
 */
async function closeOpenPayments(contestId: string) {
  const { error } = await createAdminClient().from("payments").update({ status: "failed" }).eq("contest_id", contestId).eq("purpose", "contest").eq("status", "initiated");
  if (error) console.error("[onboarding-v2] open payments:", error.message);
}

const sameOrder = (a: Order, b: Order) =>
  a.package === b.package &&
  (a.package === "custom" ? a.customPrize : null) === (b.package === "custom" ? b.customPrize : null) &&
  a.durationDays === b.durationDays &&
  UPGRADES.every((k) => Boolean(a.upgrades[k]) === Boolean(b.upgrades[k]));

/**
 * Step 1: a new client's account, signed in. An email that already has an account signs in with its password instead
 * (spec §2), and only a client account carries on.
 */
export async function v2Account(input: { name: string; mobile: string; country?: string; whatsapp?: boolean; email: string; password: string; agreed: boolean; visitId?: string; push?: unknown }): Promise<V2Result<{ created: boolean }>> {
  if (!isSupabaseConfigured()) return err("auth.errors.notConfigured");
  // The new client's number for the team even if signing up stops here (owner, 2026-10-14), also when it is refused.
  // Saved alongside the account instead of as its own request in front of it (owner, 2026-10-29: Next on step 1 was
  // slow); the reply doesn't wait for it, and the function stays alive until it is written.
  if (typeof input.visitId === "string") {
    const lead = { visitId: input.visitId, service: "logo", mobile: String(input.mobile ?? ""), country: input.country, name: input.name, email: input.email, whatsapp: input.whatsapp };
    after(saveWizardLead(lead).catch((e) => console.error("[wizard-lead]", e instanceof Error ? e.message : e)));
  }
  if (input.agreed !== true) return err("wizardV2.errors.agree");
  const email = normalizeEmail(String(input.email ?? ""));
  // Who has this email is looked up while the Logo switch is checked (one wait instead of two); read in the same order.
  const lookup = email ? findProfileByEmail(email).then((found) => ({ ok: true as const, found }), (e: unknown) => ({ ok: false as const, e })) : null;
  if (await logoOff()) return err("services.types.offError");
  if (!email || !lookup) return err("wizard.errors.email");
  const password = String(input.password ?? "");

  const looked = await lookup;
  if (!looked.ok) throw looked.e;
  const existing = looked.found;
  if (existing) {
    const failed = await signIn(email, email, password, await clientIp());
    if (failed?.error) return { ok: false, error: failed.error };
    // Only after the password was right, so it never tells strangers which accounts exist.
    if (existing.role !== "client") {
      // Only the login just made: the person's other devices stay signed in.
      await (await createClient()).auth.signOut({ scope: "local" });
      return err("wizard.errors.designerAccount");
    }
    return { ok: true, created: false };
  }

  const name = String(input.name ?? "");
  const account = await createClientAccount({ name, mobile: String(input.mobile ?? ""), country: input.country, whatsapp: input.whatsapp === true, email, password, push: input.push }, name);
  if (!account.ok) return { ok: false, error: account.error };
  return { ok: true, created: true };
}

/**
 * Step 1's notifications (owner, 2026-10-29): "Allow notifications?" no longer holds up the account, so the browser's
 * subscription comes here once the account is made. Only a new client's own browser (never taken from another account,
 * never while an admin looks through it), and the welcome push once, after the reply.
 */
export async function v2SavePush(input: { push: unknown }): Promise<void> {
  const user = await currentClient();
  const endpoint = (input.push as { endpoint?: unknown } | null)?.endpoint;
  if (!user || typeof endpoint !== "string" || (await viewingAs(user.id))) return;
  // Right after sign-up only, and only the account's first browser: one welcome push per account, never again later.
  const db = createAdminClient();
  const [{ data: me }, { count, error }] = await Promise.all([
    db.from("profiles").select("created_at").eq("id", user.id).maybeSingle(),
    db.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  if (!me || error || (count ?? 0) > 0 || Date.now() - new Date(me.created_at as string).getTime() > NEW_ACCOUNT_MS) return;
  if (!(await savePushSubscription(user.id, input.push, (await headers()).get("user-agent"), { takeOver: false })) || !(await pushIsMine(user.id, endpoint))) return;
  // The welcome push can be turned off in Admin › Notifications (the browser stays saved for later notices).
  if (!(await noticeOn("welcome", "push"))) return;
  const locale = await getLocale();
  after(async () => {
    const t = await translatorFor(locale);
    await notifyUser(user.id, { title: t("push.welcome.title"), body: t("push.welcome.body", { email: user.email ?? "" }), url: "/verify-email" }, endpoint);
  });
}

/** How long after sign-up step 1 may still save the browser's notifications. */
const NEW_ACCOUNT_MS = 15 * 60_000;

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * Step 2: saves the contest with its logo name and business type; the rest of the brief comes from the business type's
 * defaults (Admin › Onboarding), and the order starts as the recommended package and the usual length. Saving it again
 * with another business type brings that type's defaults, as long as the client hasn't changed the brief yet.
 */
export async function v2SaveBasics(input: { contestId: string | null; brandName: string; businessType: string; businessTypeOther?: string; agreed?: boolean }): Promise<V2Result<{ contestId: string; slug: string }>> {
  if (!isSupabaseConfigured()) return err("auth.errors.notConfigured");
  const user = await currentClient();
  if (!user) return err("wizard.errors.signInAgain");
  if (await logoOff()) return err("services.types.offError");
  const brandName = String(input.brandName ?? "").trim().replace(/\s+/g, " ");
  if (brandName.length < LIMITS.brandName.min || brandName.length > LIMITS.brandName.max) return err("wizard.errors.brandName");
  const type = BUSINESS_TYPES.find((b) => b === input.businessType);
  if (!type) return err("wizard.errors.businessType");
  const other = type === "other" ? String(input.businessTypeOther ?? "").trim().replace(/\s+/g, " ").slice(0, LIMITS.businessTypeOther.max) : "";

  const [{ t }, saved] = await Promise.all([getI18n(), getSetting("onboarding.brief_defaults")]);
  const audience = capitalize(t(`wizard.suggest.audiences.${type}` as MessageKey));
  const withDefaults = (b: Brief) => applyDefaults(b, defaultsFor(saved, type), audience);

  let result;
  if (input.contestId) {
    const own = await ownDraft(input.contestId, user.id);
    if (!own.ok) return err(own.error);
    const c = own.contest;
    // Nothing changed (Back, then Next): the contest, its payment and promo code stay as they are.
    if (c.brief.brandName === brandName && c.brief.businessType === type && (c.brief.businessTypeOther ?? "") === other) {
      if (input.agreed === true) await rememberAgreement(c.id, user.id);
      return { ok: true, contestId: c.id, slug: c.slug };
    }
    const base: Brief = { ...c.brief, brandName, businessType: type, businessTypeOther: other };
    const fresh = c.brief.businessType !== type && (c.briefCompletion?.edited.length ?? 0) === 0;
    result = await contestService().saveDraft(user.id, fresh ? withDefaults({ ...base, targetAudience: "" }) : base, c.order, c.id, null, {});
    if (result.ok) await closeOpenPayments(c.id);
  } else {
    // A new contest from a phone or email the team blocked (Unpaid contests › Close as fake).
    if (await contactBlocked({ mobile: user.mobile, email: user.email })) return err("wizard.errors.blocked");
    const brief = withDefaults({ ...emptyBrief(), brandName, businessType: type, businessTypeOther: other });
    result = await contestService().saveDraft(user.id, brief, defaultOrder(await getPricingConfig()), null, null, { completion: newCompletion() });
  }
  if (!result.ok) return err(SAVE_ERRORS[result.error]);
  if (input.agreed === true) await rememberAgreement(result.contest.id, user.id);
  return { ok: true, contestId: result.contest.id, slug: result.contest.slug };
}

/** Step 3 opened: when the client first saw the prizes (Admin › Unpaid contests shows it). */
export async function v2ViewPricing(input: { contestId: string }): Promise<void> {
  const user = await currentClient();
  if (!user) return;
  const own = await ownDraft(input.contestId, user.id);
  if (!own.ok) return;
  await createAdminClient().from("contests").update({ pricing_viewed_at: new Date().toISOString() }).eq("id", own.contest.id).is("pricing_viewed_at", null);
  await raiseStep(own.contest.id, 3);
}

/**
 * Step 3, as the client picks: the package, prize, length and add-ons are saved at once (spec: every step saves
 * itself), priced here. `picked`: the client chose a package card (the team sees "3-selected").
 */
export async function v2SaveOrder(input: { contestId: string; order: unknown; picked?: boolean }): Promise<V2Result> {
  if (!isSupabaseConfigured()) return err("auth.errors.notConfigured");
  const user = await currentClient();
  if (!user) return err("wizard.errors.signInAgain");
  const order = OrderShape.safeParse(input.order);
  if (!order.success) return err("wizard.errors.incomplete");
  const own = await ownDraft(input.contestId, user.id);
  if (!own.ok) return err(own.error);
  const c = own.contest;
  // Unchanged (Back from the payment step, then on again): nothing is saved, so its payment and promo code stay.
  if (!sameOrder(c.order, order.data)) {
    const result = await contestService().saveDraft(user.id, c.brief, order.data, c.id, null, {});
    if (!result.ok) return err(SAVE_ERRORS[result.error]);
    await closeOpenPayments(c.id);
  }
  if (input.picked === true) await createAdminClient().from("contests").update({ package_selected_at: new Date().toISOString() }).eq("id", c.id);
  await raiseStep(c.id, 3);
  return { ok: true };
}

export type V2Payment = {
  paymentId: string;
  amount: number;
  number: string;
  method: "bkash_personal" | "bkash_merchant";
  name: string | null;
  /** The promo code on this payment, if any. */
  promo: string | null;
  /** The order this payment is for, as saved (shown on the step, not the browser's copy). */
  package: Order["package"];
  days: number;
};

/** The promo already on this contest while it is still only reserved: its code and percent. */
async function promoOnContest(redemptionId: string | null): Promise<{ code: string; value: number } | null> {
  if (!redemptionId) return null;
  const db = createAdminClient();
  const { data: r } = await db.from("promo_redemptions").select("status, code_id").eq("id", redemptionId).maybeSingle();
  if (r?.status !== "reserved") return null;
  const { data: c } = await db.from("promo_codes").select("code, value").eq("id", r.code_id).maybeSingle();
  return c ? { code: c.code as string, value: c.value as number } : null;
}

/** Another unpaid contest of this client carries the same reservation (one reservation discounts one contest). */
async function carriedElsewhere(redemptionId: string, contestId: string): Promise<boolean> {
  const { count } = await createAdminClient().from("contests").select("id", { count: "exact", head: true }).eq("promo_redemption_id", redemptionId).neq("id", contestId).in("status", ["draft", "pending_payment"]);
  return (count ?? 0) > 0;
}

/**
 * Step 4: the bKash payment for the contest's current total. bKash only (spec §2 step 4): the Personal number ("Send
 * Money") first, else the Merchant one ("Payment"). Coming back with nothing changed reuses the open payment (and the
 * promo code on it); a new amount or a promo code typed now makes a new one and closes the older ones, so only the
 * amount shown can be paid.
 */
export async function v2OpenPayment(input: { contestId: string; promo?: string | null }): Promise<V2Result<V2Payment>> {
  if (!isSupabaseConfigured()) return err("auth.errors.notConfigured");
  const user = await currentClient();
  if (!user) return err("wizard.errors.signInAgain");
  if (await logoOff()) return err("services.types.offError");
  const own = await ownDraft(input.contestId, user.id);
  if (!own.ok) return err(own.error);
  const c = own.contest;

  const methods = (await methodRows()).filter((r) => isManual(r.key) && isOpen(r));
  const method = methods.find((r) => r.key === "bkash_personal") ?? methods[0];
  if (!method?.number || !isManual(method.key)) return err("wizard.errors.paymentsClosed");
  const db = createAdminClient();
  const { data: row } = await db.from("contests").select("content_rules_agreed_at, total_amount, status, promo_redemption_id").eq("id", c.id).maybeSingle();
  if (!row?.content_rules_agreed_at) return err("wizard.errors.contentRules");
  const onContest = (row.promo_redemption_id as string | null) ?? null;

  // The fee a code must beat: today's normal fee for the saved prize.
  const cfg = await getPricingConfig();
  const orderOk = !validateOrder(c.order, cfg);
  const prize = prizeFor(c.order, cfg);
  const normal = feePercentFor(prize, cfg);
  const lowers = (percent: number) => serviceFee(prize, percent) < serviceFee(prize, normal);

  const typed = typeof input.promo === "string" && input.promo.trim() ? input.promo.trim().slice(0, 40) : null;
  // No new code: the one already on this contest stays on (the same reservation comes back for this client), unless it
  // no longer lowers the fee (a bigger prize already has a lower fee) or another unpaid contest carries it too. Then it
  // is only taken off this contest, never used up.
  let kept = typed ? null : await promoOnContest(onContest);
  if (onContest && !typed && (!kept || !lowers(kept.value) || (await carriedElsewhere(onContest, c.id)))) {
    await db.from("contests").update({ promo_redemption_id: null }).eq("id", c.id);
    kept = null;
  }
  const code = typed ?? kept?.code ?? null;
  const pay = (paymentId: string, amount: number, promo: string | null = code): V2Payment => ({ paymentId, amount, number: method.number!, method: method.key as V2Payment["method"], name: method.name, promo, package: c.order.package, days: c.order.durationDays });

  // Back on this step (or a reload) with nothing changed: the same payment, as long as its amount is still today's price
  // (with the code kept on it, if any).
  if (row.status === "pending_payment" && !typed && orderOk) {
    const { data: open } = await db
      .from("payments")
      .select("id, amount")
      .eq("contest_id", c.id)
      .eq("purpose", "contest")
      .eq("status", "initiated")
      .eq("gateway", method.key)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (open && open.amount === row.total_amount && (kept || open.amount === calculatePrice(c.order, cfg).total)) {
      await raiseStep(c.id, 4);
      return { ok: true, ...pay(open.id as string, open.amount as number) };
    }
  }

  // A client fee code (owner, 2026-10-14): reserved for this client now, used when the payment is approved.
  let promo: Reserved | null = null;
  if (typed) {
    // Like the old wizard's Apply: a code that lowers nothing is refused, so it isn't used up for nothing.
    const look = await lookupPromo(typed, user.id, "client_fee");
    if (!look.ok) return err(look.error);
    if (!lowers(look.value)) return err("pay.promo.noBetter", { normal });
  }
  if (code) {
    const res = await reservePromo(code, user.id, ["client_fee"]);
    if (res.ok && typed && (await carriedElsewhere(res.promo.redemptionId, c.id))) return err("pay.promo.used");
    if (res.ok) promo = res.promo;
    // A typed code that can't be used is said so; a kept one that stopped working (switched off) just comes off, and
    // the payment is made at the full price instead of the step getting stuck.
    else if (typed) return err(res.error);
    else await db.from("contests").update({ promo_redemption_id: null }).eq("id", c.id);
  }
  const result = await contestService().startCheckout({
    clientId: user.id,
    contestId: c.id,
    method: "bkash",
    customer: { name: user.name, mobile: user.mobile },
    provider: method.key,
    adjust: (fresh) => applyContestPromo(fresh, promo),
  });
  if (!result.ok) {
    // Only a code reserved by this call is given back; the one the contest already carried stays reserved for it.
    if (promo && promo.redemptionId !== onContest) await releasePromo(promo.redemptionId);
    return err(SAVE_ERRORS[result.error] ?? "wizard.errors.payment");
  }
  const { error } = await db.from("payments").update({ status: "failed" }).eq("contest_id", c.id).eq("purpose", "contest").eq("status", "initiated").neq("id", result.payment.id);
  if (error) console.error("[onboarding-v2] old payments:", error.message);
  await raiseStep(c.id, 4);
  return { ok: true, ...pay(result.payment.id, result.payment.amount, promo?.code ?? null) };
}
