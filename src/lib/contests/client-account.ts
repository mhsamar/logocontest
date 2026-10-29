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
import { getLocale } from "@/lib/i18n/server";
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

/** A check's answer, or its error thrown now: checks run at once are still read (and fail) in their old order. */
const answer = <T,>(r: PromiseSettledResult<T>): T => {
  if (r.status === "rejected") throw r.reason;
  return r.value;
};

/** Which of the two already has an account: the mobile number first, then the email (both looked up at once). */
export async function accountTaken(mobile: string, email: string): Promise<"mobile" | "email" | null> {
  const [phone, mail] = await Promise.allSettled([findProfileByPhone(mobile), findProfileByEmail(email)]);
  if (answer(phone)) return "mobile";
  if (answer(mail)) return "email";
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
  // Every check before the account is made, run at once (owner, 2026-10-29: step 1 felt slow) and read in the order they
  // always were, so the same error comes first: a real email, the password, a blocked contact (a blocked person gets no
  // account either), then a number or email that already has an account.
  const [[rejectedR, tooShortR, blockedR, takenR], locale] = await Promise.all([
    Promise.allSettled([emailRejection(email), passwordError(input.password), contactBlocked({ mobile, email }), accountTaken(mobile, email)]),
    getLocale(),
  ]);
  const rejected = answer(rejectedR);
  if (rejected) return fail(rejected.key, rejected.params);
  const tooShort = answer(tooShortR);
  if (tooShort?.error) return { ok: false, error: tooShort.error };
  if (answer(blockedR)) return fail("wizard.errors.blocked");
  const taken = answer(takenR);
  if (taken) return fail(taken === "mobile" ? "auth.errors.phoneTaken" : "wizard.errors.emailTaken");

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

  const userId = created.data.user.id;
  const [ip, source] = await Promise.all([clientIp(), takeSignupSource()]);
  // The profile's other details are saved while the new client is signed in, all before the reply (owner, 2026-10-29:
  // step 1 felt slow). A fixed username: first name + client number, e.g. anika010 (owner, 2026-10-17); each contest
  // keeps its own brand name, so the profile has no business name. The sign-up source counts sign-ups that started
  // from the visitor pop-up (owner, 2026-10-13).
  // Every write finishes before the answer, also when the sign-in fails.
  const [whatsappR, usernameR, sourceR, signInR] = await Promise.allSettled([
    admin.from("profiles").update({ whatsapp: input.whatsapp === true }).eq("id", userId),
    assignUsername(created.data.user.id, personName, "client").catch((e) => console.error("[signup] username:", e instanceof Error ? e.message : e)),
    saveSignupSource(userId, source),
    signIn(email, email, input.password, ip),
  ]);
  // Read in the old order: a failed write first (it came before the sign-in), then the sign-in.
  for (const r of [whatsappR, usernameR, sourceR] as PromiseSettledResult<unknown>[]) answer(r);
  const signInError = answer(signInR);
  if (signInError?.error) return { ok: false, error: signInError.error };

  // This browser's notifications (the next page shows them as on); sign-up never takes them from another account.
  const pushSaved = input.push ? await savePushSubscription(userId, input.push, (await headers()).get("user-agent"), { takeOver: false }) : false;
  // Owner, 2026-10-07: the 6-digit email code and the welcome push; 2026-10-15: welcome.html. All after the reply (owner,
  // 2026-10-29: step 1 waited about a second for the email), one after another in the order they always went. The code
  // is made when its email goes; nothing before /verify-email needs it.
  after(async () => {
    await sendVerificationEmail({ userId, email, name: personName, locale, ip }).catch((e) => console.error("[auth] code email failed:", e));
    // The welcome push can be turned off in Admin › Notifications (the browser is still saved for later notices).
    if (pushSaved && (await noticeOn("welcome", "push"))) {
      const t = await translatorFor(locale);
      await notifyUser(userId, { title: t("push.welcome.title"), body: t("push.welcome.body", { email }), url: "/verify-email" });
    }
    await emailWelcome(userId);
  });
  return { ok: true, userId };
}
