import "server-only";
import { addonPrices } from "@/lib/contests/addon-payments";
import { addonsFreeFor } from "@/lib/contests/pricing";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { pickUpsell, type Upsell, type UpsellContest } from "./upsell-rules";

/** Today's pop-up for this client (owner, 2026-11-02): see upsell-rules.ts. Never throws. */
export async function upsellFor(clientId: string, now: Date = new Date()): Promise<Upsell | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const db = createAdminClient();
    const { data } = await db
      .from("contests")
      .select("id, slug, brand_name, prize_amount, status, ends_at, is_promoted, is_urgent, is_highlighted")
      .eq("client_id", clientId)
      .in("status", ["open", "judging", "winner_selected", "handover"])
      .is("deleted_at", null)
      .order("ends_at", { ascending: true })
      .limit(10);
    const rows = data ?? [];
    if (!rows.length) return null;
    const ids = rows.map((c) => c.id as string);
    const [unrated, handovers, prices] = await Promise.all([
      db.from("entries").select("contest_id").in("contest_id", ids).eq("status", "active").is("rating", null),
      db.from("handovers").select("contest_id").in("contest_id", ids).eq("status", "submitted"),
      addonPrices(),
    ]);
    const unratedBy = new Map<string, number>();
    for (const e of unrated.data ?? []) unratedBy.set(e.contest_id as string, (unratedBy.get(e.contest_id as string) ?? 0) + 1);
    const ready = new Set((handovers.data ?? []).map((h) => h.contest_id as string));
    const contests: UpsellContest[] = rows.map((c) => ({
      id: c.id as string,
      slug: c.slug as string,
      brand: (c.brand_name as string) ?? "",
      prize: (c.prize_amount as number) ?? 0,
      status: c.status as string,
      endsAt: c.ends_at ? new Date(c.ends_at as string) : null,
      active: { promote: Boolean(c.is_promoted), urgent: Boolean(c.is_urgent), highlight: Boolean(c.is_highlighted) },
      unrated: unratedBy.get(c.id as string) ?? 0,
      filesReady: ready.has(c.id as string),
    }));
    return pickUpsell(contests, prices, (prize) => addonsFreeFor(prize, { addonsFreeFrom: prices.allFreeFrom }), now);
  } catch {
    return null;
  }
}
