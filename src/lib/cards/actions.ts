"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { adminUser, audit, UUID } from "@/lib/admin/core";
import { getCurrentUser } from "@/lib/auth/session";
import type { MessageKey } from "@/lib/i18n/translate";
import { SETTINGS } from "@/lib/settings/registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { facebookConfigured } from "./facebook";
import { postCard } from "./job";
import { cleanHashtags, cleanText, DEFAULT_CAPTION, DEFAULT_HASHTAGS, isCardStyle, type CardStyle } from "./rules";
import { cardById, cardsReady, contestForCard, drawCard, makeCaption, updateCard } from "./store";
import { settingsChanged } from "@/lib/settings";

/**
 * Admin › Contest cards (owner, 2026-10-19). Same admin roles as Admin › Pinterest (Auto share · manage). Every action is
 * in the audit log: post, schedule, skip, make again, caption and settings changes.
 */

type Result = { ok: true; message?: MessageKey; params?: Record<string, string> } | { ok: false; error: MessageKey; params?: Record<string, string> };
const fail = (error: MessageKey, params?: Record<string, string>): Result => ({ ok: false, error, params });

async function manager() {
  return adminUser("autoshare.manage");
}

async function withCard(id: string) {
  const admin = await manager();
  if (!admin || !UUID.test(id)) return null;
  const card = await cardById(id);
  return card ? { admin, card } : null;
}

/** "Post to Facebook now", and "Send again" for a failed one (three fresh tries). */
export async function postCardNow(id: string): Promise<Result> {
  const got = await withCard(id);
  if (!got) return fail("auth.errors.generic");
  if (!facebookConfigured()) return fail("admin.cards.errors.noKey");
  if (got.card.status === "posted") return fail("admin.cards.errors.already");
  const out = await postCard({ ...got.card, attempts: 0 }, { by: got.admin.id });
  await audit(got.admin.id, "contest_card_post", "contest", got.card.contest_id, { card: id, status: out.status });
  refresh();
  if (out.status === "posted") return { ok: true, message: "admin.cards.done.posted" };
  if (out.status === "skipped") return fail("admin.cards.errors.notShareable");
  return fail(out.error?.startsWith("PERMISSION") ? "admin.cards.errors.permission" : "admin.cards.errors.facebook", { message: (out.error ?? "").replace(/^PERMISSION /, "") });
}

/** "Schedule": Facebook publishes it at that time (10 minutes to 30 days ahead). */
export async function scheduleCard(id: string, isoTime: string): Promise<Result> {
  const got = await withCard(id);
  if (!got) return fail("auth.errors.generic");
  if (!facebookConfigured()) return fail("admin.cards.errors.noKey");
  const at = new Date(isoTime);
  const now = Date.now();
  if (Number.isNaN(at.getTime()) || at.getTime() < now + 10 * 60_000 || at.getTime() > now + 30 * 86_400_000) return fail("admin.cards.errors.time");
  const out = await postCard({ ...got.card, attempts: 0 }, { at, by: got.admin.id });
  await audit(got.admin.id, "contest_card_schedule", "contest", got.card.contest_id, { card: id, at: at.toISOString(), status: out.status });
  refresh();
  if (out.status === "scheduled") return { ok: true, message: "admin.cards.done.scheduled" };
  if (out.status === "skipped") return fail("admin.cards.errors.notShareable");
  return fail(out.error?.startsWith("PERMISSION") ? "admin.cards.errors.permission" : "admin.cards.errors.facebook", { message: (out.error ?? "").replace(/^PERMISSION /, "") });
}

/** "Skip — don't post this one". */
export async function skipCard(id: string): Promise<Result> {
  const got = await withCard(id);
  if (!got) return fail("auth.errors.generic");
  if (got.card.status === "posted" || got.card.status === "scheduled") return fail("admin.cards.errors.already");
  await updateCard(id, { status: "skipped", skip_reason: "admin" });
  await audit(got.admin.id, "contest_card_skip", "contest", got.card.contest_id, { card: id });
  refresh();
  return { ok: true, message: "admin.cards.done.skipped" };
}

/** "Make again", or a style button: draws the four sizes again with today's days left (and a new style, if chosen). */
export async function remakeCard(id: string, style?: string): Promise<Result> {
  const got = await withCard(id);
  if (!got) return fail("auth.errors.generic");
  if (style !== undefined && !isCardStyle(style)) return fail("auth.errors.generic");
  const c = await contestForCard(got.card.contest_id);
  if (!c) return fail("auth.errors.generic");
  const next: CardStyle = (style as CardStyle | undefined) ?? got.card.style;
  try {
    const images = await drawCard(c, got.card.kind, next, got.card.line_bn, new Date());
    // A skipped card that is made again (not a private one) comes back to wait for the OK.
    const back = got.card.status === "skipped" && got.card.skip_reason === "admin" ? { status: "waiting" as const, skip_reason: null } : {};
    const failedPicture = got.card.status === "failed" && got.card.attempts === 0 ? { status: "waiting" as const, error: null } : {};
    await updateCard(id, { images, style: next, ...back, ...failedPicture });
  } catch (e) {
    return fail("admin.cards.errors.render", { message: e instanceof Error ? e.message.slice(0, 160) : String(e) });
  }
  await audit(got.admin.id, "contest_card_remake", "contest", got.card.contest_id, { card: id, style: next });
  refresh();
  return { ok: true, message: "admin.cards.done.remade" };
}

/** The caption of one card, as the admin wrote it. */
export async function saveCardCaption(id: string, caption: string): Promise<Result> {
  const got = await withCard(id);
  if (!got) return fail("auth.errors.generic");
  const text = caption.replace(/\r\n/g, "\n").trim().slice(0, 2000);
  if (!text) return fail("admin.cards.errors.caption");
  await updateCard(id, { caption: text });
  await audit(got.admin.id, "contest_card_caption", "contest", got.card.contest_id, { card: id });
  refresh();
  return { ok: true };
}

/** The Bangla line on one card; the card is drawn again with it. */
export async function saveCardLine(id: string, line: string): Promise<Result> {
  const got = await withCard(id);
  if (!got) return fail("auth.errors.generic");
  const text = cleanText(line, 70);
  await updateCard(id, { line_bn: text || null });
  await audit(got.admin.id, "contest_card_line", "contest", got.card.contest_id, { card: id });
  return remakeCard(id);
}

async function save(key: keyof typeof SETTINGS, value: unknown, by: string) {
  const def = SETTINGS[key];
  const { error } = await createAdminClient().from("settings").upsert({ key, value, type: def.type, group: def.group, description: def.description, updated_by: by });
  settingsChanged();
  if (error) throw new Error(error.message);
}

const SettingsInput = z.object({
  auto_post: z.boolean(),
  check_first: z.boolean(),
  last24: z.boolean(),
  post_when: z.enum(["now", "best", "custom"]),
  custom_time: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/),
  style: z.enum(["auto", "maroon", "light", "big"]),
  big_prize_from: z.number().int().min(1).max(10_000_000),
});

/** The main Save of the settings block. */
export async function saveCardSettings(input: z.input<typeof SettingsInput>): Promise<Result> {
  const admin = await manager();
  const v = SettingsInput.safeParse(input);
  if (!admin || !v.success) return fail("auth.errors.generic");
  for (const [k, value] of Object.entries(v.data)) await save(`cards.${k}` as keyof typeof SETTINGS, value, admin.id);
  await audit(admin.id, "update_settings", "settings", "cards", { changes: Object.fromEntries(Object.entries(v.data).map(([k, value]) => [`cards.${k}`, { to: value }])) });
  refresh();
  return { ok: true };
}

/** Save caption / Reset (the template for new cards). */
export async function saveCaptionTemplate(text: string | null): Promise<Result> {
  const admin = await manager();
  if (!admin) return fail("auth.errors.generic");
  const value = text === null ? DEFAULT_CAPTION : text.replace(/\r\n/g, "\n").trim().slice(0, 2000);
  if (!value) return fail("admin.cards.errors.caption");
  await save("cards.caption", value, admin.id);
  await audit(admin.id, "update_settings", "settings", "cards", { changes: { "cards.caption": { to: text === null ? "reset" : "changed" } } });
  refresh();
  return { ok: true };
}

/** Save hashtags / Reset. */
export async function saveHashtags(list: string[] | null): Promise<Result> {
  const admin = await manager();
  if (!admin) return fail("auth.errors.generic");
  const value = list === null ? DEFAULT_HASHTAGS : cleanHashtags(list);
  await save("cards.hashtags", value, admin.id);
  await audit(admin.id, "update_settings", "settings", "cards", { changes: { "cards.hashtags": { to: value } } });
  refresh();
  return { ok: true };
}

/**
 * The client's "Share my contest on Facebook" switch (contest form). Only for their own contest; a card that is
 * still waiting is skipped when they switch it off. Works only once migration 0067 has run.
 */
export async function setContestShare(input: { contestId: string; on: boolean }): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !UUID.test(input.contestId) || !(await cardsReady()).shareColumn) return { ok: false };
  const db = createAdminClient();
  const { data, error } = await db.from("contests").update({ share_on_facebook: input.on }).eq("id", input.contestId).eq("client_id", user.id).select("id");
  if (error || !data?.length) return { ok: false };
  if (!input.on) await db.from("contest_cards").update({ status: "skipped", skip_reason: "client_off", updated_at: new Date().toISOString() }).eq("contest_id", input.contestId).eq("status", "waiting");
  return { ok: true };
}

/** A fresh caption from the template (for the "Reset" link under one card's caption). */
export async function resetCardCaption(id: string): Promise<Result> {
  const got = await withCard(id);
  if (!got) return fail("auth.errors.generic");
  const c = await contestForCard(got.card.contest_id);
  if (!c) return fail("auth.errors.generic");
  await updateCard(id, { caption: await makeCaption(c, new Date()) });
  await audit(got.admin.id, "contest_card_caption", "contest", got.card.contest_id, { card: id, reset: true });
  refresh();
  return { ok: true };
}
