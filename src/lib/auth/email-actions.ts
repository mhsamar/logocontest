"use server";

import { headers } from "next/headers";
import { isSupabaseConfigured } from "@/lib/env";
import { toAsciiDigits } from "@/lib/phone";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { savePushSubscription } from "@/lib/push";
import { emailVerificationService, sendPasswordResetEmail, sendVerificationEmail, type SendCodeResult } from "./email-service";
import { normalizeEmail } from "./identity";
import { clientIp } from "./services";
import { getCurrentUser } from "./session";
import { fail, passwordError, type AuthFormState } from "./sign-in";

export type EmailActionState = { status: "idle" | "sent" | "error"; error?: AuthFormState["error"] };

export type CodeFormState = { status: "idle" | "ok" | "sent" | "error"; error?: AuthFormState["error"] };

function codeSendError(result: SendCodeResult): CodeFormState {
  if (result.status === "sent") return { status: "sent" };
  if (result.status === "cooldown") return { status: "error", error: { key: "auth.errors.cooldown", params: { seconds: result.retryAfterSeconds } } };
  return { status: "error", error: { key: "auth.errors.emailLimit" } };
}

/** "Resend code" on the confirm-your-email banner and page. */
export async function resendVerification(): Promise<CodeFormState> {
  const user = await getCurrentUser();
  if (!user?.email || user.emailVerifiedAt) return { status: "idle" };
  const { locale } = await getI18n();
  return codeSendError(await sendVerificationEmail({ userId: user.id, email: user.email, name: user.name, locale, ip: await clientIp() }));
}

/** Checks the 6-digit code typed on the banner or on /verify-email. */
export async function confirmEmailCode(_prev: CodeFormState, formData: FormData): Promise<CodeFormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", error: { key: "auth.errors.generic" } };
  if (user.emailVerifiedAt) return { status: "ok" };
  const code = toAsciiDigits(String(formData.get("code") ?? "")).replace(/\D/g, "");
  if (!code) return { status: "error", error: { key: "auth.verify.enterCode" } };
  const result = await emailVerificationService().verify(user.id, code);
  if (result.ok) return { status: "ok" };
  return result.error === "invalid"
    ? { status: "error", error: { key: "auth.verify.invalid", params: { left: result.attemptsLeft ?? 0 } } }
    : { status: "error", error: { key: `auth.verify.${result.error}` } };
}

/** Saves this browser's push subscription for the signed-in user. */
export async function savePush(subscription: unknown): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return savePushSubscription(user.id, subscription, (await headers()).get("user-agent"));
}

/** P-11 "Forgot password?": always answers the same way, so it never reveals whether an account exists. */
export async function requestPasswordReset(_prev: EmailActionState, formData: FormData): Promise<EmailActionState> {
  if (!isSupabaseConfigured()) return { status: "error", error: { key: "auth.errors.notConfigured" } };
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) return { status: "error", error: { key: "wizard.errors.email" } };
  const { locale } = await getI18n();
  const result = await sendPasswordResetEmail({ email, locale, ip: await clientIp() });
  return result === "sent" ? { status: "sent" } : { status: "error", error: { key: "auth.errors.emailLimit" } };
}

/** "Set a new password", reached from the emailed link (which signs the user in for this). */
export async function setNewPassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return fail("auth.errors.notConfigured");
  const password = String(formData.get("password") ?? "");
  const tooShort = await passwordError(password);
  if (tooShort) return tooShort;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return fail("auth.errors.resetExpired");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return /different|same/i.test(error.message) ? fail("auth.errors.samePassword", "password") : fail("auth.errors.generic");
  return { status: "ok" };
}
