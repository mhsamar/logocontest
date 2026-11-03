import "server-only";
import { cache } from "react";
import type { BusinessType } from "@/lib/contests/brief";
import { isShareableDesign, type EntryStatus } from "@/lib/entries/rules";
import { isSupabaseConfigured } from "@/lib/env";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";

export type IndustryExample = { url: string; brand: string; number: number; designer: string | null; winner: boolean; href: string };

type Row = {
  number: number;
  status: EntryStatus;
  is_hidden: boolean | null;
  designer: { username: string | null } | { username: string | null }[] | null;
  contest: { slug: string; brand_name: string; status: string; is_private: boolean; is_nda: boolean; is_blind: boolean; winner_is_public: boolean } | null;
  images: { position: number; preview_path: string }[] | null;
};

/**
 * Real designs for a business page (owner, 2026-11-03): public designs sent to contests of this business type, winners
 * first, one per contest so one brand doesn't fill the page, each linked to its contest. Never a private, NDA, blind,
 * hidden or test client's design. The pictures get addresses that never change, so they can be found in Google Images.
 */
export const industryExamples = cache(async (type: BusinessType, limit = 8): Promise<IndustryExample[]> => {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await createAdminClient()
    .from("entries")
    .select(
      "number, status, is_hidden, designer:profiles!designer_id(username), contest:contests!contest_id!inner(slug, brand_name, status, is_private, is_nda, is_blind, winner_is_public, business_type, deleted_at, owner:profiles!client_id!inner(is_test)), images:entry_images!entry_id(position, preview_path)",
    )
    .in("status", ["active", "winner"])
    .eq("contest.business_type", type)
    .eq("contest.is_private", false)
    .eq("contest.is_nda", false)
    .is("contest.deleted_at", null)
    .eq("contest.owner.is_test", false)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) return [];
  const seen = new Set<string>();
  const picked = ((data ?? []) as unknown as Row[])
    .filter((r) => r.contest && isShareableDesign({ status: r.status, isHidden: r.is_hidden }, { status: r.contest.status, isPrivate: false, isNda: false, isBlind: r.contest.is_blind, winnerIsPublic: r.contest.winner_is_public }))
    .sort((a, b) => Number(b.status === "winner") - Number(a.status === "winner"))
    .filter((r) => (seen.has(r.contest!.slug) ? false : (seen.add(r.contest!.slug), true)))
    .flatMap((r) => {
      const cover = [...(r.images ?? [])].sort((a, b) => a.position - b.position)[0];
      return cover ? [{ r, path: cover.preview_path }] : [];
    })
    .slice(0, limit);
  const urls = await getFileStorage()
    .createReadUrls("entry-files", picked.map((p) => p.path), 3600, { width: 480, publicBrands: new Map(picked.map((p) => [p.path, p.r.contest!.brand_name])) })
    .catch(() => new Map<string, string>());
  return picked.flatMap(({ r, path }) => {
    const url = urls.get(path);
    const d = Array.isArray(r.designer) ? r.designer[0] : r.designer;
    return url ? [{ url, brand: r.contest!.brand_name, number: r.number, designer: !r.contest!.is_blind && d?.username ? `@${d.username}` : null, winner: r.status === "winner", href: `/contest/${r.contest!.slug}` }] : [];
  });
});
