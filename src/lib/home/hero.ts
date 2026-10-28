import "server-only";
import { unstable_cache } from "next/cache";
import { CONTENT_TAG } from "@/lib/content/texts";
import { siteImageUrl } from "@/lib/content/pictures";
import { isSupabaseConfigured } from "@/lib/env";
import type { Locale } from "@/lib/i18n/config";
import type { Translate } from "@/lib/i18n/translate";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUILT_IN_SLIDES, HERO_SLIDE_MS, logoSizes, photoPosition, type HeroImage, type HeroItem, type HeroRole, type HeroSlideView } from "./hero-slides";

/** One row of home_hero_slides (migration 0034). */
export type HeroSlideRow = {
  id: string;
  position: number;
  is_active: boolean;
  brand: string;
  person_name: string;
  role: HeroRole;
  item: HeroItem;
  color_main: string;
  color_dark: string;
  color_light: string;
  color_badge: string;
  photo_path: string;
  photo_w: number;
  photo_h: number;
  photo_focus: number;
  logo_path: string;
  logo_w: number;
  logo_h: number;
  logo_white_path: string;
  logo_white_w: number;
  logo_white_h: number;
  badge_logo: "color" | "white";
  line1_en: string;
  line2_en: string;
  text_en: string;
  line1_bn: string | null;
  line2_bn: string | null;
  text_bn: string | null;
  updated_at: string;
};

export const HERO_SLIDE_COLUMNS =
  "id, position, is_active, brand, person_name, role, item, color_main, color_dark, color_light, color_badge, photo_path, photo_w, photo_h, photo_focus, logo_path, logo_w, logo_h, logo_white_path, logo_white_w, logo_white_h, badge_logo, line1_en, line2_en, text_en, line1_bn, line2_bn, text_bn, updated_at";

/** Where a stored picture is served from: the site's own /home-hero files, or the public "site" bucket. */
export const heroImageUrl = (path: string) => (path.startsWith("/") ? path : (siteImageUrl(path) ?? ""));

const image = (path: string, width: number, height: number): HeroImage => ({ src: heroImageUrl(path), width, height });

/** A stored slide as the home page draws it, in one language (Bangla falls back to English when empty). */
export function rowToView(r: HeroSlideRow, locale: Locale): HeroSlideView {
  const bn = locale === "bn";
  return {
    key: r.id,
    brand: r.brand,
    role: r.role,
    name: r.person_name,
    item: r.item,
    colors: { main: r.color_main, dark: r.color_dark, light: r.color_light, badge: r.color_badge },
    photo: { ...image(r.photo_path, r.photo_w, r.photo_h), position: photoPosition(r.photo_focus) },
    logo: image(r.logo_path, r.logo_w, r.logo_h),
    logoWhite: image(r.logo_white_path, r.logo_white_w, r.logo_white_h),
    logoSize: logoSizes(r.logo_w, r.logo_h, r.item),
    badgeLogo: r.badge_logo,
    copy: {
      line1: (bn && r.line1_bn?.trim()) || r.line1_en,
      line2: (bn && r.line2_bn?.trim()) || r.line2_en,
      text: (bn && r.text_bn?.trim()) || r.text_en,
    },
  };
}

/** The four built-in sample slides, with their texts from the translation files. */
export function builtInViews(t: Translate): HeroSlideView[] {
  return BUILT_IN_SLIDES.map((s) => ({
    ...s,
    key: s.id,
    photo: { ...s.photo, position: photoPosition(s.photoFocus) },
    copy: { line1: t(`home.hero.slides.${s.id}.line1`), line2: t(`home.hero.slides.${s.id}.line2`), text: t(`home.hero.slides.${s.id}.text`) },
  }));
}

// Shared across requests; Admin → Home hero clears it (updateTag(CONTENT_TAG)) on every change.
const loadActive = unstable_cache(
  async (): Promise<HeroSlideRow[]> => {
    if (!isSupabaseConfigured()) return [];
    const { data, error } = await createAdminClient()
      .from("home_hero_slides")
      .select(HERO_SLIDE_COLUMNS)
      .eq("is_active", true)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(12);
    // Before migration 0034, or if the database can't be reached, the built-in slides are shown.
    return error ? [] : ((data ?? []) as HeroSlideRow[]);
  },
  ["home-hero-slides-v1"],
  { tags: [CONTENT_TAG], revalidate: 3600 },
);

export type HomeHero = { slides: HeroSlideView[]; intervalMs: number; sample: boolean };

/** The home hero: the admin's switched-on slides, or the built-in samples (always with the "Sample artwork" pill). */
export async function homeHero(locale: Locale, t: Translate): Promise<HomeHero> {
  const [rows, s] = await Promise.all([loadActive(), getSettings(["home.hero_slide_seconds", "home.hero_sample_pill"]).catch(() => null)]);
  const intervalMs = s ? s["home.hero_slide_seconds"] * 1000 : HERO_SLIDE_MS;
  if (rows.length === 0) return { slides: builtInViews(t), intervalMs, sample: true };
  return { slides: rows.map((r) => rowToView(r, locale)), intervalMs, sample: s ? s["home.hero_sample_pill"] : true };
}
