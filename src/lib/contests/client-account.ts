import "server-only";
import { headers } from "next/headers";
import { after } from "next/server";
import { contactBlocked } from "@/lib/auth/contact-blocks";
import { emailRejection } from "@/lib/auth/email-check";
import { sendVerificationEmail } from "@/lib/auth/email-service";
import { normalizeEmail } from "@/lib/auth/identity";
import { clientIp } from "@/lib/auth/services";
import { findProfileByEmail, findProfileByPhone, passwordError, signIn } from "@/lib/auth/sign-in";
import { translatorFor } from "@/lib/content/texts";
import { emailWelcome } from "@/lib/email/events";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import { noticeOn } from "@/lib/notifications/switches";
import { toE164 } from "@/lib/phone";
import { isPersonName, personNameFrom } from "@/lib/profile/name-rules";
import { assignUsername } from "@/lib/profile/usernames";
import { notifyUser, savePushSubscription } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveSignupSource, takeSignupSource } from "@/lib/visitor-popup/source";

export type AccountError = { key: MessageKey; params?: MessageParams; field?: string };

export type NewClient = {
  /** The client's real name (owner, 2026-10-15), checked against payments. Older callers leave it out. */
  name?: string;
  mobile: string;
  country?: string;
  /** "This number is on WhatsApp" (owner, 2026-10-14). */
  whatsapp?: boolean;
  email: string;
  password: string;
  /** This browser's push subscription, if the user allowed notifications. */
  push?: unknown;
};

const fail = (key: MessageKey, params?: MessageParams) => ({ ok: false as const, error: { key, params } as AccountError });

/** Which of the two already has an account: the mobile number first, then the email. */
export async function accountTaken(mobile: string, email: string): Promise<"mobile" | "email" | null> {
  if (await findProfileByPhone(mobile)) return "mobile";
  if (await findProfileByEmail(email)) return "email";
  return null;
}

/**
 * C-10: creates a client account (mobile + email + password, no OTP) and signs it in. Shared by the logo and service
 * wizards (with the first draft) and by onboarding v2's first step (owner, 2026-10-28). `fallbackName` names the
 * account when no person's name was given (older callers: the brand).
 */
export async function createClientAccount(input: NewClient, fallbackName: string): Promise<{ ok: true; userId: string } | { ok: false; error: AccountError }> {
  const mobile = toE164(input.mobile, input.country);
  const email = normalizeEmail(input.email);
  if (!mobile || !email) return fail("wizard.errors.incomplete");
  const rejected = await emailRejection(email);
  if (rejected) return fail(rejected.key, rejected.params);

  const tooShort = await passwordError(input.password);
  if (tooShort?.error) return { ok: false, error: tooShort.error };
  // Before the account is made, so a blocked person gets no account either.
  if (await contactBlocked({ mobile, email })) return fail("wizard.errors.blocked");

  const taken = await accountTaken(mobile, email);
  if (taken) return fail(taken === "mobile" ? "auth.errors.phoneTaken" : "wizard.errors.emailTaken");

  const { locale } = await getI18n();
  // The client's own name (owner, 2026-10-15: before, a new client's account was named after the brand).
  const typed = (input.name ?? "").trim().replace(/\s+/g, " ");
  if (input.name !== undefined && (!isPersonName(typed) || typed.length < 2 || typed.length > 60)) return fail("designerSignup.errors.nameLetters");
  const fallback = personNameFrom(fallbackName).length >= 2 ? personNameFrom(fallbackName) : "Client";
  const personName = input.name !== undefined ? typed : fallback;
  const admin = createAdminClient();
  // The trigger creates the profile as a "client" with this name.
  const created = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { mobile, name: personName, email, locale },
  });
  if (created.error || !created.data.user) {
    return /already|exists|registered/i.test(created.error?.message ?? "") ? fail("wizard.errors.emailTaken") : fail("auth.errors.generic");
  }

  // A fixed username: first name + client number, e.g. anika010 (owner, 2026-10-17). Each contest keeps its own brand
  // name, so the profile has no business name.
  await admin.from("profiles").update({ whatsapp: input.whatsapp === true }).eq("id", created.data.user.id);
  await assignUsername(created.data.user.id, personName, "client").catch((e) => console.error("[signup] username:", e instanceof Error ? e.message : e));
  // Owner, 2026-10-13: count sign-ups that started from the visitor pop-up.
  await saveSignupSource(created.data.user.id, await takeSignupSource());

  const ip = await clientIp();
  const signInError = await signIn(email, email, input.password, ip);
  if (signInError?.error) return { ok: false, error: signInError.error };

  // Owner, 2026-10-07: welcome push in the browser + the 6-digit email code. Neither blocks sign-up.
  const userId = created.data.user.id;
  await sendVerificationEmail({ userId, email, name: personName, locale, ip }).catch((e) => console.error("[auth] code email failed:", e));
  // welcome.html (owner, 2026-10-15), after the reply so sign-up stays quick.
  after(() => emailWelcome(userId));
  // The welcome push can be turned off in Admin › Notifications (the browser is still saved for later notices).
  if (input.push && (await savePushSubscription(userId, input.push, (await headers()).get("user-agent"), { takeOver: false })) && (await noticeOn("welcome", "push"))) {
    const t = await translatorFor(locale);
    await notifyUser(userId, { title: t("push.welcome.title"), body: t("push.welcome.body", { email }), url: "/verify-email" });
  }
  return { ok: true, userId };
}
