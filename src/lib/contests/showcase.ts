import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { contestsByIds, liveContests, type ContestRow } from "./browse";

/**
 * Home page section 2 (BLUEPRINT §14): the winning logos an admin picked (A-09, in their order),
 * or live contests until there are any. Only real rows, never sample data.
 */
export async function getHomeShowcase(limit: number): Promise<{ kind: "winners" | "live"; contests: ContestRow[] }> {
  if (isSupabaseConfigured()) {
    const { data } = await createAdminClient().from("featured_logos").select("position, entry:entries!entry_id(contest_id)").order("position").limit(limit);
    const ids = (data ?? []).map((r) => (Array.isArray(r.entry) ? r.entry[0] : r.entry)?.contest_id as string | undefined).filter((x): x is string => Boolean(x));
    if (ids.length) {
      const rows = await contestsByIds([...new Set(ids)]);
      const byId = new Map(rows.map((c) => [c.id, c]));
      const ordered = [...new Set(ids)].map((id) => byId.get(id)).filter((c): c is ContestRow => Boolean(c));
      if (ordered.length) return { kind: "winners", contests: ordered };
    }
  }
  return { kind: "live", contests: await liveContests(limit) };
}
