"use server";

import { refresh } from "next/cache";
import { adminUser, audit, UUID } from "@/lib/admin/core";
import { linkOrigin } from "@/lib/site-origin";
import type { MessageKey } from "@/lib/i18n/translate";
import { SETTINGS } from "@/lib/settings/registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { remindReward } from "./claims";
import { approveMonth, clearTestMonth, closeMonth } from "./month-close";
import { isMonthKey, monthKey, previousMonth } from "./rules";

type Result = { ok: true } | { ok: false; error: MessageKey };
const fail = (error: MessageKey): Result => ({ ok: false, error });

/** The months an admin may close by hand: this one (ends its race now) or last month, if it wasn't closed. */
const closable = (month: string) => {
  const current = monthKey(new Date());
  return isMonthKey(month) && (month === current || month === previousMonth(current));
};

/** Admin → Monthly winner: "Close the month and send now" (or a test close). Same job as the 23:59 run. */
export async function closeMonthNow(month: string, test: boolean): Promise<Result> {
  const admin = await adminUser("monthly.manage");
  if (!admin) return fail("auth.errors.generic");
  if (!closable(month)) return fail("admin.monthClose.errors.month");
  const done = await closeMonth(month, { testMode: test, by: admin.id, origin: await linkOrigin() });
  if (done.status === "already") return fail("admin.monthClose.errors.closed");
  refresh();
  return { ok: true };
}

/** "Ask me first": approve a held month; the cards and messages go out. */
export async function approveMonthNow(month: string, test: boolean): Promise<Result> {
  const admin = await adminUser("monthly.manage");
  if (!admin || !isMonthKey(month)) return fail("auth.errors.generic");
  if (!(await approveMonth(month, test, admin.id, await linkOrigin()))) return fail("admin.monthClose.errors.nothing");
  refresh();
  return { ok: true };
}

/** Test mode: remove a month's test results to try again. */
export async function clearTestResults(month: string): Promise<Result> {
  const admin = await adminUser("monthly.manage");
  if (!admin || !isMonthKey(month)) return fail("auth.errors.generic");
  await clearTestMonth(month, admin.id);
  refresh();
  return { ok: true };
}

/** The switches on Admin → Monthly winner (owner, 2026-10-11; the program master switch 2026-10-13). */
const SWITCHES = ["rewards.program_on", "rewards.win_card_on", "rewards.smartphone_card_on", "rewards.gift_box_card_on", "rewards.ask_first"] as const;
export type RewardSwitch = (typeof SWITCHES)[number];

export async function setRewardSwitch(key: RewardSwitch, on: boolean): Promise<Result> {
  const admin = await adminUser("monthly.manage");
  if (!admin || !SWITCHES.includes(key)) return fail("auth.errors.generic");
  const def = SETTINGS[key];
  const { error } = await createAdminClient().from("settings").upsert({ key, value: on, type: def.type, group: def.group, description: def.description, updated_by: admin.id });
  if (error) return fail("admin.errors.generic");
  await audit(admin.id, "update_settings", "settings", "rewards", { changes: { [key]: { to: on } } });
  refresh();
  return { ok: true };
}

/** A prize's progress after the claim: called the winner, then delivered. Each step once, in order. */
export async function markReward(id: string, step: "contacted" | "delivered"): Promise<Result> {
  const admin = await adminUser("monthly.manage");
  if (!admin || !UUID.test(id)) return fail("auth.errors.generic");
  const now = new Date().toISOString();
  const { data } = await createAdminClient()
    .from("monthly_rewards")
    .update(step === "contacted" ? { status: "contacted", contacted_at: now } : { status: "delivered", delivered_at: now })
    .eq("id", id)
    .in("status", step === "contacted" ? ["claimed"] : ["claimed", "contacted"])
    .select("id")
    .maybeSingle();
  if (!data) return fail("admin.monthly.errors.step");
  await audit(admin.id, step === "contacted" ? "reward_contacted" : "reward_delivered", "monthly_reward", id, {});
  refresh();
  return { ok: true };
}

/** The admins' note on a prize (not shown to the winner). */
export async function saveRewardNote(id: string, note: string): Promise<Result> {
  const admin = await adminUser("monthly.manage");
  if (!admin || !UUID.test(id)) return fail("auth.errors.generic");
  const text = String(note ?? "").trim().slice(0, 1000);
  const { data } = await createAdminClient().from("monthly_rewards").update({ admin_note: text || null }).eq("id", id).select("id").maybeSingle();
  if (!data) return fail("admin.errors.generic");
  await audit(admin.id, "reward_note", "monthly_reward", id, {});
  refresh();
  return { ok: true };
}

/** "Send a reminder now" to a winner who hasn't claimed. */
export async function remindRewardNow(id: string): Promise<Result> {
  const admin = await adminUser("monthly.manage");
  if (!admin || !UUID.test(id)) return fail("auth.errors.generic");
  if (!(await remindReward(id, await linkOrigin()))) return fail("admin.monthly.errors.claimed");
  await audit(admin.id, "reward_reminder", "monthly_reward", id, {});
  refresh();
  return { ok: true };
}
