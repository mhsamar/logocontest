import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { avatarUrl } from "@/lib/profile/avatar";
import { can, type Ability, type CurrentUser } from "./policies";

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  // The login's signature is checked on the server itself, with Supabase's public key (owner, 2026-10-28: getUser asked
  // Supabase Auth over the network on every signed-in request). A login that was ended (signed out, password reset,
  // device limit, an admin) is refused at once from its row in user_sessions, read together with the profile.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  if (!userId) return null;
  const sessionId = data?.claims?.session_id as string | undefined;

  const [{ data: profile }, ended] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, mobile, name, role, status, suspended_until, locale, email, email_verified_at, username, avatar_path, is_super_admin, admin_active, admin_permissions, admin_title")
      .eq("id", userId)
      .maybeSingle<
        Omit<CurrentUser, "emailVerifiedAt" | "avatarUrl" | "isSuperAdmin" | "adminActive" | "adminPermissions" | "adminTitle" | "suspendedUntil"> & {
          suspended_until: string | null;
          email_verified_at: string | null;
          avatar_path: string | null;
          is_super_admin: boolean | null;
          admin_active: boolean | null;
          admin_permissions: string[] | null;
          admin_title: string | null;
        }
      >(),
    // No row yet (a login that never opened a page) counts as open, as before migration 0055.
    sessionId
      ? createAdminClient()
          .from("user_sessions")
          .select("ended_at")
          .eq("id", sessionId)
          .maybeSingle()
          .then(
            (r) => Boolean(r.data?.ended_at),
            () => false,
          )
      : false,
  ]);
  if (ended) return null;
  // A deleted account (Admin › Trash, owner 2026-10-14) is signed out everywhere.
  if (!profile || (profile.status as string) === "deleted") return null;
  const { suspended_until, email_verified_at, avatar_path, is_super_admin, admin_active, admin_permissions, admin_title, ...rest } = profile;
  // A suspension ends on its own (owner, 2026-10-12): once its time is up the account is active again, even before
  // the lifecycle job writes it back.
  const over = rest.status === "suspended" && suspended_until !== null && new Date(suspended_until).getTime() <= Date.now();
  return {
    ...rest,
    status: over ? "active" : rest.status,
    suspendedUntil: rest.status === "suspended" && !over ? suspended_until : null,
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
