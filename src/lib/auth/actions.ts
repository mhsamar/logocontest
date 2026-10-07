"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import { normalizeBdMobile, toAsciiDigits } from "@/lib/phone";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { authEmailForPhone } from "./identity";
import type { OtpPurpose } from "./otp-service";
import { clientIp, loginGuard, otpService } from "./services";

export type FormMessage = { key: MessageKey; params?: MessageParams };

export type AuthFormState = {
  status: "idle" | "ok" | "error";
  error?: FormMessage;
  field?: "phone" | "code" | "password" | "name";
  phone?: string;
  codeLength?: number;
  resendAfter?: number;
  /** Changes on every successful code request, so the client can restart its timer. */
  sentAt?: number;
};

const fail = (key: MessageKey, field?: AuthFormState["field"], params?: MessageParams): AuthFormState => ({
  status: "error",
  error: { key, params },
  field,
});

const ticketCookie = (purpose: OtpPurpose) => `lc_verify_${purpose}`;

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

async function findProfileByPhone(phone: string) {
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id, status")
    .eq("mobile", phone)
    .maybeSingle<{ id: string; status: "active" | "suspended" | "banned" }>();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Signs the user in and sets the session cookie. Refuses suspended or banned
 * accounts. Returns an error state, or null on success.
 */
async function signIn(phone: string, password: string, ip: string | null): Promise<AuthFormState | null> {
  const guard = loginGuard();
  const gate = await guard.check(phone, ip);
  if (!gate.allowed) return fail("auth.errors.locked", undefined, { minutes: gate.retryAfterMinutes });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: authEmailForPhone(phone), password });
  if (error || !data.user) {
    await guard.record(phone, ip, false);
    return fail("auth.errors.invalidCredentials", "password");
  }

  const profile = await findProfileByPhone(phone);
  if (!profile || profile.status !== "active") {
    await supabase.auth.signOut();
    return fail(profile?.status === "banned" ? "auth.errors.banned" : "auth.errors.suspended");
  }

  await guard.record(phone, ip, true);
  return null;
}

// ---------------------------------------------------------------------------
// Login (P-11) and logout
// ---------------------------------------------------------------------------

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return fail("auth.errors.notConfigured");

  const phone = normalizeBdMobile(String(formData.get("phone") ?? ""));
  if (!phone) return fail("auth.errors.invalidPhone", "phone");
  const password = String(formData.get("password") ?? "");
  if (!password) return fail("auth.errors.invalidCredentials", "password");

  const result = await signIn(phone, password, await clientIp());
  if (result) return result;
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}

// ---------------------------------------------------------------------------
// OTP steps. Used by password reset now, and by C-09 / D-01 signup later.
// ---------------------------------------------------------------------------

export async function requestCode(purpose: OtpPurpose, prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return fail("auth.errors.notConfigured");

  const phone = normalizeBdMobile(String(formData.get("phone") ?? ""));
  if (!phone) return fail("auth.errors.invalidPhone", "phone");

  // Keep the last successful send on errors, so a failed resend stays on the code step.
  const keep = (state: AuthFormState): AuthFormState =>
    prev.phone === phone
      ? { ...state, phone, sentAt: prev.sentAt, resendAfter: prev.resendAfter, codeLength: prev.codeLength }
      : state;

  const existing = await findProfileByPhone(phone);
  if (purpose === "register" && existing) return fail("auth.errors.phoneTaken", "phone");

  const codeLength = await getSetting("otp.length");
  // Password reset never reveals whether a number has an account.
  if (purpose === "reset" && !existing) {
    return {
      status: "ok",
      phone,
      codeLength,
      resendAfter: await getSetting("otp.resend_cooldown_seconds"),
      sentAt: Date.now(),
    };
  }

  const { t } = await getI18n();
  const result = await otpService().request({
    phone,
    purpose,
    ip: await clientIp(),
    message: (code, minutes) => t(purpose === "register" ? "auth.sms.register" : "auth.sms.reset", { code, minutes }),
  });

  if (!result.ok) {
    if (result.error === "cooldown") {
      return keep(fail("auth.errors.cooldown", "phone", { seconds: result.retryAfterSeconds ?? 0 }));
    }
    return keep(fail(result.error === "phone_limit" ? "auth.errors.phoneLimit" : "auth.errors.ipLimit", "phone"));
  }
  return { status: "ok", phone, codeLength: result.codeLength, resendAfter: result.resendAfterSeconds, sentAt: Date.now() };
}

export async function verifyCode(purpose: OtpPurpose, _prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return fail("auth.errors.notConfigured");

  const phone = normalizeBdMobile(String(formData.get("phone") ?? ""));
  if (!phone) return fail("auth.errors.ticketInvalid");
  const code = toAsciiDigits(String(formData.get("code") ?? "")).replace(/\D/g, "");
  if (!code) return { ...fail("auth.errors.codeRequired", "code"), phone };

  const result = await otpService().verify({ phone, purpose, code });
  if (!result.ok) {
    const key: Record<typeof result.error, MessageKey> = {
      invalid: "auth.errors.codeInvalid",
      expired: "auth.errors.codeExpired",
      too_many_attempts: "auth.errors.tooManyAttempts",
      no_code: "auth.errors.noCode",
    };
    return { ...fail(key[result.error], "code", { attempts: result.attemptsLeft ?? 0 }), phone };
  }

  (await cookies()).set(ticketCookie(purpose), result.ticket, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: (await getSetting("otp.ticket_ttl_minutes")) * 60,
  });
  return { status: "ok", phone };
}

async function readTicket(purpose: OtpPurpose) {
  const store = await cookies();
  const check = await otpService().checkTicket(store.get(ticketCookie(purpose))?.value, purpose);
  return check;
}

async function passwordError(password: string): Promise<AuthFormState | null> {
  const min = await getSetting("auth.password_min_length");
  return password.length < min ? fail("auth.errors.passwordTooShort", "password", { min }) : null;
}

// ---------------------------------------------------------------------------
// Password reset: phone → code → new password
// ---------------------------------------------------------------------------

export async function completeReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return fail("auth.errors.notConfigured");

  const password = String(formData.get("password") ?? "");
  const tooShort = await passwordError(password);
  if (tooShort) return tooShort;

  const ticket = await readTicket("reset");
  if (!ticket.ok) return fail("auth.errors.ticketInvalid");

  const profile = await findProfileByPhone(ticket.phone);
  if (!profile) return fail("auth.errors.ticketInvalid");

  const consumed = await otpService().consumeTicket(ticket.otpId);
  if (!consumed) return fail("auth.errors.ticketInvalid");

  const { error } = await createAdminClient().auth.admin.updateUserById(profile.id, { password });
  if (error) return fail("auth.errors.generic");
  (await cookies()).delete(ticketCookie("reset"));

  const signInError = await signIn(ticket.phone, password, await clientIp());
  if (signInError) return signInError;
  redirect("/");
}
