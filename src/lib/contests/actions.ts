"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sendVerificationEmail } from "@/lib/auth/email-service";
import { normalizeEmail } from "@/lib/auth/identity";
import { getCurrentUser } from "@/lib/auth/session";
import { clientIp } from "@/lib/auth/services";
import { findProfileByEmail, findProfileByPhone, passwordError, signIn } from "@/lib/auth/sign-in";
import { normalizeBdMobile } from "@/lib/phone";
import { notifyUser, savePushSubscription } from "@/lib/push";
import { isSupabaseConfigured } from "@/lib/env";
import { MESSAGES } from "@/lib/i18n/messages";
import { getI18n } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/translate";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import { getSettings } from "@/lib/settings";
import { BRIEF_FILES_BUCKET, BRIEF_FILE_TYPES, getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUSINESS_TYPES, LOGO_STYLES, PACKAGES, USED_ON, type Brief, type Order } from "./brief";
import { contestRepository, contestService } from "./services";
import { makeSlug } from "./service";

export type WizardResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: { key: MessageKey; params?: MessageParams } };

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
  styles: z.array(z.enum(LOGO_STYLES)).max(LOGO_STYLES.length),
  sliders: z.object({ complexity: z.number(), era: z.number(), tone: z.number() }),
  colors: z.array(z.string().max(7)).max(5),
  letDesignersChoose: z.boolean(),
  usedOn: z.array(z.enum(USED_ON)).max(USED_ON.length),
  likes: z.string().max(2000),
  dislikes: z.string().max(2000),
});

const OrderShape = z.object({
  package: z.enum(PACKAGES),
  customPrize: z.number().int().nullable(),
  durationDays: z.number().int(),
  upgrades: z.object({ blind: z.boolean(), private: z.boolean(), promoted: z.boolean() }),
});

function parse(brief: unknown, order: unknown): { brief: Brief; order: Order } | null {
  const b = BriefShape.safeParse(brief);
  const o = OrderShape.safeParse(order);
  return b.success && o.success ? { brief: b.data as Brief, order: o.data } : null;
}

async function currentClient() {
  const user = await getCurrentUser();
  return user && user.role === "client" && user.status === "active" ? user : null;
}

const SAVE_ERRORS: Record<string, MessageKey> = {
  invalid_brief: "wizard.errors.incomplete",
  invalid_order: "wizard.errors.incomplete",
  not_found: "wizard.errors.notSaved",
  not_editable: "wizard.errors.notEditable",
};

/** Saves the wizard as a server draft for a signed-in client (after C-08, or "Save & exit"). */
export async function saveDraft(input: { brief: unknown; order: unknown; contestId: string | null }): Promise<WizardResult<{ contestId: string }>> {
  if (!isSupabaseConfigured()) return err("auth.errors.notConfigured");
  const user = await currentClient();
  if (!user) return err("wizard.errors.signInAgain");
  const data = parse(input.brief, input.order);
  if (!data) return err("wizard.errors.incomplete");

  const result = await contestService().saveDraft(user.id, data.brief, data.order, input.contestId);
  if (!result.ok) return err(SAVE_ERRORS[result.error]);
  return { ok: true, contestId: result.contest.id };
}

async function accountTaken(mobile: string, email: string): Promise<"mobile" | "email" | null> {
  if (await findProfileByPhone(mobile)) return "mobile";
  if (await findProfileByEmail(email)) return "email";
  return null;
}

/** C-09: checks the mobile number and email before asking for a password (no OTP). */
export async function checkAccountDetails(input: { mobile: string; email: string }): Promise<WizardResult<{ mobile: string; email: string }>> {
  if (!isSupabaseConfigured()) return err("auth.errors.notConfigured");
  const mobile = normalizeBdMobile(input.mobile);
  if (!mobile) return err("auth.errors.invalidPhone");
  const email = normalizeEmail(input.email);
  if (!email) return err("wizard.errors.email");
  const taken = await accountTaken(mobile, email);
  if (taken) return err(taken === "mobile" ? "auth.errors.phoneTaken" : "wizard.errors.emailTaken");
  return { ok: true, mobile, email };
}

/**
 * C-10: creates the client account (mobile + email + password, no OTP),
 * signs in, and saves the wizard as a server draft.
 */
export async function createAccountAndDraft(input: {
  mobile: string;
  email: string;
  password: string;
  brief: unknown;
  order: unknown;
  /** This browser's push subscription, if the user allowed notifications. */
  push?: unknown;
}): Promise<WizardResult<{ contestId: string }>> {
  if (!isSupabaseConfigured()) return err("auth.errors.notConfigured");
  const data = parse(input.brief, input.order);
  if (!data) return err("wizard.errors.incomplete");

  const mobile = normalizeBdMobile(input.mobile);
  const email = normalizeEmail(input.email);
  if (!mobile || !email) return err("wizard.errors.incomplete");

  const tooShort = await passwordError(input.password);
  if (tooShort?.error) return { ok: false, error: tooShort.error };

  const taken = await accountTaken(mobile, email);
  if (taken) return err(taken === "mobile" ? "auth.errors.phoneTaken" : "wizard.errors.emailTaken");

  const { locale } = await getI18n();
  const brandName = data.brief.brandName.trim().slice(0, 80) || "Client";
  const admin = createAdminClient();
  // The trigger creates the profile as a "client". The real name is asked in C-11.
  const created = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { mobile, name: brandName, email, locale },
  });
  if (created.error || !created.data.user) {
    return /already|exists|registered/i.test(created.error?.message ?? "")
      ? err("wizard.errors.emailTaken")
      : err("auth.errors.generic");
  }

  await admin
    .from("profiles")
    .update({ business_name: brandName, username: makeSlug(brandName) })
    .eq("id", created.data.user.id);

  const ip = await clientIp();
  const signInError = await signIn(email, email, input.password, ip);
  if (signInError?.error) return { ok: false, error: signInError.error };

  // Owner, 2026-10-07: welcome push in the browser + the 6-digit email code. Neither blocks sign-up.
  const userId = created.data.user.id;
  await sendVerificationEmail({ userId, email, name: brandName, locale, ip }).catch((e) => console.error("[auth] code email failed:", e));
  if (input.push && (await savePushSubscription(userId, input.push, (await headers()).get("user-agent")))) {
    const t = createTranslator(locale, MESSAGES[locale]);
    await notifyUser(userId, { title: t("push.welcome.title"), body: t("push.welcome.body", { email }), url: "/verify-email" });
  }

  const saved = await contestService().saveDraft(created.data.user.id, data.brief, data.order, null);
  if (!saved.ok) return err(SAVE_ERRORS[saved.error]);
  return { ok: true, contestId: saved.contest.id };
}

/** C-11: saves the client's name, records the payment and sends them to the gateway. */
export async function startCheckout(input: {
  contestId: string;
  method: "bkash" | "card";
  name: string;
  acceptedTerms: boolean;
}): Promise<WizardResult> {
  if (!isSupabaseConfigured()) return err("auth.errors.notConfigured");
  const user = await currentClient();
  if (!user) return err("wizard.errors.signInAgain");

  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) return err("wizard.errors.name");
  if (!input.acceptedTerms) return err("wizard.errors.terms");
  if (input.method !== "bkash" && input.method !== "card") return err("wizard.errors.generic");

  await createAdminClient().from("profiles").update({ name }).eq("id", user.id);

  const result = await contestService().startCheckout({
    clientId: user.id,
    contestId: input.contestId,
    method: input.method,
    customer: { name, mobile: user.mobile },
  });
  if (!result.ok) return err(SAVE_ERRORS[result.error] ?? "wizard.errors.payment");
  redirect(result.redirectUrl);
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

async function fileLimits() {
  const s = await getSettings(["limits.brief_max_files", "limits.brief_file_max_mb"]);
  return { maxFiles: s["limits.brief_max_files"], maxBytes: s["limits.brief_file_max_mb"] * 1024 * 1024, maxMb: s["limits.brief_file_max_mb"] };
}

async function fileCount(contestId: string) {
  const { count } = await createAdminClient()
    .from("contest_files")
    .select("id", { count: "exact", head: true })
    .eq("contest_id", contestId);
  return count ?? 0;
}

export async function prepareBriefUpload(input: {
  contestId: string;
  name: string;
  type: string;
  size: number;
}): Promise<WizardResult<{ path: string; token: string }>> {
  if (!(await editableContest(input.contestId))) return err("wizard.errors.notSaved");
  const limits = await fileLimits();
  const ext = BRIEF_FILE_TYPES[input.type];
  if (!ext) return err("wizard.errors.fileType", { name: input.name });
  if (input.size <= 0 || input.size > limits.maxBytes) return err("wizard.errors.fileSize", { name: input.name, mb: limits.maxMb });
  if ((await fileCount(input.contestId)) >= limits.maxFiles) return err("wizard.errors.fileCount", { max: limits.maxFiles });

  const upload = await getFileStorage().createUploadUrl(BRIEF_FILES_BUCKET, `${input.contestId}/${randomUUID()}.${ext}`);
  return { ok: true, ...upload };
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
  const limits = await fileLimits();
  const pathOk = new RegExp(`^${input.contestId}/[0-9a-f-]{36}\\.(jpg|png|pdf)$`).test(input.path);
  if (!pathOk || !BRIEF_FILE_TYPES[input.type] || input.size > limits.maxBytes) return err("wizard.errors.generic");
  if (!(await getFileStorage().exists(BRIEF_FILES_BUCKET, input.path))) return err("wizard.errors.generic");
  if ((await fileCount(input.contestId)) >= limits.maxFiles) {
    await getFileStorage().remove(BRIEF_FILES_BUCKET, [input.path]);
    return err("wizard.errors.fileCount", { max: limits.maxFiles });
  }

  const { data, error } = await createAdminClient()
    .from("contest_files")
    .insert({
      contest_id: input.contestId,
      type: input.isCurrentLogo ? "current_logo" : "example",
      path: input.path,
      original_name: input.name.slice(0, 200),
      mime_type: input.type,
      size_bytes: input.size,
    })
    .select("id")
    .single();
  if (error || !data) return err("wizard.errors.generic");
  return { ok: true, id: data.id as string };
}

export async function removeBriefFile(input: { contestId: string; fileId: string }): Promise<WizardResult> {
  if (!(await editableContest(input.contestId))) return err("wizard.errors.notSaved");
  const db = createAdminClient();
  const { data } = await db
    .from("contest_files")
    .delete()
    .eq("id", input.fileId)
    .eq("contest_id", input.contestId)
    .select("path")
    .maybeSingle();
  if (data?.path) await getFileStorage().remove(BRIEF_FILES_BUCKET, [data.path as string]);
  return { ok: true };
}
