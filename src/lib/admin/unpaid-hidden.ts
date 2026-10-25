import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Drafts closed as fake with "Hide the draft from all lists" (Unpaid contests, owner 2026-10-25): left out of the
 * admin lists and counts of unpaid drafts. They stay in Unpaid › Fake · closed. Before migration 0076: none.
 */
export async function hiddenUnpaidIds(): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await createAdminClient().from("unpaid_leads").select("contest_id").eq("hidden", true).not("contest_id", "is", null).limit(1000);
  return error ? [] : (data ?? []).map((r) => r.contest_id as string);
}

/** A PostgREST "not in" list of ids, or null when there are none. */
export const notIn = (ids: string[]) => (ids.length ? `(${ids.join(",")})` : null);
