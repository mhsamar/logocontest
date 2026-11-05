"use server";

import { refresh } from "next/cache";
import { adminUser, audit } from "@/lib/admin/core";
import type { MessageKey } from "@/lib/i18n/translate";
import { settingsChanged } from "@/lib/settings";
import { SETTINGS } from "@/lib/settings/registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { NO_VIDEO, parseVideoUrl, type HowVideo } from "./how-video";

/**
 * Admin → Homepage, "Home hero video" (owner, 2026-11-06): the YouTube link, the video and sound switches and the
 * chapters. Site content: needs content.manage; every change goes to the audit log and shows on the home page at once.
 */

type Result = { ok: true } | { ok: false; error: MessageKey };
type Key = "hero.video" | "hero.video_on" | "hero.video_sound" | "hero.video_chapters";

async function store(key: Key, value: unknown, adminId: string) {
  const def = SETTINGS[key];
  const db = createAdminClient();
  const { data: before } = await db.from("settings").select("value").eq("key", key).maybeSingle();
  const { error } = await db.from("settings").upsert({ key, value, type: def.type, group: def.group, description: def.description, updated_by: adminId });
  settingsChanged();
  return { error, before: before?.value ?? null };
}

/** The hero video from a pasted YouTube link (any form: watch, youtu.be, shorts, embed); empty removes it. */
export async function saveHeroVideo(link: string): Promise<Result> {
  const admin = await adminUser("content.manage");
  if (!admin) return { ok: false, error: "auth.errors.generic" };
  let video: HowVideo = NO_VIDEO;
  if (link.trim()) {
    const parsed = parseVideoUrl(link);
    if (!parsed || parsed.kind !== "youtube") return { ok: false, error: "admin.homepage.heroVideo.badUrl" };
    video = parsed;
  }
  const { error, before } = await store("hero.video", video, admin.id);
  if (error) return { ok: false, error: "admin.errors.generic" };
  await audit(admin.id, "update_hero_video", "settings", "hero.video", { from: (before as HowVideo | null)?.url || null, to: video.url || null });
  refresh();
  return { ok: true };
}

/** The video on/off (off shows its poster only) and "start with sound". */
export async function setHeroVideoSwitch(key: "hero.video_on" | "hero.video_sound", on: boolean): Promise<Result> {
  const admin = await adminUser("content.manage");
  if (!admin || (key !== "hero.video_on" && key !== "hero.video_sound")) return { ok: false, error: "auth.errors.generic" };
  const { error, before } = await store(key, Boolean(on), admin.id);
  if (error) return { ok: false, error: "admin.errors.generic" };
  await audit(admin.id, "update_settings", "settings", key, { from: before, to: Boolean(on) });
  refresh();
  return { ok: true };
}

/** The chapters, in the order given (sorted by time is up to the owner: they show as listed). */
export async function saveHeroChapters(rows: { at: number; label: string }[]): Promise<Result> {
  const admin = await adminUser("content.manage");
  if (!admin) return { ok: false, error: "auth.errors.generic" };
  const parsed = SETTINGS["hero.video_chapters"].schema.safeParse(rows.map((r) => ({ at: Math.round(Number(r.at)), label: String(r.label ?? "").trim() })));
  if (!parsed.success) return { ok: false, error: "admin.homepage.heroVideo.badChapters" };
  const { error, before } = await store("hero.video_chapters", parsed.data, admin.id);
  if (error) return { ok: false, error: "admin.errors.generic" };
  await audit(admin.id, "update_settings", "settings", "hero.video_chapters", { from: before, to: parsed.data });
  refresh();
  return { ok: true };
}
