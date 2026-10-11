import "server-only";
import { UUID } from "@/lib/admin/core";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { HERO_SLIDE_COLUMNS, type HeroSlideRow } from "./hero";

/** Admin → Home hero (A-09b): every slide, on and off, in order; null before migration 0034 is run. */
export async function allHeroSlides(): Promise<HeroSlideRow[] | null> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await createAdminClient().from("home_hero_slides").select(HERO_SLIDE_COLUMNS).order("position", { ascending: true }).order("created_at", { ascending: true });
  return error ? null : ((data ?? []) as HeroSlideRow[]);
}

/** One slide for the edit page, or null. */
export async function heroSlideById(id: string): Promise<HeroSlideRow | null> {
  if (!isSupabaseConfigured() || !UUID.test(id)) return null;
  const { data } = await createAdminClient().from("home_hero_slides").select(HERO_SLIDE_COLUMNS).eq("id", id).maybeSingle();
  return (data as HeroSlideRow | null) ?? null;
}
