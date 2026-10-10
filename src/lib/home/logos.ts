import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { winningDesigns } from "@/lib/rewards/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { pickLogos } from "./logo-pick";

/**
 * Real winning logos for the home page's logo tiles (owner, 2026-10-10): the ones an admin chose in
 * Homepage (A-09) first, in their order, then the newest public winners. Only designs whose winner
 * is public; tiles without a real logo keep the design's placeholders.
 */
export async function homeLogos(limit = 12): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const { data } = await createAdminClient().from("featured_logos").select("entry_id").order("position").limit(limit);
  const featuredIds = (data ?? []).map((r) => r.entry_id as string);
  const [featured, newest] = await Promise.all([
    featuredIds.length ? winningDesigns({ entryIds: featuredIds, limit }) : Promise.resolve([]),
    winningDesigns({ order: "newest", limit }),
  ]);
  return pickLogos(featuredIds, featured, newest, limit);
}
