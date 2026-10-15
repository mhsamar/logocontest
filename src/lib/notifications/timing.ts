import { SETTINGS } from "@/lib/settings/registry";
import type { TimingKey } from "./admin-catalog";

/**
 * The timings on Admin › Notifications (owner, 2026-10-15): what each number means, and reading what the owner types
 * ("12, 6" for two reminders). Each is checked against its setting's own rules. Pure.
 */

export type TimingUnit = "minutes" | "hours" | "days" | "times";

export const TIMING_INFO: Record<TimingKey, { unit: TimingUnit; list: boolean }> = {
  "timers.designer_ending_notice_hours": { unit: "hours", list: true },
  "timers.ending_soon_notice_hours": { unit: "hours", list: false },
  "timers.judging_reminder_days": { unit: "days", list: true },
  "timers.files_due_notice_hours": { unit: "hours", list: false },
  "timers.files_strike_hours": { unit: "hours", list: false },
  "timers.payout_hold_days": { unit: "days", list: false },
  "timers.new_entry_digest_hours": { unit: "hours", list: false },
  "rewards.claim_reminder_days": { unit: "days", list: false },
  "rewards.claim_reminders_max": { unit: "times", list: false },
  "notify.chat_email_minutes": { unit: "minutes", list: false },
  "notify.saved_reminder_hours": { unit: "hours", list: true },
  "notify.invite_reminder_hours": { unit: "hours", list: false },
  "notify.pro_renewal_days": { unit: "days", list: true },
  "notify.upgrade_reminder_hours": { unit: "hours", list: true },
};

/** How a timing is shown in its box: "12, 6" or "24". */
export const timingText = (value: unknown) => (Array.isArray(value) ? value.join(", ") : String(value ?? ""));

/** The i18n id of a timing's label (dots are not allowed in message keys). */
export const timingLabelKey = (key: TimingKey) => `admin.notices.timing.${key.replace(/\./g, "_")}`;

/** What the owner typed, as the setting's value, or why it can't be saved. */
export function parseTiming(key: TimingKey, raw: string): { ok: true; value: number | number[] } | { ok: false; error: string } {
  const info = TIMING_INFO[key];
  const parts = String(raw ?? "")
    .split(/[,\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const numbers = parts.map((p) => (/^\d+$/.test(p) ? Number(p) : NaN));
  if (!numbers.length || numbers.some((n) => !Number.isFinite(n))) return { ok: false, error: "number" };
  // Judging days count from the end of the contest (1, 3, 5); the other lists count down to something (12, 6).
  const order = key === "timers.judging_reminder_days" ? (a: number, b: number) => a - b : (a: number, b: number) => b - a;
  const value = info.list ? [...new Set(numbers)].sort(order) : numbers.length === 1 ? numbers[0] : NaN;
  if (typeof value === "number" && !Number.isFinite(value)) return { ok: false, error: "one" };
  const parsed = SETTINGS[key].schema.safeParse(value);
  return parsed.success ? { ok: true, value: parsed.data as number | number[] } : { ok: false, error: "range" };
}
