"use server";

import { refresh } from "next/cache";
import { adminUser, audit } from "@/lib/admin/core";
import type { MessageKey } from "@/lib/i18n/translate";
import { SETTINGS } from "@/lib/settings/registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { NO_VIDEO, parseVideoUrl, VIDEO_SLOTS, type HowVideo, type VideoSlot } from "./how-video";
import { settingsChanged } from "@/lib/settings";

/**
 * Admin → Homepage, "How it works videos" (owner, 2026-10-11): the two video links and the auto-play switch; since
 * 2026-10-26 also the Start a contest corner video, with its on/off and auto-play switches.
 * Site content: needs content.manage; every change goes to the audit log.
 */

type Result = { ok: true } | { ok: false; error: MessageKey };

const KEY = { client: "how.video_client", designer: "how.video_designer", start: "how.video_start" } as const;
const SWITCHES = ["how.video_autoplay", "how.start_video_on", "how.start_video_autoplay"] as const;
type HowSwitch = (typeof SWITCHES)[number];

async function store(key: (typeof KEY)[VideoSlot] | HowSwitch, value: unknown, adminId: string) {
  const def = SETTINGS[key];
  const db = createAdminClient();
  const { data: before } = await db.from("settings").select("value").eq("key", key).maybeSingle();
  const { error } = await db.from("settings").upsert({ key, value, type: def.type, group: def.group, description: def.description, updated_by: adminId });
  settingsChanged();
  return { error, before: before?.value ?? null };
}

/** Saves a video from a pasted YouTube or Vimeo link; an empty link removes the video. */
export async function saveHowVideo(tab: VideoSlot, link: string): Promise<Result> {
  const admin = await adminUser("content.manage");
  if (!admin || !(VIDEO_SLOTS as readonly string[]).includes(tab)) return { ok: false, error: "auth.errors.generic" };
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

/** One of the card's switches: How it works auto-play, and the Start a contest video's on/off and auto-play. */
export async function setHowSwitch(key: HowSwitch, on: boolean): Promise<Result> {
  const admin = await adminUser("content.manage");
  if (!admin || !(SWITCHES as readonly string[]).includes(key)) return { ok: false, error: "auth.errors.generic" };
  const { error, before } = await store(key, Boolean(on), admin.id);
  if (error) return { ok: false, error: "admin.errors.generic" };
  await audit(admin.id, "update_settings", "settings", key, { from: before, to: Boolean(on) });
  refresh();
  return { ok: true };
}
