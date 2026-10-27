"use server";

import { refresh } from "next/cache";
import type { MessageKey } from "@/lib/i18n/translate";
import { SETTINGS } from "@/lib/settings/registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { alertsSchema, remindersSchema } from "./unpaid-alert-rules";
import { adminUser, audit } from "./core";
import { settingsChanged } from "@/lib/settings";

/**
 * Admin › Unpaid contests, phase 3 (owner, 2026-10-26): the team's Instant alerts and the Automatic reminders to clients,
 * one shared setting each (owner, 2026-10-26). Unpaid contests · manage; each change is in the audit log.
 */

type Result = { ok: true } | { ok: false; error: MessageKey };
const fail = (error: MessageKey): Result => ({ ok: false, error });

async function save(key: "notify.unpaid_alerts" | "notify.unpaid_reminders", value: unknown, by: string): Promise<boolean> {
  const def = SETTINGS[key];
  const { error } = await createAdminClient().from("settings").upsert({ key, value, type: def.type, group: def.group, description: def.description, updated_by: by, updated_at: new Date().toISOString() });
  settingsChanged();
  if (error) console.error("[unpaid-alerts] save:", error.message);
  return !error;
}

export async function saveUnpaidAlerts(input: unknown): Promise<Result> {
  const admin = await adminUser("unpaid.manage");
  if (!admin) return fail("auth.errors.generic");
  const parsed = alertsSchema.safeParse(input);
  if (!parsed.success) return fail("admin.errors.generic");
  if (!(await save("notify.unpaid_alerts", parsed.data, admin.id))) return fail("admin.errors.generic");
  await audit(admin.id, "unpaid_alert_settings", "settings", "notify.unpaid_alerts", { to: parsed.data });
  refresh();
  return { ok: true };
}

export async function saveUnpaidReminders(input: unknown): Promise<Result> {
  const admin = await adminUser("unpaid.manage");
  if (!admin) return fail("auth.errors.generic");
  const parsed = remindersSchema.safeParse(input);
  if (!parsed.success) return fail("admin.errors.generic");
  if (!(await save("notify.unpaid_reminders", parsed.data, admin.id))) return fail("admin.errors.generic");
  await audit(admin.id, "unpaid_reminder_settings", "settings", "notify.unpaid_reminders", { to: parsed.data });
  refresh();
  return { ok: true };
}
