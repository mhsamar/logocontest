"use server";

import { refresh } from "next/cache";
import { adminUser, audit } from "@/lib/admin/core";
import type { MessageKey } from "@/lib/i18n/translate";
import { SETTINGS } from "@/lib/settings/registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { boardsOf, pinterestConfigured } from "./api";
import { runPinterest } from "./job";
import { PINTEREST_RULES, type PinterestRule } from "./rules";
import { accessToken, clearConnection, setBoard } from "./store";
import { settingsChanged } from "@/lib/settings";

/** Admin › Pinterest (owner, 2026-10-19). Every action needs Content · manage and lands in the audit log. */

type Result = { ok: true; message?: MessageKey; params?: Record<string, string> } | { ok: false; error: MessageKey; params?: Record<string, string> };
const fail = (error: MessageKey, params?: Record<string, string>): Result => ({ ok: false, error, params });

async function saveSetting(key: "pinterest.on" | "pinterest.rule", value: boolean | string, by: string) {
  const def = SETTINGS[key];
  const { error } = await createAdminClient().from("settings").upsert({ key, value, type: def.type, group: def.group, description: def.description, updated_by: by });
  settingsChanged();
  if (error) throw new Error(error.message);
  await audit(by, "update_settings", "settings", "pinterest", { changes: { [key]: { to: value } } });
}

export async function setPinterestOn(on: boolean): Promise<Result> {
  const admin = await adminUser("autoshare.manage");
  if (!admin) return fail("auth.errors.generic");
  await saveSetting("pinterest.on", on, admin.id);
  refresh();
  return { ok: true };
}

export async function setPinterestRule(rule: string): Promise<Result> {
  const admin = await adminUser("autoshare.manage");
  if (!admin || !(PINTEREST_RULES as readonly string[]).includes(rule)) return fail("auth.errors.generic");
  await saveSetting("pinterest.rule", rule as PinterestRule, admin.id);
  refresh();
  return { ok: true };
}

/** Only one of the account's own boards can be chosen (checked with Pinterest). */
export async function choosePinterestBoard(boardId: string): Promise<Result> {
  const admin = await adminUser("autoshare.manage");
  if (!admin || !pinterestConfigured() || !/^\d{1,30}$/.test(boardId)) return fail("auth.errors.generic");
  try {
    const board = (await boardsOf(await accessToken(new Date()))).find((b) => b.id === boardId);
    if (!board) return fail("admin.pinterest.errors.board");
    await setBoard(board.id, board.name);
    await audit(admin.id, "pinterest_board", "settings", "pinterest", { board: board.name });
  } catch (e) {
    return fail("admin.pinterest.errors.api", { message: e instanceof Error ? e.message : String(e) });
  }
  refresh();
  return { ok: true };
}

/** "Pin now": the next design right away, even while auto-posting is off (also for Pinterest's review video). */
export async function pinNow(): Promise<Result> {
  const admin = await adminUser("autoshare.manage");
  if (!admin) return fail("auth.errors.generic");
  const res = await runPinterest(new Date(), { force: true, limit: 1 });
  await audit(admin.id, "pinterest_pin_now", "settings", "pinterest", { posted: res.posted, failed: res.failed });
  refresh();
  if (res.status !== "ran") return fail(`admin.pinterest.status.${res.status}`);
  if (res.posted) return { ok: true, message: "admin.pinterest.pinned" };
  if (res.failed) return fail("admin.pinterest.errors.api", { message: res.errors[0] ?? "" });
  return fail("admin.pinterest.nothing");
}

/** Failed pins get three fresh tries, starting now. */
export async function retryFailedPins(): Promise<Result> {
  const admin = await adminUser("autoshare.manage");
  if (!admin) return fail("auth.errors.generic");
  await createAdminClient().from("pinterest_pins").update({ attempts: 0, tried_at: null }).eq("status", "failed");
  await audit(admin.id, "pinterest_retry", "settings", "pinterest", {});
  const res = await runPinterest(new Date(), { force: true });
  refresh();
  return res.status === "ran" ? { ok: true, message: "admin.pinterest.retried", params: { n: String(res.posted) } } : fail(`admin.pinterest.status.${res.status}`);
}

export async function disconnectPinterest(): Promise<Result> {
  const admin = await adminUser("autoshare.manage");
  if (!admin) return fail("auth.errors.generic");
  await clearConnection();
  await saveSetting("pinterest.on", false, admin.id);
  await audit(admin.id, "pinterest_disconnect", "settings", "pinterest", {});
  refresh();
  return { ok: true };
}
