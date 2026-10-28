import "server-only";
import { revalidateTag, unstable_cache, updateTag } from "next/cache";
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
  return cachedLogos(limit);
}

export const HOME_LOGOS_TAG = "home-logos";

/** Every change to the featured logos calls this, so the home page shows it at once. */
export function homeLogosChanged() {
  try {
    updateTag(HOME_LOGOS_TAG);
  } catch {
    revalidateTag(HOME_LOGOS_TAG, "max");
  }
}

// The same for every visitor, so kept for 5 minutes (owner, 2026-10-28: it was rebuilt on every home page view). The
// picture links inside last 12 to 24 hours.
const cachedLogos = unstable_cache((limit: number) => loadLogos(limit), ["home-logos-v1"], { tags: [HOME_LOGOS_TAG], revalidate: 300 });

async function loadLogos(limit: number): Promise<string[]> {
  const { data } = await createAdminClient().from("featured_logos").select("entry_id").order("position").limit(limit);
  const featuredIds = (data ?? []).map((r) => r.entry_id as string);
  const [featured, newest] = await Promise.all([
    featuredIds.length ? winningDesigns({ entryIds: featuredIds, limit }) : Promise.resolve([]),
    winningDesigns({ limit }),
  ]);
  return pickLogos(featuredIds, featured, newest, limit);
}
