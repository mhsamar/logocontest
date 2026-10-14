"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { sendPasswordResetEmail } from "@/lib/auth/email-service";
import { homeForRole } from "@/lib/auth/home";
import { clientIp } from "@/lib/auth/services";
import { currentSessionId, endAllSessions, endSessions, markLoggedOut } from "@/lib/auth/sessions";
import { passwordError } from "@/lib/auth/sign-in";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { adminUser, audit, cleanReason, superAdmin, UUID } from "./core";

/**
 * Admin › Users (owner, 2026-10-14): sign a person out of every device, send a password reset email or set a new
 * password, and (Super admin) log in as the person to see the site exactly as they do. Passwords are never readable:
 * the login system keeps only a one-way scramble of them. Every step is in the audit log.
 */

type Result = { ok: true } | { ok: false; error: MessageKey };
type Fields = Record<string, string>;
const fail = (error: MessageKey): Result => ({ ok: false, error });

/** Clients and designers only; staff accounts are managed in Admins & roles. */
async function target(userId: string) {
  if (!UUID.test(userId)) return null;
  const { data } = await createAdminClient().from("profiles").select("id, name, role, status, email, is_super_admin, locale").eq("id", userId).maybeSingle();
  if (!data || data.role === "admin" || data.is_super_admin || data.status === "deleted") return null;
  return data as { id: string; name: string; role: "client" | "designer"; status: string; email: string | null; locale: string | null };
}

export async function signOutEverywhere(userId: string): Promise<Result> {
  const admin = await adminUser("users.manage");
  const u = admin ? await target(userId) : null;
  if (!admin || !u) return fail("auth.errors.generic");
  const n = await endAllSessions(u.id, "admin");
  await audit(admin.id, "sign_out_devices", "user", u.id, { devices: n });
  refresh();
  return { ok: true };
}

export async function signOutOneDevice(userId: string, sessionId: string): Promise<Result> {
  const admin = await adminUser("users.manage");
  const u = admin ? await target(userId) : null;
  if (!admin || !u || !UUID.test(sessionId)) return fail("auth.errors.generic");
  const { data } = await createAdminClient().from("user_sessions").select("id").eq("id", sessionId).eq("user_id", u.id).maybeSingle();
  if (!data) return fail("auth.errors.generic");
  await endSessions([sessionId], "admin");
  await audit(admin.id, "sign_out_devices", "user", u.id, { devices: 1 });
  refresh();
  return { ok: true };
}

export async function sendResetEmail(userId: string): Promise<Result> {
  const admin = await adminUser("users.manage");
  const u = admin ? await target(userId) : null;
  if (!admin || !u) return fail("auth.errors.generic");
  if (!u.email || u.email.endsWith("@phone.logocontest.bd")) return fail("admin.security.errors.noEmail");
  const { locale } = await getI18n();
  const sent = await sendPasswordResetEmail({ email: u.email, locale, ip: await clientIp() });
  if (sent !== "sent") return fail("auth.errors.emailLimit");
  await audit(admin.id, "send_password_reset", "user", u.id, {});
  return { ok: true };
}

/** A new password the admin gives the person (by phone, for example). Every device is signed out. */
export async function setUserPassword(userId: string, f: Fields): Promise<Result> {
  const admin = await adminUser("users.manage");
  const u = admin ? await target(userId) : null;
  if (!admin || !u) return fail("auth.errors.generic");
  const reason = cleanReason(f.reason);
  if (!reason) return fail("admin.errors.reason");
  const password = String(f.password ?? "");
  const short = await passwordError(password);
  if (short?.error) return fail(short.error.key);
  const { error } = await createAdminClient().auth.admin.updateUserById(u.id, { password });
  if (error) return fail("auth.errors.generic");
  await endAllSessions(u.id, "password_reset");
  // Never the password itself.
  await audit(admin.id, "set_password", "user", u.id, { reason });
  return { ok: true };
}

/** "<user id>|<name>": shows the "you are logged in as" bar while that person is the one signed in. */
const IMPERSONATE_COOKIE = "lc_as";

/**
 * Super admin: log in as this person (owner, 2026-10-14). The admin's own login ends; the new login is marked as the
 * admin's in Admin › Sign-ins, never counts toward the person's devices, and ends on its own after
 * security.impersonate_minutes. A bar on every page says whose account this is, with "Back to admin".
 */
export async function impersonateUser(userId: string): Promise<Result> {
  const owner = await superAdmin();
  const u = owner ? await target(userId) : null;
  if (!owner || !u) return fail("auth.errors.generic");
  const db = createAdminClient();
  const { data: auth } = await db.auth.admin.getUserById(u.id);
  const email = auth?.user?.email;
  if (!email) return fail("admin.security.errors.noEmail");
  const { data: link, error: linkError } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError || !link?.properties?.hashed_token) return fail("auth.errors.generic");
  await audit(owner.id, "impersonate_user", "user", u.id, {});
  // The admin's own login ends here; the person's begins in this browser.
  await markLoggedOut();
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  const { data: verified, error } = await supabase.auth.verifyOtp({ type: "email", token_hash: link.properties.hashed_token });
  if (error || !verified.session) return fail("auth.errors.generic");
  const claims = JSON.parse(Buffer.from(verified.session.access_token.split(".")[1], "base64url").toString("utf8")) as { session_id?: string };
  if (claims.session_id) {
    await db.from("user_sessions").upsert({ id: claims.session_id, user_id: u.id, impersonated_by: owner.id, device: null }, { onConflict: "id" });
  }
  (await cookies()).set(IMPERSONATE_COOKIE, `${u.id}|${u.name.slice(0, 60)}`, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 4 });
  redirect(homeForRole(u.role));
}

/** "Back to admin": the person's login ends and the admin signs in again. */
export async function endImpersonation(): Promise<void> {
  const id = await currentSessionId();
  if (id) await endSessions([id], "logout");
  await (await createClient()).auth.signOut({ scope: "local" });
  (await cookies()).delete(IMPERSONATE_COOKIE);
  redirect("/admin-login");
}
