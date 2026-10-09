import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { avatarUrl } from "@/lib/profile/avatar";
import { can, type Ability, type CurrentUser } from "./policies";

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, mobile, name, role, status, locale, email, email_verified_at, username, avatar_path, is_super_admin, admin_active, admin_permissions, admin_title")
    .eq("id", data.user.id)
    .maybeSingle<
      Omit<CurrentUser, "emailVerifiedAt" | "avatarUrl" | "isSuperAdmin" | "adminActive" | "adminPermissions" | "adminTitle"> & {
        email_verified_at: string | null;
        avatar_path: string | null;
        is_super_admin: boolean | null;
        admin_active: boolean | null;
        admin_permissions: string[] | null;
        admin_title: string | null;
      }
    >();
  if (!profile) return null;
  const { email_verified_at, avatar_path, is_super_admin, admin_active, admin_permissions, admin_title, ...rest } = profile;
  return {
    ...rest,
    emailVerifiedAt: email_verified_at,
    avatarUrl: avatarUrl(avatar_path),
    isSuperAdmin: !!is_super_admin,
    adminActive: admin_active !== false,
    adminPermissions: admin_permissions ?? [],
    adminTitle: admin_title,
  };
});

/** Throws a 404 when the current user may not do this, so hidden pages stay hidden. */
export async function authorize(ability: Ability): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!can(user, ability)) notFound();
  return user!;
}
