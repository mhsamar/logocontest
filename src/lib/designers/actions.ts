"use server";

import { usernameTaken as usernameUsedBefore } from "@/lib/profile/usernames";
import { headers } from "next/headers";
import { sendVerificationEmail } from "@/lib/auth/email-service";
import { emailRejection } from "@/lib/auth/email-check";
import { normalizeEmail } from "@/lib/auth/identity";
import { clientIp } from "@/lib/auth/services";
import { getCurrentUser } from "@/lib/auth/session";
import { findProfileByEmail, findProfileByPhone, passwordError, signIn } from "@/lib/auth/sign-in";
import { blockedTerms } from "@/lib/contests/community";
import { isSupabaseConfigured } from "@/lib/env";
import { translatorFor } from "@/lib/content/texts";
import { getI18n } from "@/lib/i18n/server";
import { type MessageKey, type MessageParams } from "@/lib/i18n/translate";
import { findContactDetails } from "@/lib/moderation/contact-filter";
import { toE164 } from "@/lib/phone";
import { notifyUser, savePushSubscription } from "@/lib/push";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveSignupSource, takeSignupSource } from "@/lib/visitor-popup/source";
import { isPersonName } from "@/lib/profile/name-rules";
import { checkPayout, checkUsernameFormat, type PayoutInput } from "./signup";
import { checkExtraAnswers } from "@/lib/onboarding/config";
import { getOnboarding } from "@/lib/onboarding/store";
import { emailWelcome } from "@/lib/email/events";
import { after } from "next/server";
import { noticeOn } from "@/lib/notifications/switches";

/** D-01 designer sign-up (UI-JOURNEY). Each step is checked on the server before the next one opens. */

export type StepField = "name" | "mobile" | "email" | "password" | "username" | "bio" | "rules" | "bkashNumber" | "bkashKind" | "bankName" | "accountName" | "accountNumber" | "routingNumber";

export type StepResult = { ok: true } | { ok: false; field?: StepField; error: { key: MessageKey; params?: MessageParams } };

const fail = (key: MessageKey, field?: StepField, params?: MessageParams): StepResult => ({ ok: false, field, error: { key, params } });

const NAME_MIN = 2;
const NAME_MAX = 60;

/** Step 1: full name and mobile. */
/** The owner's own questions on a sign-up step (Admin › Onboarding, owner 2026-10-14): answered, and no contact details. */
async function extraProblem(answers: unknown, steps?: number[]): Promise<StepResult | null> {
  const cfg = await getOnboarding("designer");
  if (!cfg.extra.length) return null;
  const { answers: clean, errors } = checkExtraAnswers(cfg, answers, steps);
  const first = Object.values(errors)[0];
  if (first) return fail(`services.wizard.errors.${first}` as MessageKey);
  const terms = await blockedTerms();
  if (Object.values(clean).some((v) => typeof v === "string" && findContactDetails(v, terms))) return fail("contest.comments.contact");
  return null;
}

export async function checkDesignerBasics(input: { name: string; mobile: string; country?: string; answers?: unknown }): Promise<StepResult> {
  if (!isSupabaseConfigured()) return fail("auth.errors.notConfigured");
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < NAME_MIN || name.length > NAME_MAX) return fail("designerSignup.errors.name", "name");
  // Letters only (owner, 2026-10-14): no digits or signs like . / ,
  if (!isPersonName(name)) return fail("designerSignup.errors.nameLetters", "name");
  // Any country, Bangladesh by default (owner, 2026-10-14).
  const mobile = toE164(input.mobile, input.country);
  if (!mobile) return fail(input.country && input.country !== "BD" ? "auth.errors.invalidPhoneIntl" : "auth.errors.invalidPhone", "mobile");
  if (await findProfileByPhone(mobile)) return fail("auth.errors.phoneTaken", "mobile");
  return (await extraProblem(input.answers, [1])) ?? { ok: true };
}

/** Step 2: email and password. */
export async function checkDesignerLogin(input: { email: string; password: string }): Promise<StepResult> {
  if (!isSupabaseConfigured()) return fail("auth.errors.notConfigured");
  const email = normalizeEmail(input.email);
  if (!email) return fail("wizard.errors.email", "email");
  // Real emails only, no temporary inboxes (owner, 2026-10-14).
  const rejected = await emailRejection(email);
  if (rejected) return fail(rejected.key, "email", rejected.params);
  if (await findProfileByEmail(email)) return fail("wizard.errors.emailTaken", "email");
  const tooShort = await passwordError(input.password);
  if (tooShort?.error) return { ok: false, field: "password", error: tooShort.error };
  return { ok: true };
}

/** Taken now, or once used by someone (old usernames stay reserved for old links, owner 2026-10-15). */
const usernameTaken = (username: string) => usernameUsedBefore(username);

/** Step 3: live username check while typing. */
export async function checkUsername(input: string): Promise<{ ok: true; username: string } | { ok: false; error: MessageKey }> {
  const format = checkUsernameFormat(input);
  if (!format.ok) return { ok: false, error: `designerSignup.username.${format.error}` };
  if (!isSupabaseConfigured()) return { ok: true, username: format.username };
  if (await usernameTaken(format.username)) return { ok: false, error: "designerSignup.username.taken" };
  return { ok: true, username: format.username };
}

/** Step 3: username and bio before going on. */
export async function checkDesignerProfile(input: { username: string; bio: string; answers?: unknown }): Promise<StepResult> {
  const u = await checkUsername(input.username);
  if (!u.ok) return fail(u.error, "username");
  const max = await getSetting("limits.designer_bio_max_length");
  const bio = input.bio.trim();
  if (bio.length > max) return fail("designerSignup.errors.bioLong", "bio", { max });
  if (bio && findContactDetails(bio, await blockedTerms())) return fail("contest.comments.contact", "bio");
  return (await extraProblem(input.answers, [3])) ?? { ok: true };
}

/** Step 4: creates the designer account, signs in, sends the email code and the welcome push. */
export async function createDesignerAccount(input: {
  name: string;
  mobile: string;
  country?: string;
  /** "This number is on WhatsApp" (owner, 2026-10-14). */
  whatsapp?: boolean;
  /** Answers to the owner's own questions (Admin › Onboarding). */
  answers?: unknown;
  email: string;
  password: string;
  username: string;
  bio: string;
  payout: PayoutInput;
  acceptedRules: boolean;
  push?: unknown;
}): Promise<StepResult> {
  if (await getCurrentUser()) return fail("designerSignup.errors.signedIn");
  // Every step again, since the browser can't be trusted.
  for (const check of [
    () => checkDesignerBasics(input),
    () => checkDesignerLogin(input),
    () => checkDesignerProfile(input),
  ]) {
    const r = await check();
    if (!r.ok) return r;
  }
  const payout = checkPayout(input.payout);
  if (!payout.ok) return fail(`designerSignup.payout.errors.${payout.field}`, payout.field);
  if (!input.acceptedRules) return fail("designerSignup.errors.rules", "rules");

  const name = input.name.trim().replace(/\s+/g, " ");
  const mobile = toE164(input.mobile, input.country)!;
  const email = normalizeEmail(input.email)!;
  const username = checkUsernameFormat(input.username);
  if (!username.ok) return fail("designerSignup.username.format", "username");
  const onboarding = await getOnboarding("designer");
  const extra = await extraProblem(input.answers);
  if (extra) return extra;
  const { locale } = await getI18n();
  const admin = createAdminClient();

  const created = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { mobile, name, email, locale },
  });
  if (created.error || !created.data.user) {
    return /already|exists|registered/i.test(created.error?.message ?? "") ? fail("wizard.errors.emailTaken", "email") : fail("auth.errors.generic");
  }
  const userId = created.data.user.id;

  // The sign-up trigger makes every new profile a client; this one is a designer.
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      role: "designer",
      username: username.username,
      bio: input.bio.trim() || null,
      rules_accepted_at: new Date().toISOString(),
      whatsapp: input.whatsapp === true,
      // Only once the owner has questions, so sign-up keeps working before migration 0056.
      ...(onboarding.extra.length ? { onboarding_answers: checkExtraAnswers(onboarding, input.answers).answers } : {}),
    })
    .eq("id", userId);
  const { error: payoutError } = profileError ? { error: null } : await admin.from("designer_payout_methods").insert({ user_id: userId, ...payout.payout });
  if (profileError || payoutError) {
    // Don't leave a half-made account behind (for example if someone took the username a moment ago).
    await admin.auth.admin.deleteUser(userId);
    return /username/i.test(profileError?.message ?? "") ? fail("designerSignup.username.taken", "username") : fail("auth.errors.generic");
  }

  // Owner, 2026-10-13: count sign-ups that started from the visitor pop-up.
  await saveSignupSource(userId, await takeSignupSource());

  const ip = await clientIp();
  const signInError = await signIn(email, email, input.password, ip);
  if (signInError?.error) return { ok: false, error: signInError.error };

  await sendVerificationEmail({ userId, email, name, locale, ip }).catch((e) => console.error("[auth] code email failed:", e));
  // welcome.html (owner, 2026-10-15), after the reply so sign-up stays quick.
  after(() => emailWelcome(userId));
  // The welcome push can be turned off in Admin › Notifications (the browser is still saved for later notices).
  if (input.push && (await savePushSubscription(userId, input.push, (await headers()).get("user-agent"))) && (await noticeOn("welcome", "push"))) {
    const t = await translatorFor(locale);
    await notifyUser(userId, { title: t("push.welcome.title"), body: t("push.welcome.body", { email }), url: "/verify-email" });
  }
  return { ok: true };
}
