"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { adminUser, audit } from "@/lib/admin/core";
import { SITE_BUCKET } from "@/lib/content/pictures";
import { NO_VIDEO, parseVideoUrl, type HowVideo } from "@/lib/home/how-video";
import type { MessageKey } from "@/lib/i18n/translate";
import { getSetting, settingsChanged } from "@/lib/settings";
import { SETTINGS } from "@/lib/settings/registry";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin › Payments › Methods, "Contest payment screen" (owner, 2026-11-06): the voice guide (an MP3 or M4A up to 2 MB
 * in the public site bucket, its on/off and its timing table), the support hours and the "how to Send Money" video.
 * Needs payments.manage; every change goes to the audit log and shows on the payment screen at once.
 */

type Result = { ok: true } | { ok: false; error: MessageKey };
type Key = "pay.voice_on" | "pay.voice_path" | "pay.voice_name" | "pay.voice_cues" | "pay.howto_video" | "pay.support_hours";

const VOICE_TYPES: Record<string, "mp3" | "m4a"> = { "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "m4a" };
const VOICE_MAX = 2 * 1024 * 1024;
const VOICE_PATH = /^voice\/[0-9a-f-]{36}\.(mp3|m4a)$/;

async function store(key: Key, value: unknown, adminId: string) {
  const def = SETTINGS[key];
  const db = createAdminClient();
  const { data: before } = await db.from("settings").select("value").eq("key", key).maybeSingle();
  const { error } = await db.from("settings").upsert({ key, value, type: def.type, group: def.group, description: def.description, updated_by: adminId });
  settingsChanged();
  return { error, before: before?.value ?? null };
}

/** Step 1 of an upload: a one-time link to put the file in the site bucket. */
export async function preparePayVoice(input: { type: string; size: number }): Promise<{ ok: true; path: string; token: string } | { ok: false; error: MessageKey }> {
  if (!(await adminUser("payments.manage"))) return { ok: false, error: "auth.errors.generic" };
  const ext = VOICE_TYPES[input.type];
  if (!ext) return { ok: false, error: "pay.admin.screen.voiceType" };
  if (!(input.size > 0) || input.size > VOICE_MAX) return { ok: false, error: "pay.admin.screen.voiceSize" };
  const upload = await getFileStorage().createUploadUrl(SITE_BUCKET, `voice/${randomUUID()}.${ext}`);
  return { ok: true, ...upload };
}

/** Step 2: the uploaded file becomes the voice guide; the old file is deleted. */
export async function savePayVoice(path: string, name: string): Promise<Result> {
  const admin = await adminUser("payments.manage");
  if (!admin || !VOICE_PATH.test(path)) return { ok: false, error: "auth.errors.generic" };
  const storage = getFileStorage();
  if (!(await storage.exists(SITE_BUCKET, path))) return { ok: false, error: "auth.errors.generic" };
  const old = await getSetting("pay.voice_path").catch(() => "");
  const { error } = await store("pay.voice_path", path, admin.id);
  if (error) return { ok: false, error: "admin.errors.generic" };
  await store("pay.voice_name", name.slice(0, 120), admin.id);
  if (old && old !== path) await storage.remove(SITE_BUCKET, [old]).catch(() => {});
  await audit(admin.id, "update_pay_voice", "settings", "pay.voice_path", { from: old || null, to: path });
  refresh();
  return { ok: true };
}

/** Deletes the voice guide: the player is hidden on the payment screen. */
export async function removePayVoice(): Promise<Result> {
  const admin = await adminUser("payments.manage");
  if (!admin) return { ok: false, error: "auth.errors.generic" };
  const old = await getSetting("pay.voice_path").catch(() => "");
  const { error } = await store("pay.voice_path", "", admin.id);
  if (error) return { ok: false, error: "admin.errors.generic" };
  await store("pay.voice_name", "", admin.id);
  if (old) await getFileStorage().remove(SITE_BUCKET, [old]).catch(() => {});
  await audit(admin.id, "update_pay_voice", "settings", "pay.voice_path", { from: old || null, to: null });
  refresh();
  return { ok: true };
}

export async function setPayVoiceOn(on: boolean): Promise<Result> {
  const admin = await adminUser("payments.manage");
  if (!admin) return { ok: false, error: "auth.errors.generic" };
  const { error, before } = await store("pay.voice_on", Boolean(on), admin.id);
  if (error) return { ok: false, error: "admin.errors.generic" };
  await audit(admin.id, "update_settings", "settings", "pay.voice_on", { from: before, to: Boolean(on) });
  refresh();
  return { ok: true };
}

/** The voice guide's timing table, in the order given. */
export async function savePayCues(rows: { from: number; to: number; box: string; text: string }[]): Promise<Result> {
  const admin = await adminUser("payments.manage");
  if (!admin) return { ok: false, error: "auth.errors.generic" };
  const parsed = SETTINGS["pay.voice_cues"].schema.safeParse(rows.map((r) => ({ from: Math.round(Number(r.from)), to: Math.round(Number(r.to)), box: r.box, text: String(r.text ?? "").trim() })));
  if (!parsed.success || parsed.data.some((r) => r.to <= r.from)) return { ok: false, error: "pay.admin.screen.badCues" };
  const { error, before } = await store("pay.voice_cues", parsed.data, admin.id);
  if (error) return { ok: false, error: "admin.errors.generic" };
  await audit(admin.id, "update_settings", "settings", "pay.voice_cues", { from: before, to: parsed.data });
  refresh();
  return { ok: true };
}

/** The support hours under the WhatsApp help, and the "how to Send Money" video (a YouTube link; empty hides it). */
export async function savePayPage(input: { hours: string; video: string }): Promise<Result> {
  const admin = await adminUser("payments.manage");
  if (!admin) return { ok: false, error: "auth.errors.generic" };
  const hours = input.hours.trim().slice(0, 60);
  let video: HowVideo = NO_VIDEO;
  if (input.video.trim()) {
    const parsed = parseVideoUrl(input.video);
    if (!parsed || parsed.kind !== "youtube") return { ok: false, error: "admin.homepage.heroVideo.badUrl" };
    video = parsed;
  }
  const a = await store("pay.support_hours", hours, admin.id);
  const b = await store("pay.howto_video", video, admin.id);
  if (a.error || b.error) return { ok: false, error: "admin.errors.generic" };
  await audit(admin.id, "update_settings", "settings", "pay.page", { hours: { from: a.before, to: hours }, video: { from: (b.before as HowVideo | null)?.url || null, to: video.url || null } });
  refresh();
  return { ok: true };
}
