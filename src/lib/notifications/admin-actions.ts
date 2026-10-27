"use server";

import { refresh } from "next/cache";
import { adminUser, audit, cleanReason } from "@/lib/admin/core";
import type { MessageKey } from "@/lib/i18n/translate";
import { SETTINGS, type SettingKey } from "@/lib/settings/registry";
import { parseTierOff } from "@/lib/email/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { NOTICE_ROWS, parseChannelsOff, type TimingKey } from "./admin-catalog";
import { parseTiming } from "./timing";
import { settingsChanged } from "@/lib/settings";

type Result = { ok: true } | { ok: false; error: MessageKey; errors?: Record<string, string> };

const TIMING_KEYS = new Set<TimingKey>(NOTICE_ROWS.flatMap((r) => r.timing ?? []));

/**
 * Admin › Notifications (owner, 2026-10-15): saves which ways each notice goes and its timings. Like Settings, every
 * save needs a reason and goes to the audit log.
 */
export async function saveNotifications(input: { off: unknown; tierOff?: unknown; timings: Record<string, string> }, reasonText: string): Promise<Result> {
  const admin = await adminUser("notifications.manage");
  if (!admin) return { ok: false, error: "auth.errors.generic" };
  const reason = cleanReason(reasonText);
  if (!reason) return { ok: false, error: "admin.errors.reason" };

  const off = parseChannelsOff(input.off);
  const errors: Record<string, string> = {};
  const values = new Map<SettingKey, unknown>();
  values.set("notifications.channels", off);
  if (input.tierOff !== undefined) values.set("notifications.designer_emails", parseTierOff(input.tierOff));
  for (const [key, raw] of Object.entries(input.timings ?? {})) {
    if (!TIMING_KEYS.has(key as TimingKey)) continue;
    const parsed = parseTiming(key as TimingKey, raw);
    if (parsed.ok) values.set(key as SettingKey, parsed.value);
    else errors[key] = parsed.error;
  }
  if (Object.keys(errors).length) return { ok: false, error: "admin.notices.invalid", errors };

  const db = createAdminClient();
  const keys = [...values.keys()];
  const { data: current } = await db.from("settings").select("key, value").in("key", keys);
  const before = new Map((current ?? []).map((r) => [r.key as string, r.value]));
  const changed = keys.filter((k) => JSON.stringify(values.get(k)) !== JSON.stringify(before.get(k) ?? SETTINGS[k].default));
  if (!changed.length) return { ok: true };
  const { error } = await db
    .from("settings")
    .upsert(changed.map((k) => ({ key: k, value: values.get(k), type: SETTINGS[k].type, group: SETTINGS[k].group, description: SETTINGS[k].description, updated_by: admin.id, updated_at: new Date().toISOString() })));
  settingsChanged();
  if (error) return { ok: false, error: "admin.errors.generic" };
  await audit(admin.id, "update_notifications", "settings", "notifications", { reason, changes: Object.fromEntries(changed.map((k) => [k, { from: before.get(k) ?? null, to: values.get(k) }])) });
  refresh();
  return { ok: true };
}
