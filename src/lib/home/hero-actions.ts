"use server";

import { randomUUID } from "node:crypto";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { adminUser, audit, UUID } from "@/lib/admin/core";
import { SITE_BUCKET } from "@/lib/content/pictures";
import { CONTENT_TAG, getMessages } from "@/lib/content/texts";
import type { MessageKey } from "@/lib/i18n/translate";
import { SETTINGS } from "@/lib/settings/registry";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { heroImageUrl, type HeroSlideRow } from "./hero";
import { HeroImageError, mainColor, processLogo, processPhoto, whiteLogo } from "./hero-images";
import { BUILT_IN_SLIDES, HERO_ITEMS, HERO_ROLES, imageFromPath, isHexColor, UPLOADED_IMAGE } from "./hero-slides";

/** Admin → Home hero (owner, 2026-10-11; UI-JOURNEY A-09b). Viewing needs content.view, every change content.manage. */

type Fail = { ok: false; error: MessageKey };
const fail = (error: MessageKey): Fail => ({ ok: false, error });
const TABLE = "home_hero_slides";

/** Clears the home page's cached slides so a change shows at once. */
function changed() {
  updateTag(CONTENT_TAG);
  refresh();
}

// ---------------------------------------------------------------------------------------------------------------
// Pictures: the browser uploads to a temporary path, then the server re-saves the picture under its final name
// ---------------------------------------------------------------------------------------------------------------

export type HeroPictureKind = "photo" | "logo" | "logoWhite";
const KINDS: HeroPictureKind[] = ["photo", "logo", "logoWhite"];
/** The browser makes pictures small first; this is the bucket's limit (migration 0028). */
const MAX_UPLOAD = 2 * 1024 * 1024;
const TYPES: Record<HeroPictureKind, Record<string, string>> = {
  photo: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" },
  logo: { "image/png": "png", "image/webp": "webp" },
  logoWhite: { "image/png": "png", "image/webp": "webp" },
};
const TEMP = /^hero-slides\/tmp\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

export async function prepareHeroPicture(kind: string, input: { type: string; size: number }): Promise<{ ok: true; path: string; token: string } | Fail> {
  if (!(await adminUser("content.manage"))) return fail("auth.errors.generic");
  if (!KINDS.includes(kind as HeroPictureKind)) return fail("auth.errors.generic");
  const ext = TYPES[kind as HeroPictureKind][input.type];
  if (!ext) return fail(kind === "photo" ? "admin.hero.errors.photoType" : "admin.hero.errors.logoType");
  if (input.size <= 0 || input.size > MAX_UPLOAD) return fail("admin.hero.errors.tooBig");
  return { ok: true, ...(await getFileStorage().createUploadUrl(SITE_BUCKET, `hero-slides/tmp/${randomUUID()}.${ext}`)) };
}

export type HeroPicture = { path: string; url: string; width: number; height: number };
export type ProcessedPicture = HeroPicture & {
  /** For a colour logo: its white version, made automatically. */
  white?: HeroPicture;
  /** For a colour logo: its main colour, to suggest the slide's colours. */
  color?: string | null;
};

const ERRORS: Record<HeroImageError["reason"], MessageKey> = {
  unreadable: "admin.hero.errors.unreadable",
  tooSmall: "admin.hero.errors.tooSmall",
  notTransparent: "admin.hero.errors.notTransparent",
};

async function store(bytes: Uint8Array, width: number, height: number, ext: "jpg" | "png"): Promise<HeroPicture> {
  const path = `hero-slides/${randomUUID()}-${width}x${height}.${ext}`;
  await getFileStorage().upload(SITE_BUCKET, path, bytes, ext === "jpg" ? "image/jpeg" : "image/png");
  return { path, url: heroImageUrl(path), width, height };
}

export async function processHeroPicture(kind: string, tempPath: string): Promise<{ ok: true; picture: ProcessedPicture } | Fail> {
  if (!(await adminUser("content.manage"))) return fail("auth.errors.generic");
  if (!KINDS.includes(kind as HeroPictureKind) || !TEMP.test(tempPath)) return fail("auth.errors.generic");
  const storage = getFileStorage();
  try {
    const input = await storage.download(SITE_BUCKET, tempPath);
    if (kind === "photo") {
      const p = await processPhoto(input);
      return { ok: true, picture: await store(p.bytes, p.width, p.height, "jpg") };
    }
    const logo = await processLogo(input);
    const saved = await store(logo.bytes, logo.width, logo.height, "png");
    if (kind === "logoWhite") return { ok: true, picture: saved };
    const white = await whiteLogo(logo);
    return { ok: true, picture: { ...saved, white: await store(white.bytes, white.width, white.height, "png"), color: await mainColor(logo) } };
  } catch (e) {
    if (e instanceof HeroImageError) return fail(ERRORS[e.reason]);
    console.error("[hero] picture failed:", e instanceof Error ? e.message : e);
    return fail("admin.hero.errors.upload");
  } finally {
    await storage.remove(SITE_BUCKET, [tempPath]).catch(() => {});
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Slides
// ---------------------------------------------------------------------------------------------------------------

const hex = z.string().refine(isHexColor);
const short = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const SlideInput = z.object({
  id: z.string().regex(UUID).nullable(),
  brand: short(40),
  personName: short(40),
  role: z.enum(HERO_ROLES as [string, ...string[]]),
  item: z.enum(HERO_ITEMS as [string, ...string[]]),
  colors: z.object({ main: hex, dark: hex, light: hex, badge: hex }),
  photoPath: z.string(),
  photoFocus: z.number().int().min(0).max(100),
  logoPath: z.string(),
  logoWhitePath: z.string(),
  badgeLogo: z.enum(["color", "white"]),
  line1En: short(40),
  line2En: short(40),
  textEn: short(200),
  line1Bn: optional(40),
  line2Bn: optional(40),
  textBn: optional(200),
  isActive: z.boolean(),
});
export type HeroSlideInput = z.input<typeof SlideInput>;

/** Uploaded pictures of a slide (built-in ones are never deleted). */
const uploadedPaths = (r: Pick<HeroSlideRow, "photo_path" | "logo_path" | "logo_white_path">) => [r.photo_path, r.logo_path, r.logo_white_path].filter((p) => UPLOADED_IMAGE.test(p));

/** Deletes pictures no slide uses any more. */
async function removeUnused(paths: string[]) {
  if (paths.length === 0) return;
  const { data } = await createAdminClient().from(TABLE).select("photo_path, logo_path, logo_white_path");
  const used = new Set((data ?? []).flatMap((r) => [r.photo_path, r.logo_path, r.logo_white_path] as string[]));
  const unused = [...new Set(paths)].filter((p) => !used.has(p));
  if (unused.length) await getFileStorage().remove(SITE_BUCKET, unused).catch(() => {});
}

export async function saveHeroSlide(input: HeroSlideInput): Promise<{ ok: true; id: string } | Fail> {
  const admin = await adminUser("content.manage");
  if (!admin) return fail("auth.errors.generic");
  const parsed = SlideInput.safeParse(input);
  if (!parsed.success) return fail("admin.hero.errors.fields");
  const v = parsed.data;
  const photo = imageFromPath(v.photoPath);
  const logo = imageFromPath(v.logoPath);
  const white = imageFromPath(v.logoWhitePath);
  if (!photo || !logo || !white) return fail("admin.hero.errors.pictures");
  const storage = getFileStorage();
  for (const p of [v.photoPath, v.logoPath, v.logoWhitePath]) if (UPLOADED_IMAGE.test(p) && !(await storage.exists(SITE_BUCKET, p))) return fail("admin.hero.errors.pictures");

  const row = {
    brand: v.brand,
    person_name: v.personName,
    role: v.role,
    item: v.item,
    color_main: v.colors.main.toUpperCase(),
    color_dark: v.colors.dark.toUpperCase(),
    color_light: v.colors.light.toUpperCase(),
    color_badge: v.colors.badge.toUpperCase(),
    photo_path: v.photoPath,
    photo_w: photo.width,
    photo_h: photo.height,
    photo_focus: v.photoFocus,
    logo_path: v.logoPath,
    logo_w: logo.width,
    logo_h: logo.height,
    logo_white_path: v.logoWhitePath,
    logo_white_w: white.width,
    logo_white_h: white.height,
    badge_logo: v.badgeLogo,
    line1_en: v.line1En,
    line2_en: v.line2En,
    text_en: v.textEn,
    line1_bn: v.line1Bn,
    line2_bn: v.line2Bn,
    text_bn: v.textBn,
    is_active: v.isActive,
    updated_at: new Date().toISOString(),
    updated_by: admin.id,
  };
  const db = createAdminClient();
  let id = v.id;
  if (id) {
    const { data: old } = await db.from(TABLE).select("photo_path, logo_path, logo_white_path").eq("id", id).maybeSingle();
    if (!old) return fail("admin.hero.errors.gone");
    const { error } = await db.from(TABLE).update(row).eq("id", id);
    if (error) return fail("admin.errors.generic");
    await removeUnused(uploadedPaths(old as HeroSlideRow));
    await audit(admin.id, "update_hero_slide", "hero_slide", id, { brand: v.brand, active: v.isActive });
  } else {
    const { data: last } = await db.from(TABLE).select("position").order("position", { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await db
      .from(TABLE)
      .insert({ ...row, position: ((last?.position as number | undefined) ?? -1) + 1 })
      .select("id")
      .single();
    if (error || !data) return fail("admin.errors.generic");
    id = data.id as string;
    await audit(admin.id, "add_hero_slide", "hero_slide", id, { brand: v.brand, active: v.isActive });
  }
  changed();
  return { ok: true, id };
}

export async function deleteHeroSlide(id: string): Promise<{ ok: true } | Fail> {
  const admin = await adminUser("content.manage");
  if (!admin || !UUID.test(id)) return fail("auth.errors.generic");
  const db = createAdminClient();
  const { data: old } = await db.from(TABLE).select("brand, photo_path, logo_path, logo_white_path").eq("id", id).maybeSingle();
  if (!old) return fail("admin.hero.errors.gone");
  const { error } = await db.from(TABLE).delete().eq("id", id);
  if (error) return fail("admin.errors.generic");
  await removeUnused(uploadedPaths(old as HeroSlideRow));
  await audit(admin.id, "delete_hero_slide", "hero_slide", id, { brand: old.brand });
  changed();
  return { ok: true };
}

export async function setHeroSlideActive(id: string, on: boolean): Promise<{ ok: true } | Fail> {
  const admin = await adminUser("content.manage");
  if (!admin || !UUID.test(id)) return fail("auth.errors.generic");
  const { data, error } = await createAdminClient().from(TABLE).update({ is_active: on, updated_at: new Date().toISOString(), updated_by: admin.id }).eq("id", id).select("brand").maybeSingle();
  if (error || !data) return fail("admin.errors.generic");
  await audit(admin.id, on ? "show_hero_slide" : "hide_hero_slide", "hero_slide", id, { brand: data.brand });
  changed();
  return { ok: true };
}

/** Moves a slide one place up or down; every slide is numbered again 0, 1, 2… */
export async function moveHeroSlide(id: string, dir: "up" | "down"): Promise<{ ok: true } | Fail> {
  const admin = await adminUser("content.manage");
  if (!admin || !UUID.test(id) || (dir !== "up" && dir !== "down")) return fail("auth.errors.generic");
  const db = createAdminClient();
  const { data } = await db.from(TABLE).select("id").order("position", { ascending: true }).order("created_at", { ascending: true });
  const ids = (data ?? []).map((r) => r.id as string);
  const i = ids.indexOf(id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return { ok: true };
  [ids[i], ids[j]] = [ids[j], ids[i]];
  for (const [position, rowId] of ids.entries()) await db.from(TABLE).update({ position }).eq("id", rowId);
  await audit(admin.id, "move_hero_slide", "hero_slide", id, { dir });
  changed();
  return { ok: true };
}

/**
 * Copies the four built-in sample slides into the list (switched off), so an admin can edit or replace them one by
 * one. Only when the list is empty.
 */
export async function copySampleSlides(): Promise<{ ok: true } | Fail> {
  const admin = await adminUser("content.manage");
  if (!admin) return fail("auth.errors.generic");
  const db = createAdminClient();
  const { count } = await db.from(TABLE).select("id", { count: "exact", head: true });
  if (count) return fail("admin.hero.errors.notEmpty");
  const [en, bn] = await Promise.all([getMessages("en"), getMessages("bn")]);
  const rows = BUILT_IN_SLIDES.map((s, position) => ({
    position,
    is_active: false,
    brand: s.brand,
    person_name: s.name,
    role: s.role,
    item: s.item,
    color_main: s.colors.main,
    color_dark: s.colors.dark,
    color_light: s.colors.light,
    color_badge: s.colors.badge,
    photo_path: s.photo.src,
    photo_w: s.photo.width,
    photo_h: s.photo.height,
    photo_focus: s.photoFocus,
    logo_path: s.logo.src,
    logo_w: s.logo.width,
    logo_h: s.logo.height,
    logo_white_path: s.logoWhite.src,
    logo_white_w: s.logoWhite.width,
    logo_white_h: s.logoWhite.height,
    badge_logo: s.badgeLogo,
    line1_en: en.home.hero.slides[s.id].line1,
    line2_en: en.home.hero.slides[s.id].line2,
    text_en: en.home.hero.slides[s.id].text,
    line1_bn: bn.home.hero.slides[s.id].line1,
    line2_bn: bn.home.hero.slides[s.id].line2,
    text_bn: bn.home.hero.slides[s.id].text,
    updated_by: admin.id,
  }));
  const { error } = await db.from(TABLE).insert(rows);
  if (error) return fail("admin.errors.generic");
  await audit(admin.id, "copy_sample_hero_slides", "hero_slide", null, { count: rows.length });
  changed();
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------------------------
// The two hero settings
// ---------------------------------------------------------------------------------------------------------------

export async function saveHeroSettings(input: { seconds: number; samplePill: boolean; offerSlide: boolean }): Promise<{ ok: true } | Fail> {
  const admin = await adminUser("content.manage");
  if (!admin) return fail("auth.errors.generic");
  if (!Number.isInteger(input.seconds) || input.seconds < 1 || input.seconds > 10) return fail("admin.hero.errors.seconds");
  const rows = (
    [
      ["home.hero_slide_seconds", input.seconds],
      ["home.hero_sample_pill", Boolean(input.samplePill)],
      ["home.hero_offer_slide", Boolean(input.offerSlide)],
    ] as const
  ).map(([key, value]) => ({ key, value, type: SETTINGS[key].type, group: SETTINGS[key].group, description: SETTINGS[key].description, updated_by: admin.id }));
  const { error } = await createAdminClient().from("settings").upsert(rows);
  if (error) return fail("admin.errors.generic");
  await audit(admin.id, "update_hero_settings", "setting", "home.hero", { seconds: input.seconds, samplePill: input.samplePill, offerSlide: input.offerSlide });
  changed();
  return { ok: true };
}
