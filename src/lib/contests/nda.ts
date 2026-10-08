import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * NDA / Confidential add-on (BLUEPRINT §7.4, owner 2026-10-08): designers must accept a
 * confidentiality agreement before they can read the brief, see the designs, comment or submit.
 */
export async function hasAcceptedNda(contestId: string, userId: string): Promise<boolean> {
  const { count } = await createAdminClient().from("nda_acceptances").select("contest_id", { count: "exact", head: true }).eq("contest_id", contestId).eq("user_id", userId);
  return (count ?? 0) > 0;
}

/** Whether this user may see an NDA contest's brief and designs: the client, admins, or a designer who accepted. */
export async function passesNda(contest: { id: string; isNda: boolean; ownerId: string }, user: { id: string; role: string } | null): Promise<boolean> {
  if (!contest.isNda) return true;
  if (!user) return false;
  if (user.id === contest.ownerId || user.role === "admin") return true;
  return hasAcceptedNda(contest.id, user.id);
}
