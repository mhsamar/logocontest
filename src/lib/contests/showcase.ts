import "server-only";
import type { ContestCardData } from "@/components/contests/contest-card";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BusinessType } from "./brief";

/**
 * Home page section 2 (BLUEPRINT §14): recent winning logos, or live contests
 * until real winners exist. Only real rows — never sample data.
 * TODO(milestone 4/7): winners need entries and completed handovers.
 */
export async function getHomeShowcase(limit: number): Promise<{ kind: "winners" | "live"; contests: ContestCardData[] }> {
  if (!isSupabaseConfigured()) return { kind: "live", contests: [] };

  const { data, error } = await createAdminClient()
    .from("contests")
    .select("slug, brand_name, business_type, prize_amount, ends_at, is_blind, is_private, is_promoted")
    .eq("status", "open")
    .order("is_promoted", { ascending: false })
    .order("starts_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  return {
    kind: "live",
    contests: (data ?? []).map((r) => ({
      slug: r.slug,
      // Private contests never expose their name on public pages.
      brandName: r.is_private ? "" : r.brand_name,
      businessType: r.business_type as BusinessType,
      prize: r.prize_amount,
      endsAt: new Date(r.ends_at),
      isBlind: r.is_blind,
      isPrivate: r.is_private,
      isPromoted: r.is_promoted,
    })),
  };
}
