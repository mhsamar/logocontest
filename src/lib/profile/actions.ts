"use server";

import { randomUUID } from "node:crypto";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { sendVerificationEmail } from "@/lib/auth/email-service";
import { normalizeEmail } from "@/lib/auth/identity";
import { clientIp } from "@/lib/auth/services";
import { getCurrentUser } from "@/lib/auth/session";
import { findProfileByEmail, findProfileByPhone, passwordError } from "@/lib/auth/sign-in";
import { blockedTerms } from "@/lib/contests/community";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import { findContactDetails } from "@/lib/moderation/contact-filter";
import { getImageModerator } from "@/lib/moderation/images";
import { normalizeBdMobile } from "@/lib/phone";
import { getSetting } from "@/lib/settings";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { checkPayout, type PayoutInput } from "@/lib/designers/signup";
import { AVATAR_TYPES, AVATARS_BUCKET } from "./avatar";

/** D-12 / C-20 profile settings (UI-JOURNEY, owner 2026-10-08). */

export type SettingsState = { status: "idle" | "ok" | "error"; field?: string; error?: { key: MessageKey; params?: MessageParams } };

const fail = (key: MessageKey, field?: string, params?: MessageParams): SettingsState => ({ status: "error", field, error: { key, params } });

async function me() {
  const user = await getCurrentUser();
  return user && user.status !== "banned" ? user : null;
}

/** Name, bio (designers) and business name (clients). */
export async function updateProfile(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await me();
  if (!user) return fail("auth.errors.generic");
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 60) return fail("designerSignup.errors.name", "name");
  const update: Record<string, string | null> = { name };

  if (user.role === "designer") {
    const bio = String(formData.get("bio") ?? "").trim();
    const max = await getSetting("limits.designer_bio_max_length");
    if (bio.length > max) return fail("designerSignup.errors.bioLong", "bio", { max });
    if (bio && findContactDetails(bio, await blockedTerms())) return fail("contest.comments.contact", "bio");
    update.bio = bio || null;
  } else if (user.role === "client") {
    const business = String(formData.get("businessName") ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
    update.business_name = business || null;
  }

  const { error } = await createAdminClient().from("profiles").update(update).eq("id", user.id);
  if (error) return fail("auth.errors.generic");
  refresh();
  return { status: "ok" };
}

/** Photo step 1: a one-time upload URL (the browser uploads straight to storage). */
export async function prepareAvatarUpload(input: { type: string; size: number }): Promise<{ ok: true; path: string; token: string } | { ok: false; error: { key: MessageKey; params?: MessageParams } }> {
  const user = await me();
  if (!user) return { ok: false, error: { key: "auth.errors.generic" } };
  const ext = AVATAR_TYPES[input.type];
  if (!ext) return { ok: false, error: { key: "settings.photo.type" } };
  const mb = await getSetting("limits.avatar_max_mb");
  if (input.size <= 0 || input.size > mb * 1024 * 1024) return { ok: false, error: { key: "settings.photo.size", params: { mb } } };
  const upload = await getFileStorage().createUploadUrl(AVATARS_BUCKET, `${user.id}/${randomUUID()}.${ext}`);
  return { ok: true, ...upload };
}

/**
 * Photo step 2: checks the upload (path, nudity) and makes it the profile
 * photo. A refused photo is deleted at once; the old photo is deleted on success.
 */
export async function saveAvatar(path: string): Promise<{ ok: true } | { ok: false; error: { key: MessageKey } }> {
  const user = await me();
  const generic = { ok: false as const, error: { key: "auth.errors.generic" as MessageKey } };
  if (!user) return generic;
  const match = new RegExp(`^${user.id}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).exec(path);
  if (!match) return generic;
  const storage = getFileStorage();
  if (!(await storage.exists(AVATARS_BUCKET, path))) return generic;

  const mime = Object.entries(AVATAR_TYPES).find(([, ext]) => ext === match[1])![0];
  const verdict = await getImageModerator().check(await storage.download(AVATARS_BUCKET, path), mime);
  if (!verdict.allowed) {
    await storage.remove(AVATARS_BUCKET, [path]).catch(() => {});
    return { ok: false, error: { key: verdict.reason === "error" ? "settings.photo.checkFailed" : "settings.photo.notAllowed" } };
  }

  const db = createAdminClient();
  const { data: old } = await db.from("profiles").select("avatar_path").eq("id", user.id).single();
  const { error } = await db.from("profiles").update({ avatar_path: path }).eq("id", user.id);
  if (error) return generic;
  if (old?.avatar_path && old.avatar_path !== path) await storage.remove(AVATARS_BUCKET, [old.avatar_path]).catch(() => {});
  refresh();
  return { ok: true };
}

export async function removeAvatar(): Promise<boolean> {
  const user = await me();
  if (!user) return false;
  const db = createAdminClient();
  const { data: old } = await db.from("profiles").select("avatar_path").eq("id", user.id).single();
  await db.from("profiles").update({ avatar_path: null }).eq("id", user.id);
  if (old?.avatar_path) await getFileStorage().remove(AVATARS_BUCKET, [old.avatar_path]).catch(() => {});
  refresh();
  return true;
}

/** Mobile number: Bangladesh format, not used by another account (no OTP, BLUEPRINT §4). */
export async function changeMobile(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await me();
  if (!user) return fail("auth.errors.generic");
  const mobile = normalizeBdMobile(String(formData.get("mobile") ?? ""));
  if (!mobile) return fail("auth.errors.invalidPhone", "mobile");
  if (mobile === user.mobile) return { status: "ok" };
  if (await findProfileByPhone(mobile)) return fail("settings.mobile.taken", "mobile");
  const { error } = await createAdminClient().from("profiles").update({ mobile }).eq("id", user.id);
  if (error) return fail(/duplicate|unique/i.test(error.message) ? "settings.mobile.taken" : "auth.errors.generic", "mobile");
  refresh();
  return { status: "ok" };
}

/** Email: updates the login email too, then asks for the 6-digit code again. */
export async function changeEmail(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await me();
  if (!user) return fail("auth.errors.generic");
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) return fail("wizard.errors.email", "email");
  if (email === user.email) return { status: "ok" };
  if (await findProfileByEmail(email)) return fail("settings.email.taken", "email");

  const admin = createAdminClient();
  // Log-in uses the auth email, so change it first; the profile follows.
  const { error: authError } = await admin.auth.admin.updateUserById(user.id, { email, email_confirm: true });
  if (authError) return fail(/already|exists|registered/i.test(authError.message) ? "wizard.errors.emailTaken" : "auth.errors.generic", "email");
  const { error } = await admin.from("profiles").update({ email, email_verified_at: null }).eq("id", user.id);
  if (error) return fail("auth.errors.generic", "email");

  const { locale } = await getI18n();
  await sendVerificationEmail({ userId: user.id, email, name: user.name, locale, ip: await clientIp() }).catch((e) =>
    console.error("[auth] code email failed:", e),
  );
  refresh();
  return { status: "ok" };
}

/** Password: the current one is checked first, without touching this browser's session. */
export async function changePassword(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await me();
  if (!user) return fail("auth.errors.generic");
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("password") ?? "");
  if (!current) return fail("settings.password.wrong", "current");
  const tooShort = await passwordError(next);
  if (tooShort?.error) return { status: "error", field: "password", error: tooShort.error };
  if (current === next) return fail("auth.errors.samePassword", "password");

  const admin = createAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(user.id);
  const authEmail = authUser.user?.email;
  if (!authEmail) return fail("auth.errors.generic");
  const checker = createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: wrong } = await checker.auth.signInWithPassword({ email: authEmail, password: current });
  if (wrong) return fail("settings.password.wrong", "current");
  // No signOut here: its default "global" scope would also log this browser out. The checker keeps nothing.

  // Through the user's own session: the admin API would log out every session, this browser included.
  const { error } = await (await createServerClient()).auth.updateUser({ password: next });
  if (error) return /different|same/i.test(error.message) ? fail("auth.errors.samePassword", "password") : fail("auth.errors.generic", "password");
  return { status: "ok" };
}

/** Designers: where winnings are paid (bKash or bank), same rules as sign-up (D-01 step 4). */
export async function updatePayout(input: PayoutInput): Promise<SettingsState> {
  const user = await me();
  if (!user || user.role !== "designer") return fail("auth.errors.generic");
  const checked = checkPayout(input);
  if (!checked.ok) return fail(`designerSignup.payout.errors.${checked.field}`, checked.field);
  const db = createAdminClient();
  // One payout method per designer for now: replace the default row.
  const empty = { bkash_number: null, bank_name: null, branch: null, account_name: null, account_number: null, routing_number: null };
  const row: Record<string, string | boolean | null> = { ...empty, ...checked.payout, user_id: user.id, is_default: true };
  const { data: existing } = await db.from("designer_payout_methods").select("id").eq("user_id", user.id).eq("is_default", true).maybeSingle();
  const { error } = existing
    ? await db.from("designer_payout_methods").update(row).eq("id", existing.id)
    : await db.from("designer_payout_methods").insert(row);
  if (error) return fail("auth.errors.generic");
  refresh();
  return { status: "ok" };
}
