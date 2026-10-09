"use server";

import { refresh } from "next/cache";
import { normalizeEmail } from "@/lib/auth/identity";
import type { MessageKey } from "@/lib/i18n/translate";
import { normalizeBdMobile } from "@/lib/phone";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, superAdmin, UUID } from "./core";
import { cleanPermissions } from "./permissions";

export type TeamResult = { ok: true } | { ok: false; error: MessageKey; field?: string };
const fail = (error: MessageKey, field?: string): TeamResult => ({ ok: false, error, field });

const cleanTitle = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 40) : "");

/** A-23 Add admin (Super admin only): a new staff account with a title and permissions. */
export async function createStaff(input: { name: string; mobile: string; email: string; password: string; title: string; permissions: string[] }): Promise<TeamResult> {
  const owner = await superAdmin();
  if (!owner) return fail("auth.errors.generic");
  const name = input.name.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 60) return fail("admin.team.errors.name", "name");
  const mobile = normalizeBdMobile(input.mobile);
  if (!mobile) return fail("admin.team.errors.mobile", "mobile");
  const email = normalizeEmail(input.email);
  if (!email) return fail("admin.team.errors.email", "email");
  const min = await getSetting("auth.password_min_length");
  if (input.password.length < min || input.password.length > 72) return fail("admin.team.errors.password", "password");
  const permissions = cleanPermissions(input.permissions);
  if (!permissions.length) return fail("admin.team.errors.permissions", "permissions");

  const db = createAdminClient();
  const [{ data: byMobile }, { data: byEmail }] = await Promise.all([
    db.from("profiles").select("id").eq("mobile", mobile).maybeSingle(),
    db.from("profiles").select("id").ilike("email", email).maybeSingle(),
  ]);
  if (byMobile) return fail("admin.team.errors.mobileUsed", "mobile");
  if (byEmail) return fail("admin.team.errors.emailUsed", "email");

  const created = await db.auth.admin.createUser({ email, password: input.password, email_confirm: true, user_metadata: { mobile, name, email } });
  if (created.error || !created.data.user) return fail("admin.team.errors.create");
  const id = created.data.user.id;
  const { error } = await db
    .from("profiles")
    .update({ role: "admin", status: "active", name, email, is_super_admin: false, admin_active: true, admin_title: cleanTitle(input.title) || null, admin_permissions: permissions, email_verified_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    await db.auth.admin.deleteUser(id).catch(() => {});
    return fail("admin.team.errors.create");
  }
  await audit(owner.id, "create_staff", "profile", id, { name, title: cleanTitle(input.title), permissions });
  refresh();
  return { ok: true };
}

async function staffRow(id: string) {
  if (!UUID.test(id)) return null;
  const { data } = await createAdminClient().from("profiles").select("id, role, is_super_admin, admin_permissions, admin_title, admin_active").eq("id", id).maybeSingle();
  return data && data.role === "admin" && !data.is_super_admin ? data : null;
}

/** A-23 Edit: title, permissions and (optionally) a new password. The Super admin can't be edited here. */
export async function updateStaff(id: string, input: { title: string; permissions: string[]; password?: string }): Promise<TeamResult> {
  const owner = await superAdmin();
  const row = owner && (await staffRow(id));
  if (!owner || !row) return fail("auth.errors.generic");
  const permissions = cleanPermissions(input.permissions);
  if (!permissions.length) return fail("admin.team.errors.permissions", "permissions");
  const db = createAdminClient();
  if (input.password) {
    const min = await getSetting("auth.password_min_length");
    if (input.password.length < min || input.password.length > 72) return fail("admin.team.errors.password", "password");
    const { error } = await db.auth.admin.updateUserById(id, { password: input.password });
    if (error) return fail("admin.errors.generic");
  }
  const title = cleanTitle(input.title) || null;
  const { error } = await db.from("profiles").update({ admin_title: title, admin_permissions: permissions }).eq("id", id);
  if (error) return fail("admin.errors.generic");
  await audit(owner.id, "update_staff", "profile", id, { from: { title: row.admin_title, permissions: row.admin_permissions }, to: { title, permissions }, password: !!input.password });
  refresh();
  return { ok: true };
}

/** A-23 Switch a staff admin off (they lose the admin panel at once) or back on. */
export async function setStaffActive(id: string, active: boolean): Promise<TeamResult> {
  const owner = await superAdmin();
  const row = owner && (await staffRow(id));
  if (!owner || !row) return fail("auth.errors.generic");
  const { error } = await createAdminClient().from("profiles").update({ admin_active: active }).eq("id", id);
  if (error) return fail("admin.errors.generic");
  await audit(owner.id, active ? "staff_on" : "staff_off", "profile", id);
  refresh();
  return { ok: true };
}
