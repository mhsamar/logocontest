import "server-only";
import { unstable_cache } from "next/cache";
import { UUID } from "@/lib/admin/core";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GuideCategory } from "./rules";

/** Guides (owner, 2026-10-15): read by the server only; the public parts are cached and cleared on every save. */

export const GUIDES_TAG = "guides";

export type GuideCard = {
  id: string;
  slug: string;
  category: GuideCategory;
  title_en: string;
  title_bn: string;
  summary_en: string;
  summary_bn: string;
  cover_path: string | null;
  in_footer: boolean;
  bn_ready: boolean;
  published_at: string;
  updated_at: string;
};
export type GuideRow = Omit<GuideCard, "published_at"> & { body_en: string; body_bn: string; status: "draft" | "published"; published_at: string | null; created_at: string };

const CARD = "id, slug, category, title_en, title_bn, summary_en, summary_bn, cover_path, in_footer, bn_ready, published_at, updated_at";
const FULL = `${CARD}, body_en, body_bn, status, created_at`;

const db = () => createAdminClient();

/** Every published guide, newest first (no text: for lists, the footer and the sitemap). [] before migration 0060. */
export const publishedGuides = unstable_cache(
  async (): Promise<GuideCard[]> => {
    if (!isSupabaseConfigured()) return [];
    const { data, error } = await db().from("guides").select(CARD).eq("status", "published").order("published_at", { ascending: false }).limit(500);
    return error ? [] : ((data ?? []) as GuideCard[]);
  },
  ["guides-published-v1"],
  { tags: [GUIDES_TAG], revalidate: 3600 },
);

/** One published guide with its text, or null. */
export const publishedGuide = unstable_cache(
  async (slug: string): Promise<GuideRow | null> => {
    if (!isSupabaseConfigured() || !/^[a-z0-9-]{1,100}$/.test(slug)) return null;
    const { data, error } = await db().from("guides").select(FULL).eq("slug", slug).eq("status", "published").maybeSingle();
    return error ? null : ((data as GuideRow | null) ?? null);
  },
  ["guides-one-v1"],
  { tags: [GUIDES_TAG], revalidate: 3600 },
);

/** Admin › Guides: every guide, drafts too; null before migration 0060 is run. */
export async function allGuides(): Promise<GuideRow[] | null> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await db().from("guides").select(FULL).order("updated_at", { ascending: false }).limit(500);
  return error ? null : ((data ?? []) as GuideRow[]);
}

export async function guideById(id: string): Promise<GuideRow | null> {
  if (!isSupabaseConfigured() || !UUID.test(id)) return null;
  const { data } = await db().from("guides").select(FULL).eq("id", id).maybeSingle();
  return (data as GuideRow | null) ?? null;
}
