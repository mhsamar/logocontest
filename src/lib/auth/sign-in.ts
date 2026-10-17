import "server-only";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { authEmailForPhone } from "./identity";
import { loginGuard } from "./services";

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
  /** Logged in on the other role's page (owner, 2026-10-14): the account's real role, for the "Log in as" link. */
  wrongRole?: "client" | "designer";
};

export const fail = (key: MessageKey, field?: AuthFormState["field"], params?: MessageParams): AuthFormState => ({
  status: "error",
  error: { key, params },
  field,
});

export function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

type ProfileStatus = { id: string; email: string | null; role: "client" | "designer" | "admin"; status: "active" | "suspended" | "banned" | "deleted" };


export async function findProfileByPhone(phone: string) {
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id, email, role, status")
    .eq("mobile", phone)
    .maybeSingle<ProfileStatus>();
  if (error) throw new Error(error.message);
  return data;
}

export async function findProfileByEmail(email: string) {
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id, email, role, status")
    .ilike("email", email)
    .maybeSingle<ProfileStatus>();
  if (error) throw new Error(error.message);
  return data;
}

export async function findProfileByUsername(username: string) {
  const db = createAdminClient();
  const { data, error } = await db.from("profiles").select("id, email, role, status").eq("username", username.toLowerCase()).maybeSingle<ProfileStatus>();
  if (error) throw new Error(error.message);
  if (data) return data;
  // An old username still logs in (owner, 2026-10-17: every account got a new name + number username).
  const { data: old } = await db.from("username_history").select("profile_id").eq("old_username", username.toLowerCase()).maybeSingle();
  if (!old) return null;
  const { data: p } = await db.from("profiles").select("id, email, role, status").eq("id", old.profile_id).maybeSingle<ProfileStatus>();
  return p ?? null;
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
  // Owner, 2026-10-12: a suspended user can log in and use the site, but can't send designs, comment or like until
  // the 48 hours are over (src/lib/auth/policies.ts). A banned user can't log in.
  if (!profile || profile.status === "banned" || profile.status === "deleted") {
    await supabase.auth.signOut();
    return fail(profile?.status === "deleted" ? "auth.errors.deleted" : "auth.errors.banned");
  }

  await guard.record(key, ip, true);
  return null;
}

export async function passwordError(password: string): Promise<AuthFormState | null> {
  const min = await getSetting("auth.password_min_length");
  return password.length < min ? fail("auth.errors.passwordTooShort", "password", { min }) : null;
}

