/**
 * The site's emails (owner, 2026-10-15; Design/emails/templates.json): one designed template per kind of email, with
 * its subject line and preview text. Pure: shared by render(), the senders, the email settings and the tests.
 */

export const EMAIL_KEYS = [
  "otp",
  "welcome",
  "contest-new",
  "contest-invite",
  "contest-ending",
  "entry-shortlisted",
  "contest-won",
  "client-new-entries",
  "client-pick-winner",
  // A client who saved a contest but didn't pay (owner, 2026-10-26): the notification layout, its own Unsubscribe.
  "contest-reminder",
  "chat-message",
  "logo-check-ready",
  "pro-receipt",
  "pro-renewal",
  "notification",
] as const;
export type EmailKey = (typeof EMAIL_KEYS)[number];

export const isEmailKey = (v: unknown): v is EmailKey => typeof v === "string" && (EMAIL_KEYS as readonly string[]).includes(v);

export const CATALOG: Record<EmailKey, { subject: string; preheader: string }> = {
  otp: { subject: "{{otp_code}} is your logocontest.bd code", preheader: "Your code works for {{otp_minutes}} minutes. Do not share it." },
  welcome: { subject: "Welcome to logocontest.bd", preheader: "Your account is ready." },
  "contest-new": { subject: "New contest: {{contest_title}} · ৳{{prize}}", preheader: "A {{contest_type}} contest is open. Ends {{end_date}}." },
  "contest-invite": { subject: "You are invited: {{contest_title}}", preheader: "{{client_name}} invited you. Prize ৳{{prize}}." },
  "contest-ending": { subject: "{{hours_left}} left: {{contest_title}}", preheader: "The contest ends {{end_date}}." },
  "entry-shortlisted": { subject: "Shortlisted in {{contest_title}}", preheader: "The client liked your entry #{{entry_no}}." },
  "contest-won": { subject: "You won {{contest_title}}!", preheader: "Prize ৳{{prize}}. Upload your final files." },
  "client-new-entries": { subject: "{{new_count}} new designs in {{contest_title}}", preheader: "Take a look and rate them." },
  "client-pick-winner": { subject: "Pick a winner for {{contest_title}}", preheader: "{{entry_count}} designs are waiting." },
  "contest-reminder": { subject: "{{title}}", preheader: "{{preview}}" },
  "chat-message": { subject: "{{sender_name}} sent you a message", preheader: "{{message_preview}}" },
  "logo-check-ready": { subject: "Logo check: {{match_level}} · {{file_name}}", preheader: "Report {{report_id}} is ready." },
  "pro-receipt": { subject: "Receipt {{receipt_no}} · Pro plan ৳{{amount}}", preheader: "Your Pro plan is active until {{period_end}}." },
  "pro-renewal": { subject: "Pro renews in {{days_left}} days", preheader: "Renew to keep early access, invites and {{checks_limit}} logo checks." },
  notification: { subject: "{{title}}", preheader: "{{preview}}" },
};

/**
 * Emails anyone can turn off (Email settings, and the Unsubscribe link in each one). Codes never can, and neither can
 * security emails (password reset, account suspended); those are sent as `security`.
 */
export const OPTIONAL_KEYS = EMAIL_KEYS.filter((k) => k !== "otp");
export type OptionalKey = Exclude<EmailKey, "otp">;
export const isOptionalKey = (v: unknown): v is OptionalKey => isEmailKey(v) && v !== "otp";

/** The switches on each role's Email settings (the welcome email goes once, so it has none). */
export const SETTINGS_KEYS: Record<"designer" | "client", OptionalKey[]> = {
  designer: ["contest-new", "contest-invite", "contest-ending", "entry-shortlisted", "contest-won", "chat-message", "logo-check-ready", "pro-receipt", "pro-renewal", "notification"],
  client: ["client-new-entries", "client-pick-winner", "contest-reminder", "chat-message", "logo-check-ready", "notification"],
};

/**
 * Designer emails by plan (owner, 2026-10-15): in Admin › Notifications the owner turns each designer email on or off
 * for Basic and for Pro designers; only the ones on are sent. Designers have no email settings of their own (only the
 * Unsubscribe link each of these emails must carry).
 */
export const DESIGNER_TIERS = ["basic", "pro"] as const;
export type DesignerTier = (typeof DESIGNER_TIERS)[number];
export type TierOff = Record<DesignerTier, OptionalKey[]>;
export const isDesignerEmail = (key: EmailKey): key is OptionalKey => (SETTINGS_KEYS.designer as readonly string[]).includes(key);

/** The saved switches, cleaned: only designer emails, no repeats. */
export function parseTierOff(raw: unknown): TierOff {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const one = (v: unknown) => [...new Set((Array.isArray(v) ? v : []).filter((k): k is OptionalKey => isOptionalKey(k) && isDesignerEmail(k)))];
  return { basic: one(r.basic), pro: one(r.pro) };
}

/** Whether a designer on this plan gets this email (emails that aren't designer emails are not affected). */
export const tierAllows = (off: TierOff, tier: DesignerTier, key: EmailKey) => !isDesignerEmail(key) || !off[tier].includes(key);

/** Whether this email goes out: codes and security emails always do; the rest unless the person turned it off. */
export function shouldSend(key: EmailKey, off: readonly string[], security = false): boolean {
  if (key === "otp" || security) return true;
  return !off.includes(key);
}

/** The saved list of emails a person turned off, cleaned. */
export function parseEmailOff(raw: unknown): OptionalKey[] {
  return [...new Set((Array.isArray(raw) ? raw : []).filter(isOptionalKey))];
}

/** Chat emails (owner, 2026-10-15): at most one per conversation every 30 minutes. */
export const CHAT_EMAIL_GAP_MS = 30 * 60_000;

/** The new-designs digest goes to a client at most once a day per contest (Admin › Notifications can change it), and only when there is something new. */
export const DIGEST_GAP_MS = 24 * 3_600_000;

export function digestDue(lastSentAt: Date | null, newCount: number, now: Date, gapMs: number = DIGEST_GAP_MS): boolean {
  if (newCount <= 0) return false;
  return !lastSentAt || now.getTime() - lastSentAt.getTime() >= gapMs;
}

/** True when nothing was sent for this conversation within the gap (30 minutes unless Admin › Notifications says otherwise). */
export const chatEmailDue = (lastSentAt: Date | null, now: Date, gapMs: number = CHAT_EMAIL_GAP_MS) => !lastSentAt || now.getTime() - lastSentAt.getTime() >= gapMs;

/** "45 minutes", "2 hours", "1 day": for head starts and reminders. */
export function spanText(minutes: number): string {
  const m = Math.max(1, Math.round(minutes));
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"}`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"}`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"}`;
}

/** Taka amounts as in the designs: "5,000". */
export const taka = (n: number) => Math.round(n).toLocaleString("en-US");
