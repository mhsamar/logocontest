import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { memberUsername, memberUsernameAlt, usernameBase, usernameCandidates } from "./username-rules";

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

/** A free username made from the person's name only (used before migration 0065 gives accounts a number). */
async function nameOnlyUsername(name: string, role: "client" | "designer"): Promise<string> {
  for (const u of usernameCandidates(name, role)) if (!(await usernameTaken(u))) return u;
  return `${role}_${Date.now().toString().slice(-8)}`;
}

/**
 * Gives a new account its number and its username (owner, 2026-10-17): first name + number, e.g. anika010. The
 * database hands out the numbers one at a time per group (clients, designers), so two sign-ups never share one.
 * Call it after the profile has its final role. Returns the username saved.
 */
export async function assignUsername(profileId: string, name: string, role: "client" | "designer"): Promise<string> {
  const db = createAdminClient();
  const { data: no, error } = await db.rpc("assign_member_no", { p_profile: profileId });
  const base = usernameBase(name, role);
  let username: string;
  if (error || typeof no !== "number") {
    console.error("[usernames] no account number:", error?.message ?? "none");
    username = await nameOnlyUsername(name, role);
  } else {
    username = memberUsername(base, no);
    if (await usernameTaken(username, profileId)) username = memberUsernameAlt(base, no, role);
  }
  const { error: saveError } = await db.from("profiles").update({ username }).eq("id", profileId);
  if (saveError) throw new Error(saveError.message);
  return username;
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
