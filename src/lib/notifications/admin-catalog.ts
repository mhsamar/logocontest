import type { EmailKey } from "@/lib/email/catalog";
import type { NotificationType } from "./types";

/**
 * Admin › Notifications (owner, 2026-10-15): every notice the site sends, one row each, with who gets it, how it
 * goes (bell = in the app, push = browser notification, email) and when. The owner turns each way on or off per row
 * and changes the timings. Codes and security notices can't be turned off. Pure: shared by the admin page, the
 * senders and the tests (which check every notification type has exactly one row).
 */

export const CHANNELS = ["bell", "push", "email"] as const;
export type Channel = (typeof CHANNELS)[number];

export const AUDIENCES = ["designer", "pro", "client", "everyone", "admin"] as const;
export type Audience = (typeof AUDIENCES)[number];

/** A timing on the page: a setting, or the Pro plan's early access (changed in Admin › Pro plan). */
export type TimingKey =
  | "timers.designer_ending_notice_hours"
  | "timers.ending_soon_notice_hours"
  | "timers.judging_reminder_days"
  | "timers.files_due_notice_hours"
  | "timers.files_strike_hours"
  | "timers.payout_hold_days"
  | "timers.new_entry_digest_hours"
  | "rewards.claim_reminder_days"
  | "rewards.claim_reminders_max"
  | "notify.chat_email_minutes"
  | "notify.saved_reminder_hours"
  | "notify.invite_reminder_hours"
  | "notify.pro_renewal_days"
  | "notify.upgrade_reminder_hours";

export type NoticeRow = {
  id: string;
  audience: Audience;
  /** The in-app notification types this row covers (none for email-only notices). */
  types: NotificationType[];
  channels: Channel[];
  email?: EmailKey;
  /** Codes and security notices: always sent. */
  locked?: boolean;
  timing?: TimingKey[];
  /** Pro early access (minutes) is part of this row's timing; it is changed in Admin › Pro plan. */
  earlyAccess?: boolean;
  /** Also switched on or off elsewhere (shown as a note). */
  alsoIn?: "pro" | "user";
};

const row = (id: string, audience: Audience, types: NotificationType[], channels: Channel[], more: Partial<NoticeRow> = {}): NoticeRow => ({ id, audience, types, channels, ...more });
const CHAT: TimingKey[] = ["notify.chat_email_minutes"];

export const NOTICE_ROWS: NoticeRow[] = [
  // ---- Designers (Basic and Pro) ----
  row("contest_new", "designer", ["contest_new", "contest_new_private"], ["bell", "push", "email"], { email: "contest-new", earlyAccess: true, alsoIn: "user" }),
  row("contest_ending", "designer", ["contest_ending", "contest_ending_private"], ["bell", "push", "email"], { email: "contest-ending", timing: ["timers.designer_ending_notice_hours"], alsoIn: "user" }),
  row("contest_ended_entered", "designer", ["contest_ended_entered"], ["bell"]),
  row("brief_updated", "designer", ["brief_updated"], ["bell"]),
  row("contest_extended", "designer", ["contest_extended"], ["bell"]),
  row("entry_rated", "designer", ["entry_rated"], ["bell"]),
  row("entry_comment_client", "designer", ["entry_comment_client"], ["bell", "email"], { email: "chat-message", timing: CHAT, alsoIn: "user" }),
  row("entry_shortlisted", "designer", [], ["email"], { email: "entry-shortlisted", alsoIn: "user" }),
  row("entry_rejected", "designer", ["entry_rejected", "entry_removed", "entry_picture_removed"], ["bell"]),
  row("entry_approved", "designer", ["entry_approved"], ["bell"]),
  row("winner_picked", "designer", ["winner_picked"], ["bell", "email"], { email: "contest-won", alsoIn: "user" }),
  row("contest_closed", "designer", ["contest_closed"], ["bell"]),
  row("win_card_ready", "designer", ["win_card_ready"], ["bell", "email"], { email: "notification", alsoIn: "user" }),
  row("files_due", "designer", ["files_due"], ["bell"], { timing: ["timers.files_due_notice_hours"] }),
  row("handover_updates", "designer", ["handover_revision", "handover_approved", "handover_approved_held"], ["bell"]),
  row("late_files", "designer", ["late_files_strike", "files_missed_banned"], ["bell", "email"], { email: "notification", locked: true, timing: ["timers.files_strike_hours"] }),
  row("prize_released", "designer", ["prize_released", "no_result_share"], ["bell"], { timing: ["timers.payout_hold_days"] }),
  row("guarantee_designer", "designer", ["guarantee_designers"], ["bell"]),
  row("withdrawals", "designer", ["withdrawal_paid", "withdrawal_rejected"], ["bell"]),
  row("agreements", "designer", ["agreement_photo_requested", "agreement_rejected"], ["bell", "email"], { email: "notification", locked: true }),
  row("pro_checkout_reminder", "designer", ["pro_checkout_reminder"], ["bell", "push"], { timing: ["notify.upgrade_reminder_hours"], alsoIn: "pro" }),

  // ---- Pro designers ----
  row("contest_new_pro", "pro", ["contest_new_pro", "contest_new_pro_private"], ["bell", "push", "email"], { email: "contest-new", earlyAccess: true, alsoIn: "user" }),
  row("pro_invited", "pro", ["pro_invited", "pro_invited_private"], ["bell", "push", "email"], { email: "contest-invite", alsoIn: "user" }),
  row("pro_invite_reminder", "pro", ["pro_invite_reminder"], ["bell", "push"], { timing: ["notify.invite_reminder_hours"] }),
  row("pro_saved_reminder", "pro", ["pro_saved_reminder"], ["bell", "push"], { timing: ["notify.saved_reminder_hours"], alsoIn: "user" }),
  row("pro_message", "pro", ["pro_message"], ["bell", "push", "email"], { email: "chat-message", timing: CHAT, alsoIn: "user" }),
  row("pro_activated", "pro", ["pro_activated"], ["bell", "push", "email"], { email: "pro-receipt", alsoIn: "user" }),
  row("pro_renew", "pro", ["pro_renew_7d", "pro_renew_1d"], ["bell", "push", "email"], { email: "pro-renewal", timing: ["notify.pro_renewal_days"], alsoIn: "user" }),
  row("pro_expired", "pro", ["pro_expired"], ["bell", "push", "email"], { email: "notification", alsoIn: "user" }),
  row("pro_account", "pro", ["pro_cancelled", "pro_payment_failed", "pro_granted", "pro_price_change"], ["bell", "push"]),
  row("pro_trial", "pro", ["pro_trial_started", "pro_trial_ending", "pro_trial_ended", "pro_trial_extended"], ["bell", "push", "email"], { email: "notification", alsoIn: "user" }),
  row("pro_weekly", "pro", ["pro_weekly"], ["bell", "push", "email"], { email: "notification", alsoIn: "user" }),

  // ---- Clients ----
  row("payments", "client", ["payment_received", "payment_approved_contest", "payment_approved_addon", "payment_rejected"], ["bell", "push"]),
  row("entry_new", "client", ["entry_new"], ["bell", "email"], { email: "client-new-entries", timing: ["timers.new_entry_digest_hours"], alsoIn: "user" }),
  row("entry_comment_designer", "client", ["entry_comment_designer"], ["bell", "email"], { email: "chat-message", timing: CHAT, alsoIn: "user" }),
  row("ending_soon", "client", ["ending_soon", "ending_soon_extend"], ["bell"], { timing: ["timers.ending_soon_notice_hours"] }),
  row("judging_started", "client", ["judging_started"], ["bell", "email"], { email: "client-pick-winner", alsoIn: "user" }),
  row("judging_reminder", "client", ["judging_reminder"], ["bell"], { timing: ["timers.judging_reminder_days"] }),
  row("handover_submitted", "client", ["handover_submitted"], ["bell"]),
  row("winner_changes", "client", ["repick_winner", "winner_picked_by_admin", "no_result_client"], ["bell"]),
  // Money-back guarantee (owner, 2026-10-21): too few designers, the claim, the decision and the money back.
  row("guarantee", "client", ["guarantee_available", "guarantee_claimed", "guarantee_approved", "guarantee_rejected", "guarantee_refunded"], ["bell", "email"], { email: "notification" }),

  // ---- Everyone ----
  row("welcome", "everyone", [], ["push", "email"], { email: "welcome", alsoIn: "user" }),
  row("email_code", "everyone", [], ["email"], { email: "otp", locked: true }),
  row("password_reset", "everyone", [], ["email"], { email: "notification", locked: true }),
  row("account_status", "everyone", ["account_suspended", "account_banned", "account_reactivated"], ["bell", "email"], { email: "notification", locked: true }),
  row("handover_message", "everyone", ["handover_message"], ["bell", "email"], { email: "chat-message", timing: CHAT, alsoIn: "user" }),
  row("comments", "everyone", ["entry_comment_other", "contest_comment"], ["bell"]),
  row("contest_cancelled", "everyone", ["contest_cancelled", "contest_cancelled_client"], ["bell"]),
  row("logo_check_ready", "everyone", [], ["email"], { email: "logo-check-ready", alsoIn: "user" }),
  row("copy_claims", "everyone", ["claim_opened", "claim_rejected_client", "claim_rejected_designer", "claim_correction_client", "claim_correction_designer", "claim_upheld_client", "claim_fined", "claim_banned"], ["bell"]),
  row("moderation", "everyone", ["flag_warning", "report_upheld", "report_dismissed"], ["bell"]),
  row("monthly_won", "everyone", ["monthly_smartphone_won", "monthly_gift_box_won"], ["bell", "email"], { email: "notification", alsoIn: "user" }),
  row("monthly_claim_reminder", "everyone", ["monthly_claim_reminder"], ["bell", "email"], { email: "notification", timing: ["rewards.claim_reminder_days", "rewards.claim_reminders_max"], alsoIn: "user" }),
  row("support", "everyone", ["support_reply", "admin_message"], ["bell", "push"]),

  // ---- Admins ----
  row("admin_support", "admin", ["support_message_admin", "support_assigned_admin"], ["bell", "push"]),
  row("admin_designs", "admin", ["entry_held_admin"], ["bell", "push"]),
  row("admin_payments", "admin", ["payment_submitted_admin", "withdrawal_requested_admin"], ["bell"]),
  row("admin_refunds", "admin", ["guarantee_claimed_admin", "guarantee_overdue_admin"], ["bell", "email"], { email: "notification" }),
  row("admin_monthly", "admin", ["monthly_review", "monthly_sent", "monthly_no_winner", "monthly_claimed"], ["bell", "email"], { email: "notification" }),
  row("admin_safety", "admin", ["claim_opened_admin", "late_files_admin", "files_missed_admin", "agreement_photo_added_admin"], ["bell"]),
];

export type NoticeId = string;

/** Old notification types the site no longer sends (kept so old notices still show). */
export const RETIRED_TYPES: NotificationType[] = [
  "entry_comment",
  "ending_soon_designer",
  "win_cancelled",
  "strike_received",
  "monthly_champion",
  "monthly_announced",
  "monthly_proposed",
  "gift_address_given",
  "gift_sent",
  "design_liked",
  "design_liked_client",
];

const BY_ID = new Map(NOTICE_ROWS.map((r) => [r.id, r]));
const BY_TYPE = new Map(NOTICE_ROWS.flatMap((r) => r.types.map((t) => [t, r] as const)));

export const noticeRow = (id: string): NoticeRow | undefined => BY_ID.get(id);
export const rowOfType = (type: NotificationType): NoticeRow | undefined => BY_TYPE.get(type);

/** What the owner turned off: row id → the ways turned off. */
export type ChannelsOff = Record<string, Channel[]>;

/** The saved switches, cleaned: known rows, ways that row uses, never a locked row. */
export function parseChannelsOff(raw: unknown): ChannelsOff {
  const out: ChannelsOff = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const r = BY_ID.get(id);
    if (!r || r.locked || !Array.isArray(value)) continue;
    const off = [...new Set(value.filter((c): c is Channel => (CHANNELS as readonly string[]).includes(c as string) && r.channels.includes(c as Channel)))];
    if (off.length) out[id] = off;
  }
  return out;
}

/** Whether this row goes out this way. Locked rows and unknown ids always do. */
export function channelOn(off: ChannelsOff, id: string | undefined, channel: Channel): boolean {
  if (!id) return true;
  const r = BY_ID.get(id);
  if (!r || r.locked) return true;
  return !(off[id] ?? []).includes(channel);
}

/** Whether this notification type goes out this way (bell or push). */
export const typeOn = (off: ChannelsOff, type: NotificationType, channel: Channel) => channelOn(off, rowOfType(type)?.id, channel);

// ---- Timings that are not plain numbers of hours ------------------------------------------------------------------

/** A Pro renewal reminder slot ("7d" = the first, "1d" = the second) that is due now, if any. */
export function renewalSlot(msLeft: number, days: readonly number[], sent: { first: boolean; second: boolean }): "7d" | "1d" | null {
  const [first, second] = [...days].sort((a, b) => b - a);
  const DAY = 86_400_000;
  if (second !== undefined && msLeft <= second * DAY && !sent.second) return "1d";
  if (first !== undefined && msLeft <= first * DAY && (second === undefined || msLeft > second * DAY) && !sent.first) return "7d";
  return null;
}

/** The two-reminder slots used by saved contests and upgrade reminders: the first and second hours, largest first. */
export const twoSlots = (hours: readonly number[]): [number, number | null] => {
  const [a, b] = [...hours].sort((x, y) => y - x);
  return [a, b ?? null];
};
