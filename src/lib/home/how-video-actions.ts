"use server";

import { refresh } from "next/cache";
import { adminUser, audit } from "@/lib/admin/core";
import type { MessageKey } from "@/lib/i18n/translate";
import { SETTINGS } from "@/lib/settings/registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { HOW_VIDEO_TABS, NO_VIDEO, parseVideoUrl, type HowVideo, type HowVideoTab } from "./how-video";

/**
 * Admin → Homepage, "How it works videos" (owner, 2026-10-11): the two video links and the auto-play switch.
 * Site content: needs content.manage; every change goes to the audit log.
 */

type Result = { ok: true } | { ok: false; error: MessageKey };

const KEY = { client: "how.video_client", designer: "how.video_designer" } as const;

async function store(key: "how.video_client" | "how.video_designer" | "how.video_autoplay", value: unknown, adminId: string) {
  const def = SETTINGS[key];
  const db = createAdminClient();
  const { data: before } = await db.from("settings").select("value").eq("key", key).maybeSingle();
  const { error } = await db.from("settings").upsert({ key, value, type: def.type, group: def.group, description: def.description, updated_by: adminId });
  return { error, before: before?.value ?? null };
}

/** Saves a tab's video from a pasted YouTube or Vimeo link; an empty link removes the video. */
export async function saveHowVideo(tab: HowVideoTab, link: string): Promise<Result> {
  const admin = await adminUser("content.manage");
  if (!admin || !(HOW_VIDEO_TABS as readonly string[]).includes(tab)) return { ok: false, error: "auth.errors.generic" };
  let video: HowVideo = NO_VIDEO;
  if (link.trim()) {
    const parsed = parseVideoUrl(link);
    if (!parsed) return { ok: false, error: "admin.homepage.videos.badUrl" };
    video = parsed;
  }
  const { error, before } = await store(KEY[tab], video, admin.id);
  if (error) return { ok: false, error: "admin.errors.generic" };
  await audit(admin.id, "update_how_video", "settings", KEY[tab], { from: (before as HowVideo | null)?.url || null, to: video.url || null });
  refresh();
  return { ok: true };
}

export async function setHowAutoplay(on: boolean): Promise<Result> {
  const admin = await adminUser("content.manage");
  if (!admin) return { ok: false, error: "auth.errors.generic" };
  const { error, before } = await store("how.video_autoplay", Boolean(on), admin.id);
  if (error) return { ok: false, error: "admin.errors.generic" };
  await audit(admin.id, "update_settings", "settings", "how.video_autoplay", { from: before, to: Boolean(on) });
  refresh();
  return { ok: true };
}
