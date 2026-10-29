import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCompletion, type BriefCompletion, type BriefSection } from "./brief-defaults";

/** A v2 contest's mark as stored, or null (old wizard, or before migration 0079). */
export async function readCompletion(contestId: string): Promise<BriefCompletion | null> {
  const { data } = await createAdminClient().from("contests").select("brief_completion").eq("id", contestId).maybeSingle();
  return parseCompletion(data?.brief_completion);
}

/** The client changed these parts of a v2 contest's brief: designers no longer see them as defaults. */
export async function markEdited(contestId: string, sections: BriefSection[]): Promise<BriefCompletion | null> {
  if (!sections.length) return readCompletion(contestId);
  const now = await readCompletion(contestId);
  if (!now) return null;
  const next: BriefCompletion = { ...now, edited: [...new Set([...now.edited, ...sections])] };
  const { error } = await createAdminClient().from("contests").update({ brief_completion: next }).eq("id", contestId);
  if (error) console.error("[onboarding-v2] brief edited:", error.message);
  return next;
}

/** "Keep it like this" (spec §3): the brief as it is now is the client's, so no more brief reminders. */
export async function acceptBrief(contestId: string): Promise<BriefCompletion | null> {
  const now = await readCompletion(contestId);
  if (!now) return null;
  if (now.acceptedAt) return now;
  const next: BriefCompletion = { ...now, acceptedAt: new Date().toISOString() };
  const { error } = await createAdminClient().from("contests").update({ brief_completion: next }).eq("id", contestId);
  if (error) console.error("[onboarding-v2] brief accepted:", error.message);
  return next;
}
