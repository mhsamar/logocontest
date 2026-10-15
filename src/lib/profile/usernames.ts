import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { usernameCandidates } from "./username-rules";

/** Taken by someone now, or once used by someone (kept for old links, migration 0063). */
export async function usernameTaken(username: string, exceptProfileId?: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const db = createAdminClient();
  const u = username.toLowerCase();
  const [{ data: now }, past] = await Promise.all([
    db.from("profiles").select("id").eq("username", u).maybeSingle(),
    db.from("username_history").select("profile_id").eq("old_username", u).maybeSingle(),
  ]);
  if (now && now.id !== exceptProfileId) return true;
  // Before migration 0063 the history table is missing: only current usernames count.
  return Boolean(!past.error && past.data && past.data.profile_id !== exceptProfileId);
}

/** A free username for a new account, made from the person's name (owner, 2026-10-15). */
export async function uniqueUsername(name: string, role: "client" | "designer"): Promise<string> {
  for (const u of usernameCandidates(name, role)) if (!(await usernameTaken(u))) return u;
  return `${role}_${Date.now().toString().slice(-8)}`;
}

/** Who an old username now belongs to (for old profile links and Designer IDs). */
export async function currentUsernameFor(oldUsername: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const db = createAdminClient();
  const { data, error } = await db.from("username_history").select("profile_id").eq("old_username", oldUsername.toLowerCase()).maybeSingle();
  if (error || !data) return null;
  const { data: p } = await db.from("profiles").select("username").eq("id", data.profile_id).maybeSingle();
  return (p?.username as string | null) ?? null;
}
