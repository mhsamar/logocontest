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
    .select("id, mobile, name, role, status, locale, email, email_verified_at, username, avatar_path")
    .eq("id", data.user.id)
    .maybeSingle<Omit<CurrentUser, "emailVerifiedAt" | "avatarUrl"> & { email_verified_at: string | null; avatar_path: string | null }>();
  if (!profile) return null;
  const { email_verified_at, avatar_path, ...rest } = profile;
  return { ...rest, emailVerifiedAt: email_verified_at, avatarUrl: avatarUrl(avatar_path) };
});

/** Throws a 404 when the current user may not do this, so hidden pages stay hidden. */
export async function authorize(ability: Ability): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!can(user, ability)) notFound();
  return user!;
}
