/**
 * Admin › Unpaid contests, phase 3 (owner, 2026-10-26; Design/unpaid-contests §2, §9): the team's instant alerts and the
 * automatic reminders to clients — which events alert, how, quiet hours, when a follow-up is due or overdue and when a
 * client is reminded. One shared setting for the whole team (owner, 2026-10-26), changed with Unpaid · Manage. Pure:
 * shared by the senders, the admin page and the tests. Times are Bangladesh time (UTC+6, no summer time).
 */
import { z } from "zod";
import type { NotificationType } from "@/lib/notifications/types";
import { dhakaMidnight } from "./unpaid-rules";

// ---- Instant alerts ---------------------------------------------------------------------------------------------------

export const ALERT_EVENTS = ["new_unpaid", "payment_failed", "came_back", "creating_now", "followup_due", "followup_overdue"] as const;
export type AlertEvent = (typeof ALERT_EVENTS)[number];
/** "Send to" (SMS is shown but can't be chosen until there is an SMS provider). */
export const SEND_WAYS = ["popup", "sound", "push", "email"] as const;
export type SendWay = (typeof SEND_WAYS)[number];

const on = (v: boolean) => z.boolean().default(v);
/** Each part has its own default, so a setting saved before a new switch existed keeps the owner's other choices. */
export const alertsSchema = z.object({
  events: z.object({ new_unpaid: on(true), payment_failed: on(true), came_back: on(true), creating_now: on(false), followup_due: on(true), followup_overdue: on(true) }).prefault({}),
  send: z.object({ popup: on(true), sound: on(true), push: on(true), email: on(false) }).prefault({}),
  quiet: z.object({ on: on(true), from: z.number().int().min(0).max(23).default(0), to: z.number().int().min(0).max(23).default(8) }).prefault({}),
});
export type UnpaidAlerts = z.infer<typeof alertsSchema>;
export const DEFAULT_ALERTS: UnpaidAlerts = alertsSchema.parse({});

/** The notification types each event makes. A guest who left a number ("New client to call") is a new unpaid contest too. */
export const EVENT_TYPES: Record<AlertEvent, NotificationType[]> = {
  new_unpaid: ["unpaid_new_admin", "lead_new_admin", "leads_new_admin"],
  payment_failed: ["unpaid_failed_admin"],
  came_back: ["unpaid_back_admin"],
  creating_now: ["unpaid_live_admin"],
  followup_due: ["followup_due_admin"],
  followup_overdue: ["followup_overdue_admin"],
};
/** One pop-up in the admin panel: its event's title, the alert's line, the lead (to call or open). Never a number. */
export type AlertPop = { id: string; event: string; title: string; line: string; key: string | null; link: string | null; at: string };

/** Every type that can pop up in the admin panel. */
export const POP_TYPES = Object.values(EVENT_TYPES).flat();
export const eventOf = (type: string): AlertEvent | null => ALERT_EVENTS.find((e) => (EVENT_TYPES[e] as string[]).includes(type)) ?? null;

/** Quiet hours, e.g. 0–8 = midnight to 8 am; a window can run past midnight (22–7). Bell rows still collect. */
export function inQuietHours(quiet: UnpaidAlerts["quiet"], now: Date): boolean {
  if (!quiet.on || quiet.from === quiet.to) return false;
  const h = new Date(now.getTime() + 6 * 3_600_000).getUTCHours();
  return quiet.from < quiet.to ? h >= quiet.from && h < quiet.to : h >= quiet.from || h < quiet.to;
}

/** A follow-up the jobs missed by a little (a late run, the 15-minute job alone) is still told, once, as due. */
export const DUE_GRACE_MS = 15 * 60_000;
/** "Follow-up is due": the planned time is within the next [10 min] (the job runs every 5 minutes), or just passed. */
export const isDueSoon = (nextAt: Date, now: Date, minutes: number) => nextAt.getTime() > now.getTime() - DUE_GRACE_MS && nextAt.getTime() - now.getTime() <= minutes * 60_000;

/** "Follow-up overdue": planned for the day that just ended (Bangladesh) and not done. Older ones were told already. */
export const isOverdueDay = (nextAt: Date, now: Date) => nextAt.getTime() < dhakaMidnight(now).getTime() && nextAt.getTime() >= dhakaMidnight(now, -1).getTime();

/** Free text in an alert (a bKash note, a guest's brand) without phone numbers or email addresses in it. */
export const scrubContacts = (s: string) =>
  s
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "…")
    .replace(/\+?[\d০-৯][\d০-৯ ()-]{5,}[\d০-৯]/g, "…")
    .slice(0, 120);

/** "Remind me by" on a follow-up (SMS stays off until there is an SMS provider). */
export const REMIND_WAYS = ["alert", "email", "sms"] as const;
export type RemindWay = (typeof REMIND_WAYS)[number];
export const cleanRemindBy = (v: unknown): RemindWay[] | null => (Array.isArray(v) ? [...new Set(v.filter((x): x is RemindWay => x === "alert" || x === "email"))] : null);

/** How a follow-up's owner is told: "Remind me by" when chosen, else the team's "Send to". The bell always. */
export function followUpWays(send: UnpaidAlerts["send"], remindBy: RemindWay[] | null): { push: boolean; email: boolean } {
  if (!remindBy) return { push: send.push, email: send.email };
  return { push: remindBy.includes("alert") && send.push, email: remindBy.includes("email") };
}

// ---- Automatic reminders to the client --------------------------------------------------------------------------------

// Both off since the owner's email plan (2026-10-31): unpaid clients get no email unless the team turns one on here.
export const remindersSchema = z.object({ first: on(false), last: on(false) });
export type UnpaidReminders = z.infer<typeof remindersSchema>;
export const DEFAULT_REMINDERS: UnpaidReminders = remindersSchema.parse({});

/** Reminders to clients go out between 8 am and 10 pm only. */
export const CLIENT_HOURS = { from: 8, to: 22 } as const;
export const clientHour = (now: Date) => {
  const h = new Date(now.getTime() + 6 * 3_600_000).getUTCHours();
  return h >= CLIENT_HOURS.from && h < CLIENT_HOURS.to;
};

/** A team member talking to them counts as a reply: reminders stop (as when they answer the help chat or support). */
export const REPLY_RESULTS = ["talked", "will_pay", "needs_help", "not_interested"] as const;

const H = 3_600_000;
/**
 * Which reminder a draft gets now, if any. First: [1 hour] after their last activity, while the draft is young. Last
 * ("2 days", owner 2026-10-26): [48 hours] after it was started, if nothing happened for 6 hours, and before the Trash.
 */
export function reminderDue(d: { createdAt: Date; lastActivity: Date; now: Date; firstHours: number; lastHours: number; trashHours: number; sent: { first: boolean; last: boolean }; on: UnpaidReminders }): "first" | "last" | null {
  const age = d.now.getTime() - d.createdAt.getTime();
  const idle = d.now.getTime() - d.lastActivity.getTime();
  const beforeTrash = !d.trashHours || age < d.trashHours * H - 30 * 60_000;
  // At least 14 hours before the Trash, so its window always has daytime hours (reminders only go 8 am – 10 pm).
  const lastHours = d.trashHours ? Math.min(d.lastHours, d.trashHours - 14) : d.lastHours;
  if (d.on.last && !d.sent.last && age >= lastHours * H && age < (lastHours + 24) * H && idle >= 6 * H && beforeTrash) return "last";
  if (d.on.first && !d.sent.first && !d.sent.last && idle >= d.firstHours * H && age < lastHours * H && beforeTrash) return "first";
  return null;
}

/** Whether reminders to this draft stop: paid or waiting for a bKash check, the lead closed or stopped, or they replied. */
export function remindersStopped(d: { status: string; awaitingApproval: boolean; lead: { status: string; stop: boolean; hidden: boolean; blocked: boolean } | null; replied: boolean; blockedContact: boolean }): boolean {
  if (d.status !== "draft" && d.status !== "pending_payment") return true;
  if (d.awaitingApproval || d.replied || d.blockedContact) return true;
  return Boolean(d.lead && (d.lead.status === "closed" || d.lead.stop || d.lead.hidden || d.lead.blocked));
}
