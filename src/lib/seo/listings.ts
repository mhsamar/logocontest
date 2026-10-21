import "server-only";
import { unstable_cache } from "next/cache";
import { PUBLIC_STATUSES } from "@/lib/contests/public-statuses";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Whether the public lists have anything in them (owner, 2026-10-21): an empty list is a thin page, so it stays out of
 * search engines and the sitemap until it fills up. Each count follows the same rules as its list (the winners
 * gallery shows completed contests, blind ones only once the winner is public; the Studio leaves out designs a Pro
 * designer hid until the winner is picked). Counted at most every 10 minutes; a failed count throws, so it is never
 * remembered as "empty" (callers then treat the list as not empty).
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
        .select("id, contest:contests!contest_id!inner(is_blind, winner_is_public)")
        .eq("status", "winner")
        .eq("contest.status", "completed")
        .eq("contest.is_private", false)
        .eq("contest.is_nda", false)
        .is("contest.deleted_at", null)
        .limit(50),
      db
        .from("entries")
        .select("id, is_hidden, contest:contests!contest_id!inner(status)")
        .in("status", ["active", "winner"])
        .eq("contest.is_private", false)
        .eq("contest.is_blind", false)
        .eq("contest.is_nda", false)
        .in("contest.status", statuses)
        .is("contest.deleted_at", null)
        .limit(200),
    ]);
    const failed = [contests, winners, designs].find((r) => r.error);
    if (failed) throw new Error(`listing counts: ${failed.error!.message}`);
    const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
    const shownWinners = (winners.data ?? []).filter((r) => {
      const c = one(r.contest as { is_blind: boolean; winner_is_public: boolean } | { is_blind: boolean; winner_is_public: boolean }[] | null);
      return c && (!c.is_blind || c.winner_is_public);
    }).length;
    const shownDesigns = (designs.data ?? []).filter((r) => {
      const c = one(r.contest as { status: string } | { status: string }[] | null);
      return !r.is_hidden || (c && !["open", "judging"].includes(c.status));
    }).length;
    return { contests: contests.count ?? 0, winners: shownWinners, designs: shownDesigns };
  },
  ["seo-listing-counts-v2"],
  { revalidate: 600 },
);

/** The counts, or null when they couldn't be read (then nothing is hidden because of them). */
export const safeListingCounts = () => listingCounts().catch((e) => (console.error("[seo]", e instanceof Error ? e.message : e), null));
