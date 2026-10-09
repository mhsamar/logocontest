import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/** Like counts for designs, and which of them the viewer liked. */
export async function likesFor(entryIds: string[], viewerId: string | null): Promise<{ counts: Map<string, number>; mine: Set<string> }> {
  const counts = new Map<string, number>();
  const mine = new Set<string>();
  if (!isSupabaseConfigured() || !entryIds.length) return { counts, mine };
  const { data } = await createAdminClient().from("design_likes").select("entry_id, user_id").in("entry_id", entryIds);
  for (const r of data ?? []) {
    counts.set(r.entry_id as string, (counts.get(r.entry_id as string) ?? 0) + 1);
    if (viewerId && r.user_id === viewerId) mine.add(r.entry_id as string);
  }
  return { counts, mine };
}

