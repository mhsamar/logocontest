"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { contactBlocked } from "@/lib/auth/contact-blocks";
import { emailRejection } from "@/lib/auth/email-check";
import { normalizeEmail } from "@/lib/auth/identity";
import { getCurrentUser } from "@/lib/auth/session";
import { toE164 } from "@/lib/phone";
import { isSupabaseConfigured } from "@/lib/env";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import { getService } from "@/lib/services/store";
import { createBriefUpload, deleteBriefFile, saveBriefUpload } from "./brief-files";
import { accountTaken, createClientAccount } from "./client-account";
import { awaitingApproval } from "@/lib/payments/manual";
import { gatewayMethod, isManual } from "@/lib/payments/manual-rules";
import { openMethod } from "@/lib/payments/methods";
import { openStripeCheckout } from "@/lib/payments/stripe-api";
import { applyContestPromo, lookupPromo, releasePromo, reservePromo, type Reserved } from "@/lib/promos/promos";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BUSINESS_TYPES,
  DELIVERABLES,
  LINK_KINDS,
  LOGO_STYLES,
  PACKAGES,
  REQUIREMENTS,
  UPGRADES,
  USED_ON,
  type Brief,
  type Order,
} from "./brief";
import { addonsFreeFor, feePercentFor, serviceFee as feeFor } from "./pricing";
import { getPricingConfig } from "./pricing-config";
import { contestRepository, contestService } from "./services";

export type WizardResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: { key: MessageKey; params?: MessageParams; field?: string } };

const err = (key: MessageKey, params?: MessageParams) => ({ ok: false as const, error: { key, params } });

// Shape checks for data coming from the browser. Content rules live in brief.ts.
const BriefShape = z.object({
  brandName: z.string().max(200),
  logoText: z.string().max(200),
  slogan: z.string().max(300),
  businessType: z.union([z.enum(BUSINESS_TYPES), z.literal("")]),
  businessDescription: z.string().max(1000),
  websiteUrl: z.string().max(500),
  noWebsite: z.boolean(),
  // Added 2026-10-15 (owner): "Other" business, links and competitors.
  businessTypeOther: z.string().max(200).default(""),
  links: z.array(z.object({ kind: z.enum(LINK_KINDS), url: z.string().max(500) })).max(10).default([]),
  noLinks: z.boolean().default(false),
  competitors: z.string().max(1000).default(""),
  noCompetitors: z.boolean().default(false),
  styles: z.array(z.enum(LOGO_STYLES)).max(LOGO_STYLES.length),
  sliders: z.object({ complexity: z.number(), era: z.number(), tone: z.number() }),
  colors: z.array(z.string().max(7)).max(5),
  letDesignersChoose: z.boolean(),
  usedOn: z.array(z.enum(USED_ON)).max(USED_ON.length),
  likes: z.string().max(2000),
  dislikes: z.string().max(2000),
  // Added 2026-10-08; older saved drafts may not have them yet.
  shortName: z.string().max(100).default(""),
  targetAudience: z.string().max(1000).default(""),
  deliverables: z.array(z.enum(DELIVERABLES)).max(DELIVERABLES.length).default([]),
  requirements: z.array(z.enum(REQUIREMENTS)).max(REQUIREMENTS.length).default([]),
  requirementsNote: z.string().max(1500).default(""),
  // Answers to the owner's own questions (Admin › Onboarding, owner 2026-10-14).
  extra: z.record(z.string().max(30), z.union([z.string().max(2000), z.array(z.string().max(100)).max(20)])).optional(),
});

const OrderShape = z.object({
  package: z.enum(PACKAGES),
  customPrize: z.number().int().nullable(),
  durationDays: z.number().int(),
  // Keys added 2026-10-08 default to off for orders saved before then.
  upgrades: z.object({
    promoted: z.boolean().default(false),
    blind: z.boolean().default(false),
    private: z.boolean().default(false),
    logo_scan: z.boolean().default(false),
    highlight: z.boolean().default(false),
    urgent: z.boolean().default(false),
    nda: z.boolean().default(false),
  } satisfies Record<(typeof UPGRADES)[number], z.ZodDefault<z.ZodBoolean>>),
});

function parse(brief: unknown, order: unknown): { brief: Brief; order: Order } | null {
  const b = BriefShape.safeParse(brief);
  const o = OrderShape.safeParse(order);
  return b.success && o.success ? { brief: b.data as Brief, order: o.data } : null;
}

/** A non-logo contest's service and answers (owner, 2026-10-13); null for logo contests. */
const ServiceShape = z.object({ slug: z.string().max(40), answers: z.record(z.string(), z.union([z.string().max(2000), z.array(z.string().max(100)).max(20)])) });
type ServiceArg = z.infer<typeof ServiceShape> | null | undefined;

/**
 * Owner, 2026-10-13: a design type that is off in Admin → Services can't be started, also not by calling this API
 * directly. Contests that are already running are never affected.
 */
async function serviceOff(slug: string | null | undefined) {
  const def = await getService(slug);
  return !def || !def.on ? err("services.types.offError") : null;
}

function parseService(raw: ServiceArg): { slug: string; answers: Record<string, string | string[]> } | null | "bad" {
  if (!raw) return null;
  const r = ServiceShape.safeParse(raw);
  return r.success ? r.data : "bad";
}

async function currentClient() {
  const user = await getCurrentUser();
  return user && user.role === "client" && user.status !== "banned" ? user : null;
}

const SAVE_ERRORS: Record<string, MessageKey> = {
  invalid_brief: "wizard.errors.incomplete",
  invalid_order: "wizard.errors.incomplete",
  not_found: "wizard.errors.notSaved",
  not_editable: "wizard.errors.notEditable",
};

/** Saves the wizard as a server draft for a signed-in client (after C-08, or "Save & exit"). */
export async function saveDraft(input: { brief: unknown; order: unknown; contestId: string | null; service?: ServiceArg; acceptedContentRules?: boolean }): Promise<WizardResult<{ contestId: string }>> {
  if (!isSupabaseConfigured()) return err("auth.errors.notConfigured");
  const user = await currentClient();
  if (!user) return err("wizard.errors.signInAgain");
  const data = parse(input.brief, input.order);
  const service = parseService(input.service);
  if (!data || service === "bad") return err("wizard.errors.incomplete");
  const off = await serviceOff(service?.slug);
  if (off) return off;
  // A new contest from a phone or email the team blocked (Unpaid contests › Close as fake, owner 2026-10-25).
  if (!input.contestId && (await contactBlocked({ mobile: user.mobile, email: user.email }))) return err("wizard.errors.blocked");

  const result = await contestService().saveDraft(user.id, data.brief, data.order, input.contestId, service);
  if (!result.ok) return err(SAVE_ERRORS[result.error]);
  if (input.acceptedContentRules) await rememberContentRules(result.contest.id, user.id);
  return { ok: true, contestId: result.contest.id };
}

/**
 * The client agreed to the content rules for this contest (owner, 2026-10-26): kept with the draft, so reopening it
 * (after inviting Pro designers, a cancelled card payment, from the dashboard, on any device) never asks again. The
 * first time is kept; Pay records it too. Never fails the save.
 */
async function rememberContentRules(contestId: string, clientId: string): Promise<void> {
  const { error } = await createAdminClient().from("contests").update({ content_rules_agreed_at: new Date().toISOString() }).eq("id", contestId).eq("client_id", clientId).is("content_rules_agreed_at", null);
  if (error) console.error("[wizard] content rules:", error.message);
}

/** C-09: checks the mobile number and email before asking for a password (no OTP). */
export async function checkAccountDetails(input: { mobile: string; email: string; country?: string }): Promise<WizardResult<{ mobile: string; email: string }>> {
  if (!isSupabaseConfigured()) return err("auth.errors.notConfigured");
  // Any country, Bangladesh by default (owner, 2026-10-14).
  const mobile = toE164(input.mobile, input.country);
  if (!mobile) return err(input.country && input.country !== "BD" ? "auth.errors.invalidPhoneIntl" : "auth.errors.invalidPhone");
  const email = normalizeEmail(input.email);
  if (!email) return err("wizard.errors.email");
  // Real emails only, no temporary inboxes (owner, 2026-10-14).
  const rejected = await emailRejection(email);
  if (rejected) return err(rejected.key, rejected.params);
  if (await contactBlocked({ mobile, email })) return err("wizard.errors.blocked");
  const taken = await accountTaken(mobile, email);
  if (taken) return err(taken === "mobile" ? "auth.errors.phoneTaken" : "wizard.errors.emailTaken");
  return { ok: true, mobile, email };
}

/**
 * C-10: creates the client account (mobile + email + password, no OTP),
 * signs in, and saves the wizard as a server draft.
 */
export async function createAccountAndDraft(input: {
  /** The client's real name (owner, 2026-10-15), checked against payments. Older callers leave it out. */
  name?: string;
  mobile: string;
  country?: string;
  /** "This number is on WhatsApp" (owner, 2026-10-14). */
  whatsapp?: boolean;
  email: string;
  password: string;
  brief: unknown;
  order: unknown;
  /** This browser's push subscription, if the user allowed notifications. */
  push?: unknown;
  /** A non-logo contest (owner, 2026-10-13). */
  service?: ServiceArg;
  /** The content rules were agreed in the wizard (owner, 2026-10-26): kept with the draft. */
  acceptedContentRules?: boolean;
}): Promise<WizardResult<{ contestId: string }>> {
  if (!isSupabaseConfigured()) return err("auth.errors.notConfigured");
  const data = parse(input.brief, input.order);
  const service = parseService(input.service);
  if (!data || service === "bad") return err("wizard.errors.incomplete");
  // Before the account is created, so a switched-off service doesn't leave an account without a draft.
  const off = await serviceOff(service?.slug);
  if (off) return off;

  const account = await createClientAccount(input, data.brief.brandName.trim().slice(0, 80) || "Client");
  if (!account.ok) return { ok: false, error: account.error };

  const saved = await contestService().saveDraft(account.userId, data.brief, data.order, null, service);
  if (!saved.ok) return err(SAVE_ERRORS[saved.error]);
  if (input.acceptedContentRules) await rememberContentRules(saved.contest.id, account.userId);
  return { ok: true, contestId: saved.contest.id };
}

/**
 * C-11: saves the client's name, records the payment and sends them to the gateway, or for manual bKash (owner,
 * 2026-10-14) to the contest's pay page. `method` is a method key from Admin › Payments › Methods; `promo` is an
 * optional client fee code.
 */
export async function startCheckout(input: {
  contestId: string;
  method: string;
  promo?: string | null;
  acceptedTerms: boolean;
  acceptedContentRules?: boolean;
}): Promise<WizardResult> {
  if (!isSupabaseConfigured()) return err("auth.errors.notConfigured");
  const user = await currentClient();
  if (!user) return err("wizard.errors.signInAgain");

  // The name on receipts is the profile name (owner, 2026-10-14: the review step no longer asks, so paying never
  // changes it; the client edits it in Profile).
  const name = user.name;
  if (!input.acceptedTerms) return err("wizard.errors.terms");
  // No nude or sexual contests (owner, 2026-10-12): agreed in the wizard's first popup, saved with the contest.
  if (!input.acceptedContentRules) return err("wizard.errors.contentRules");
  // Each method has its own switch (Admin › Payments › Methods). None open: the draft stays saved; payments open soon.
  const method = await openMethod(input.method);
  if (!method) return err("wizard.errors.paymentsClosed");
  if ((await awaitingApproval([input.contestId])).size > 0) return err("pay.page.errors.awaiting");

  // A design type switched off since the draft was saved can't be paid for.
  const contest = await contestRepository().findContest(input.contestId);
  if (contest && contest.clientId === user.id) {
    const off = await serviceOff(contest.service);
    if (off) return off;
  }

  // A client fee code (owner, 2026-10-14): reserved for this client now, used when the payment is approved.
  let promo: Reserved | null = null;
  if (input.promo && input.promo.trim()) {
    const res = await reservePromo(input.promo, user.id, ["client_fee"]);
    if (!res.ok) return err(res.error);
    promo = res.promo;
  }

  await createAdminClient().from("contests").update({ content_rules_agreed_at: new Date().toISOString() }).eq("id", input.contestId).eq("client_id", user.id);

  // Manual bKash and Stripe keep the method key as the payment's gateway (owner, 2026-10-14).
  const provider = isManual(method.key) || method.key === "stripe" ? method.key : null;
  const result = await contestService().startCheckout({
    clientId: user.id,
    contestId: input.contestId,
    method: isManual(method.key) ? "bkash" : gatewayMethod(method.key as "bkash_api" | "sslcommerz" | "stripe"),
    customer: { name, mobile: user.mobile },
    provider,
    adjust: (fresh) => applyContestPromo(fresh, promo),
  });
  if (!result.ok) {
    if (promo) await releasePromo(promo.redemptionId);
    return err(SAVE_ERRORS[result.error] ?? "wizard.errors.payment");
  }
  // Stripe (owner, 2026-10-14): card payment in US dollars on Stripe's page.
  if (method.key === "stripe") {
    const logoDraft = !contest || contest.service === "logo";
    const url = await openStripeCheckout({
      kind: "contest",
      paymentId: result.payment.id,
      bdt: result.payment.amount,
      name: `logocontest.bd · ${contest?.brief.brandName ?? "Contest"}`,
      email: user.email,
      cancelPath: `/start?draft=${input.contestId}&step=${logoDraft ? "8" : "pay"}`,
    });
    if (!url) return err("wizard.errors.payment");
    redirect(url);
  }
  redirect(result.redirectUrl);
}

/**
 * The wizard's "Apply" button: checks a client fee code and shows the new fee and total, without keeping it (the
 * code is only reserved when the client pays).
 */
export async function previewPromo(input: { contestId: string; code: string }): Promise<WizardResult<{ code: string; fee: number; normal: number; serviceFee: number; total: number; saves: number }>> {
  if (!isSupabaseConfigured()) return err("auth.errors.notConfigured");
  const user = await currentClient();
  if (!user) return err("pay.promo.signIn");
  const contest = await contestRepository().findContest(input.contestId);
  if (!contest || contest.clientId !== user.id) return err("wizard.errors.notSaved");
  const look = await lookupPromo(input.code, user.id, "client_fee");
  if (!look.ok) return err(look.error);
  // The normal fee from today's settings (the saved amounts may already have an earlier code in them).
  const a = contest.amounts;
  const cfg = await getPricingConfig();
  const normal = feePercentFor(a.prize, cfg);
  const full = feeFor(a.prize, normal);
  const fee = Math.min(full, feeFor(a.prize, look.value));
  if (fee >= full) return err("pay.promo.noBetter", { normal });
  // Add-ons are free from a prize (owner, 2026-10-22): a draft saved before that still has its old add-on amount.
  const upgrades = addonsFreeFor(a.prize, cfg) ? 0 : a.upgrades;
  return { ok: true, code: look.code, fee: look.value, normal, serviceFee: fee, total: a.prize + fee + upgrades, saves: full - fee };
}

// ---------------------------------------------------------------------------
// C-07 uploads: the browser uploads to a one-time signed URL, then we record it.
// ---------------------------------------------------------------------------

async function editableContest(contestId: string) {
  const user = await currentClient();
  if (!user) return null;
  const contest = await contestRepository().findContest(contestId);
  if (!contest || contest.clientId !== user.id) return null;
  return contest.status === "draft" || contest.status === "pending_payment" ? contest : null;
}

export async function prepareBriefUpload(input: {
  contestId: string;
  name: string;
  type: string;
  size: number;
}): Promise<WizardResult<{ path: string; token: string }>> {
  if (!(await editableContest(input.contestId))) return err("wizard.errors.notSaved");
  return createBriefUpload(input.contestId, input);
}

export async function recordBriefUpload(input: {
  contestId: string;
  path: string;
  name: string;
  type: string;
  size: number;
  isCurrentLogo: boolean;
}): Promise<WizardResult<{ id: string }>> {
  if (!(await editableContest(input.contestId))) return err("wizard.errors.notSaved");
  return saveBriefUpload(input.contestId, input);
}

export async function removeBriefFile(input: { contestId: string; fileId: string }): Promise<WizardResult> {
  if (!(await editableContest(input.contestId))) return err("wizard.errors.notSaved");
  await deleteBriefFile(input.contestId, input.fileId);
  return { ok: true };
}
