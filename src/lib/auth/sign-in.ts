import "server-only";
import { cookies } from "next/headers";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { authEmailForPhone } from "./identity";
import type { OtpPurpose } from "./otp-service";
import { loginGuard, otpService } from "./services";

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

export const fail = (key: MessageKey, field?: AuthFormState["field"], params?: MessageParams): AuthFormState => ({
  status: "error",
  error: { key, params },
  field,
});

export const ticketCookie = (purpose: OtpPurpose) => `lc_verify_${purpose}`;

export function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

type ProfileStatus = { id: string; email: string | null; status: "active" | "suspended" | "banned" };

export async function findProfileByPhone(phone: string) {
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id, email, status")
    .eq("mobile", phone)
    .maybeSingle<ProfileStatus>();
  if (error) throw new Error(error.message);
  return data;
}

export async function findProfileByEmail(email: string) {
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id, email, status")
    .ilike("email", email)
    .maybeSingle<ProfileStatus>();
  if (error) throw new Error(error.message);
  return data;
}

/** The address Supabase Auth knows this mobile number by (real email, or the legacy internal one). */
export async function authEmailForMobile(mobile: string): Promise<string> {
  const profile = await findProfileByPhone(mobile);
  return profile?.email ?? authEmailForPhone(mobile);
}

/**
 * Signs the user in and sets the session cookie. Refuses suspended or banned
 * accounts. `key` (mobile or email) is what failed attempts are counted
 * against. Returns an error state, or null on success.
 */
export async function signIn(key: string, authEmail: string, password: string, ip: string | null): Promise<AuthFormState | null> {
  const guard = loginGuard();
  const gate = await guard.check(key, ip);
  if (!gate.allowed) return fail("auth.errors.locked", undefined, { minutes: gate.retryAfterMinutes });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail, password });
  if (error || !data.user) {
    await guard.record(key, ip, false);
    return fail("auth.errors.invalidCredentials", "password");
  }

  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("status")
    .eq("id", data.user.id)
    .maybeSingle<{ status: ProfileStatus["status"] }>();
  if (!profile || profile.status !== "active") {
    await supabase.auth.signOut();
    return fail(profile?.status === "banned" ? "auth.errors.banned" : "auth.errors.suspended");
  }

  await guard.record(key, ip, true);
  return null;
}

export async function readTicket(purpose: OtpPurpose) {
  const store = await cookies();
  const check = await otpService().checkTicket(store.get(ticketCookie(purpose))?.value, purpose);
  return check;
}

export async function passwordError(password: string): Promise<AuthFormState | null> {
  const min = await getSetting("auth.password_min_length");
  return password.length < min ? fail("auth.errors.passwordTooShort", "password", { min }) : null;
}

