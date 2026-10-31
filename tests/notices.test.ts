import { describe, expect, it } from "vitest";
import { chatEmailDue, digestDue, isEmailKey } from "@/lib/email/catalog";
import { MESSAGES } from "@/lib/i18n/messages";
import { AUDIENCES, channelOn, hasRoleEmails, NOTICE_ROWS, parseChannelsOff, parseRoleEmailsOff, RETIRED_TYPES, rowOfType, twoSlots, typeOn } from "@/lib/notifications/admin-catalog";
import { parseTiming, TIMING_INFO, timingLabelKey, timingText } from "@/lib/notifications/timing";
import { NOTIFICATION_TYPES } from "@/lib/notifications/types";
import { renewalReminderDue } from "@/lib/pro/rules";
import { DEFAULT_REMINDERS } from "@/lib/admin/unpaid-alert-rules";
import { SETTINGS } from "@/lib/settings/registry";

const text = (locale: "en" | "bn", key: string): unknown => key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), MESSAGES[locale]);

describe("Admin › Notifications catalog (owner, 2026-10-15)", () => {
  it("every notification type has exactly one row, unless the site no longer sends it", () => {
    for (const type of NOTIFICATION_TYPES) {
      const rows = NOTICE_ROWS.filter((r) => r.types.includes(type));
      if (RETIRED_TYPES.includes(type)) expect(rows, type).toHaveLength(0);
      else expect(rows.map((r) => r.id), type).toHaveLength(1);
    }
    expect(new Set(NOTICE_ROWS.map((r) => r.id)).size).toBe(NOTICE_ROWS.length);
  });

  it("every row is complete: a known audience, its ways, its email, its timings, its words in both languages", () => {
    for (const r of NOTICE_ROWS) {
      expect(AUDIENCES).toContain(r.audience);
      expect(r.channels.length, r.id).toBeGreaterThan(0);
      expect(Boolean(r.email), r.id).toBe(r.channels.includes("email"));
      if (r.email) expect(isEmailKey(r.email)).toBe(true);
      if (!r.types.length) expect(r.channels, r.id).not.toContain("bell");
      for (const k of r.timing ?? []) {
        expect(TIMING_INFO[k], k).toBeDefined();
        expect(SETTINGS[k], k).toBeDefined();
      }
      for (const locale of ["en", "bn"] as const) {
        expect(typeof text(locale, `admin.notices.rows.${r.id}.label`), `${locale} ${r.id}`).toBe("string");
        expect(typeof text(locale, `admin.notices.rows.${r.id}.when`), `${locale} ${r.id}`).toBe("string");
        for (const k of r.timing ?? []) expect(typeof text(locale, timingLabelKey(k)), `${locale} ${k}`).toBe("string");
      }
    }
    for (const a of AUDIENCES) expect(NOTICE_ROWS.some((r) => r.audience === a), a).toBe(true);
  });

  it("payments and withdrawals to check reach the admins in the app, on the phone and by email (owner, 2026-10-22)", () => {
    expect(NOTICE_ROWS.find((r) => r.id === "admin_payments")?.channels).toEqual(["bell", "push", "email"]);
    expect(rowOfType("payment_submitted_admin")?.id).toBe("admin_payments");
    expect(rowOfType("withdrawal_requested_admin")?.id).toBe("admin_payments");
    const holes = (s: unknown) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const k of ["payment.subject", "payment.body", "payment.bodyQa", "payment.what.contest", "payment.what.addon", "payment.what.pro", "withdrawal.subject", "withdrawal.body"]) {
      expect(typeof text("en", `admin.alerts.${k}`), k).toBe("string");
      expect(holes(text("bn", `admin.alerts.${k}`)), k).toEqual(holes(text("en", `admin.alerts.${k}`)));
    }
    // The email's button is the first link in its text.
    for (const k of ["payment.body", "payment.bodyQa", "withdrawal.body"]) expect(holes(text("en", `admin.alerts.${k}`)), k).toContain("link");
  });

  // Owner, 2026-10-31: codes and password resets stay locked; account status, late files and agreements can be turned
  // off (designers get them in the bell only).
  it("codes and password resets are always on", () => {
    for (const id of ["email_code", "password_reset"]) expect(NOTICE_ROWS.find((r) => r.id === id)?.locked, id).toBe(true);
    for (const id of ["account_status", "late_files", "agreements"]) expect(NOTICE_ROWS.find((r) => r.id === id)?.locked, id).toBeUndefined();
    expect(parseChannelsOff({ email_code: ["email"], password_reset: ["email"] })).toEqual({});
    expect(channelOn({ email_code: ["email"] }, "email_code", "email")).toBe(true);
  });

  it("notices for everyone have an email tick for clients and one for designers", () => {
    const off = parseRoleEmailsOff({ client: ["welcome", "welcome", "email_code", "contest_new", "nope"], designer: "x" });
    expect(off).toEqual({ client: ["welcome"], designer: [] });
    const role = (r: string | null) => ({ off: { client: ["welcome"], designer: ["account_status"] }, role: r });
    expect(channelOn({}, "welcome", "email", role("client"))).toBe(false);
    expect(channelOn({}, "welcome", "email", role("designer"))).toBe(true);
    expect(channelOn({}, "account_status", "email", role("designer"))).toBe(false);
    expect(channelOn({}, "account_status", "email", role("client"))).toBe(true);
    // Admins and addresses without an account aren't affected; nor is the bell.
    expect(channelOn({}, "account_status", "email", role("admin"))).toBe(true);
    expect(channelOn({}, "account_status", "email", role(null))).toBe(true);
    expect(channelOn({}, "account_status", "bell", role("designer"))).toBe(true);
    // The row's own email switch still wins.
    expect(channelOn({ welcome: ["email"] }, "welcome", "email", role("designer"))).toBe(false);
    expect(NOTICE_ROWS.filter(hasRoleEmails).every((r) => r.audience === "everyone" && !r.locked)).toBe(true);
  });

  it("the owner's email plan (2026-10-31) is the default", () => {
    const off = parseChannelsOff(SETTINGS["notifications.channels"].default);
    const roles = parseRoleEmailsOff(SETTINGS["notifications.role_emails"].default);
    const to = (id: string, r: "client" | "designer") => channelOn(off, id, "email", { off: roles, role: r });
    // Clients: codes, password reset, the bKash emails, the daily new-designs email, pick a winner, monthly prizes,
    // the team's reminders and account status.
    for (const id of ["email_code", "password_reset", "onboarding_received", "onboarding_live", "entry_new", "judging_started", "monthly_won", "monthly_claim_reminder", "profile_reminders", "account_status"]) expect(to(id, "client"), id).toBe(true);
    for (const id of ["welcome", "entry_comment_designer", "unpaid_reminders", "guarantee", "handover_message", "logo_check_ready"]) expect(to(id, "client"), id).toBe(false);
    // The unpaid reminders are also off where the team runs them, Admin › Unpaid contests, so both pages say so.
    expect(DEFAULT_REMINDERS).toEqual({ first: false, last: false });
    // Designers: codes, welcome, password reset, won, win card, the Pro plan's emails; new contests for Pro only.
    for (const id of ["email_code", "welcome", "password_reset", "winner_picked", "win_card_ready", "contest_new", "contest_new_pro", "pro_activated", "pro_renew", "pro_expired", "pro_trial"]) expect(to(id, "designer"), id).toBe(true);
    for (const id of ["contest_ending", "entry_comment_client", "entry_shortlisted", "agreements", "account_status", "pro_invited", "pro_message", "pro_weekly", "handover_message", "logo_check_ready", "monthly_won", "monthly_claim_reminder", "profile_reminders"]) expect(to(id, "designer"), id).toBe(false);
    expect(SETTINGS["notifications.designer_emails"].default).toEqual({ basic: ["contest-new"], pro: [] });
    expect(SETTINGS["email.daily_limit"].default).toBe(100);
  });

  it("the saved switches are cleaned, and each way of a notice is switched on its own", () => {
    const off = parseChannelsOff({ contest_new: ["email", "email", "fax"], entry_rated: ["push"], nope: ["bell"], comments: "bell" });
    expect(off).toEqual({ contest_new: ["email"] });
    expect(parseChannelsOff(null)).toEqual({});
    expect(channelOn(off, "contest_new", "email")).toBe(false);
    expect(channelOn(off, "contest_new", "bell")).toBe(true);
    expect(channelOn(off, undefined, "email")).toBe(true);
    expect(typeOn({ contest_ending: ["push"] }, "contest_ending_private", "push")).toBe(false);
    expect(typeOn({ contest_ending: ["push"] }, "contest_ending_private", "bell")).toBe(true);
    expect(rowOfType("pro_renew_1d")?.id).toBe("pro_renew");
  });
});

describe("timings typed on Admin › Notifications", () => {
  it("reads one number or a list", () => {
    expect(parseTiming("notify.chat_email_minutes", " 45 ")).toEqual({ ok: true, value: 45 });
    expect(parseTiming("timers.designer_ending_notice_hours", "6, 12, 12")).toEqual({ ok: true, value: [12, 6] });
    expect(parseTiming("notify.saved_reminder_hours", "2 24")).toEqual({ ok: true, value: [24, 2] });
    expect(parseTiming("timers.judging_reminder_days", "5,1,3")).toEqual({ ok: true, value: [1, 3, 5] });
    expect(timingText([12, 6])).toBe("12, 6");
    expect(timingText(30)).toBe("30");
  });

  it("refuses what the setting doesn't allow", () => {
    expect(parseTiming("notify.chat_email_minutes", "abc")).toEqual({ ok: false, error: "number" });
    expect(parseTiming("notify.chat_email_minutes", "10, 20")).toEqual({ ok: false, error: "one" });
    expect(parseTiming("notify.chat_email_minutes", "0")).toEqual({ ok: false, error: "range" });
    expect(parseTiming("notify.pro_renewal_days", "7, 3, 1")).toEqual({ ok: false, error: "range" });
    expect(parseTiming("notify.digest_hour", "")).toEqual({ ok: false, error: "number" });
    expect(parseTiming("notify.digest_hour", "24")).toEqual({ ok: false, error: "range" });
    expect(parseTiming("notify.digest_hour", "0")).toEqual({ ok: true, value: 0 });
  });

  it("the new-designs email goes at 7 pm at first, and chat emails every 30 minutes", () => {
    expect(SETTINGS["notify.digest_hour"].default).toBe(19);
    expect(SETTINGS["notify.chat_email_minutes"].default).toBe(30);
    const now = new Date("2026-10-15T12:00:00Z");
    const ago = (min: number) => new Date(now.getTime() - min * 60_000);
    expect(digestDue(ago(30 * 60), 2, now, 17)).toBe(true);
    expect(digestDue(ago(30 * 60), 2, now)).toBe(false);
    expect(chatEmailDue(ago(10), now, 10 * 60_000)).toBe(true);
    expect(chatEmailDue(ago(10), now)).toBe(false);
  });

  it("Pro renewal reminders follow the days set", () => {
    const now = new Date("2026-10-15T00:00:00Z");
    const sub = (daysLeft: number, sent: { first?: boolean; second?: boolean } = {}) => ({
      status: "active" as const,
      currentPeriodEnd: new Date(now.getTime() + daysLeft * 86_400_000),
      autoRenew: true,
      reminded7dAt: sent.first ? now : null,
      reminded1dAt: sent.second ? now : null,
    });
    expect(renewalReminderDue(sub(9), now, [10, 2])).toBe("7d");
    expect(renewalReminderDue(sub(9), now)).toBe(null);
    expect(renewalReminderDue(sub(2), now, [10, 2])).toBe("1d");
    expect(renewalReminderDue(sub(9, { first: true }), now, [10, 2])).toBe(null);
    // One reminder only.
    expect(renewalReminderDue(sub(3), now, [3])).toBe("7d");
    expect(renewalReminderDue(sub(1), now, [3])).toBe("7d");
    expect(renewalReminderDue(sub(1, { first: true }), now, [3])).toBe(null);
  });

  it("two-reminder slots: largest first", () => {
    expect(twoSlots([2, 24])).toEqual([24, 2]);
    expect(twoSlots([5])).toEqual([5, null]);
  });
});
