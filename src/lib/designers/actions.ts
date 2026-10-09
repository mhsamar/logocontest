"use server";

import { headers } from "next/headers";
import { sendVerificationEmail } from "@/lib/auth/email-service";
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
import { normalizeBdMobile } from "@/lib/phone";
import { notifyUser, savePushSubscription } from "@/lib/push";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkPayout, checkUsernameFormat, type PayoutInput } from "./signup";

/** D-01 designer sign-up (UI-JOURNEY). Each step is checked on the server before the next one opens. */

export type StepField = "name" | "mobile" | "email" | "password" | "username" | "bio" | "rules" | "bkashNumber" | "bankName" | "accountName" | "accountNumber" | "routingNumber";

export type StepResult = { ok: true } | { ok: false; field?: StepField; error: { key: MessageKey; params?: MessageParams } };

const fail = (key: MessageKey, field?: StepField, params?: MessageParams): StepResult => ({ ok: false, field, error: { key, params } });

const NAME_MIN = 2;
const NAME_MAX = 60;

/** Step 1: full name and mobile. */
export async function checkDesignerBasics(input: { name: string; mobile: string }): Promise<StepResult> {
  if (!isSupabaseConfigured()) return fail("auth.errors.notConfigured");
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < NAME_MIN || name.length > NAME_MAX) return fail("designerSignup.errors.name", "name");
  const mobile = normalizeBdMobile(input.mobile);
  if (!mobile) return fail("auth.errors.invalidPhone", "mobile");
  if (await findProfileByPhone(mobile)) return fail("auth.errors.phoneTaken", "mobile");
  return { ok: true };
}

/** Step 2: email and password. */
export async function checkDesignerLogin(input: { email: string; password: string }): Promise<StepResult> {
  if (!isSupabaseConfigured()) return fail("auth.errors.notConfigured");
  const email = normalizeEmail(input.email);
  if (!email) return fail("wizard.errors.email", "email");
  if (await findProfileByEmail(email)) return fail("wizard.errors.emailTaken", "email");
  const tooShort = await passwordError(input.password);
  if (tooShort?.error) return { ok: false, field: "password", error: tooShort.error };
  return { ok: true };
}

async function usernameTaken(username: string): Promise<boolean> {
  // Usernames are stored lower-case, so an exact match is enough (and LIKE would treat "_" as a wildcard).
  const { data } = await createAdminClient().from("profiles").select("id").eq("username", username).maybeSingle();
  return Boolean(data);
}

/** Step 3: live username check while typing. */
export async function checkUsername(input: string): Promise<{ ok: true; username: string } | { ok: false; error: MessageKey }> {
  const format = checkUsernameFormat(input);
  if (!format.ok) return { ok: false, error: `designerSignup.username.${format.error}` };
  if (!isSupabaseConfigured()) return { ok: true, username: format.username };
  if (await usernameTaken(format.username)) return { ok: false, error: "designerSignup.username.taken" };
  return { ok: true, username: format.username };
}

/** Step 3: username and bio before going on. */
export async function checkDesignerProfile(input: { username: string; bio: string }): Promise<StepResult> {
  const u = await checkUsername(input.username);
  if (!u.ok) return fail(u.error, "username");
  const max = await getSetting("limits.designer_bio_max_length");
  const bio = input.bio.trim();
  if (bio.length > max) return fail("designerSignup.errors.bioLong", "bio", { max });
  if (bio && findContactDetails(bio, await blockedTerms())) return fail("contest.comments.contact", "bio");
  return { ok: true };
}

/** Step 4: creates the designer account, signs in, sends the email code and the welcome push. */
export async function createDesignerAccount(input: {
  name: string;
  mobile: string;
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
  const mobile = normalizeBdMobile(input.mobile)!;
  const email = normalizeEmail(input.email)!;
  const username = checkUsernameFormat(input.username);
  if (!username.ok) return fail("designerSignup.username.format", "username");
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
    .update({ role: "designer", username: username.username, bio: input.bio.trim() || null, rules_accepted_at: new Date().toISOString() })
    .eq("id", userId);
  const { error: payoutError } = profileError ? { error: null } : await admin.from("designer_payout_methods").insert({ user_id: userId, ...payout.payout });
  if (profileError || payoutError) {
    // Don't leave a half-made account behind (for example if someone took the username a moment ago).
    await admin.auth.admin.deleteUser(userId);
    return /username/i.test(profileError?.message ?? "") ? fail("designerSignup.username.taken", "username") : fail("auth.errors.generic");
  }

  const ip = await clientIp();
  const signInError = await signIn(email, email, input.password, ip);
  if (signInError?.error) return { ok: false, error: signInError.error };

  await sendVerificationEmail({ userId, email, name, locale, ip }).catch((e) => console.error("[auth] code email failed:", e));
  if (input.push && (await savePushSubscription(userId, input.push, (await headers()).get("user-agent")))) {
    const t = await translatorFor(locale);
    await notifyUser(userId, { title: t("push.welcome.title"), body: t("push.welcome.body", { email }), url: "/verify-email" });
  }
  return { ok: true };
}
