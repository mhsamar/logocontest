"use server";

import { refresh } from "next/cache";
import { adminUser, audit, UUID } from "@/lib/admin/core";
import type { MessageKey } from "@/lib/i18n/translate";
import { settingsChanged } from "@/lib/settings";
import { SETTINGS } from "@/lib/settings/registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { homeShowcaseChanged } from "./showcase";

/**
 * Admin → Homepage, "Home showcase" (owner, 2026-11-20): the section on or off, the pinned contests, a contest's
 * "হোমে দেখাবে" switch, a design's "hide from home" and Refresh now. Site content: needs content.manage; every change
 * is in the audit log and shows on the home page at once.
 */

type Result = { ok: true } | { ok: false; error: MessageKey };
const fail = (error: MessageKey): Result => ({ ok: false, error });

type Key = "home.showcase_on" | "home.showcase_live_pins" | "home.showcase_finished_pin";

async function store(key: Key, value: unknown, adminId: string) {
  const def = SETTINGS[key];
  const db = createAdminClient();
  const { data: before } = await db.from("settings").select("value").eq("key", key).maybeSingle();
  const { error } = await db.from("settings").upsert({ key, value, type: def.type, group: def.group, description: def.description, updated_by: adminId });
  settingsChanged();
  if (!error) await audit(adminId, "update_settings", "settings", key, { from: before?.value ?? null, to: value });
  return !error;
}

const done = (): Result => {
  homeShowcaseChanged();
  refresh();
  return { ok: true };
};

/** The whole section on or off. */
export async function setShowcaseOn(on: boolean): Promise<Result> {
  const admin = await adminUser("content.manage");
  if (!admin) return fail("auth.errors.generic");
  return (await store("home.showcase_on", Boolean(on), admin.id)) ? done() : fail("admin.errors.generic");
}

/** Up to 3 live contests and 1 finished contest shown first; empty fields mean automatic. */
export async function saveShowcasePins(f: Record<string, string>): Promise<Result> {
  const admin = await adminUser("content.manage");
  if (!admin) return fail("auth.errors.generic");
  const live = [...new Set([f.live1, f.live2, f.live3].map((v) => (v ?? "").trim()).filter(Boolean))];
  const finished = (f.finished ?? "").trim();
  if (live.some((id) => !UUID.test(id)) || (finished && !UUID.test(finished))) return fail("admin.errors.generic");
  const ok = (await store("home.showcase_live_pins", live.slice(0, 3), admin.id)) && (await store("home.showcase_finished_pin", finished, admin.id));
  return ok ? done() : fail("admin.errors.generic");
}

/** A contest's "হোমে দেখাবে" switch (blind, private and NDA contests never show whatever it says). */
export async function setContestHomeShow(contestId: string, on: boolean): Promise<Result> {
  const admin = await adminUser("content.manage");
  if (!admin || !UUID.test(contestId)) return fail("auth.errors.generic");
  const { error } = await createAdminClient().from("contests").update({ home_show: Boolean(on) }).eq("id", contestId);
  if (error) return fail("admin.errors.generic");
  await audit(admin.id, "contest_home_show", "contest", contestId, { on: Boolean(on) });
  return done();
}

/** One design kept off the home page, or back on. */
export async function setEntryHomeHidden(entryId: string, hidden: boolean): Promise<Result> {
  const admin = await adminUser("content.manage");
  if (!admin || !UUID.test(entryId)) return fail("auth.errors.generic");
  const { error } = await createAdminClient().from("entries").update({ home_hidden: Boolean(hidden) }).eq("id", entryId);
  if (error) return fail("admin.errors.generic");
  await audit(admin.id, "entry_home_hidden", "entry", entryId, { hidden: Boolean(hidden) });
  return done();
}

/** Refresh now: the wall and the cards are built again on the next home page view. */
export async function refreshShowcase(): Promise<Result> {
  const admin = await adminUser("content.manage");
  if (!admin) return fail("auth.errors.generic");
  return done();
}
