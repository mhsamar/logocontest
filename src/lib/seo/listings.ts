import "server-only";
import { unstable_cache } from "next/cache";
import { PUBLIC_STATUSES } from "@/lib/contests/public-statuses";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Whether the public lists have anything in them (owner, 2026-10-21): an empty list is a thin page, so it stays out of
 * search engines and the sitemap until it fills up. Counted at most every 10 minutes.
 */
export const listingCounts = unstable_cache(
  async (): Promise<{ contests: number; winners: number; designs: number }> => {
    if (!isSupabaseConfigured()) return { contests: 0, winners: 0, designs: 0 };
    const db = createAdminClient();
    const statuses = [...PUBLIC_STATUSES];
    const [contests, winners, designs] = await Promise.all([
      db.from("contests").select("id", { count: "exact", head: true }).in("status", statuses).eq("is_private", false).is("deleted_at", null),
      db
        .from("entries")
        .select("id, contest:contests!contest_id!inner(is_private, is_nda, deleted_at)", { count: "exact", head: true })
        .eq("status", "winner")
        .eq("contest.is_private", false)
        .eq("contest.is_nda", false)
        .is("contest.deleted_at", null),
      db
        .from("entries")
        .select("id, contest:contests!contest_id!inner(is_private, is_blind, is_nda, status, deleted_at)", { count: "exact", head: true })
        .in("status", ["active", "winner"])
        .eq("contest.is_private", false)
        .eq("contest.is_blind", false)
        .eq("contest.is_nda", false)
        .in("contest.status", statuses)
        .is("contest.deleted_at", null),
    ]);
    return { contests: contests.count ?? 0, winners: winners.count ?? 0, designs: designs.count ?? 0 };
  },
  ["seo-listing-counts"],
  { revalidate: 600 },
);
