import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin → Homepage, "Home showcase" (owner, 2026-11-20): the contests the team can pin or switch off, and the designs
 * hidden from home. Only contests the showcase could ever use are listed: public, never blind, private or NDA, never
 * a test client's, logo contests.
 */

export type ShowcaseContestRow = { id: string; slug: string; brand: string; status: string; homeShow: boolean; createdAt: string };

export async function showcaseContestRows(limit = 60): Promise<ShowcaseContestRow[]> {
  const { data, error } = await createAdminClient()
    .from("contests")
    .select("id, slug, brand_name, status, home_show, service, created_at, owner:profiles!client_id!inner(is_test)")
    .in("status", ["open", "judging", "winner_selected", "handover", "completed", "no_result"])
    .eq("is_private", false)
    .eq("is_nda", false)
    .eq("is_blind", false)
    .eq("owner.is_test", false)
    .order("created_at", { ascending: false })
    .limit(limit * 2);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((r) => ((r.service as string | null) ?? "logo") === "logo")
    .slice(0, limit)
    .map((r) => ({ id: r.id as string, slug: r.slug as string, brand: r.brand_name as string, status: r.status as string, homeShow: r.home_show !== false, createdAt: r.created_at as string }));
}

/** Designs the team hid from home, newest first. */
export async function homeHiddenEntryIds(limit = 60): Promise<string[]> {
  const { data, error } = await createAdminClient().from("entries").select("id").eq("home_hidden", true).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.id as string);
}
