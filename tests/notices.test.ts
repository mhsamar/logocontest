import { describe, expect, it } from "vitest";
import { chatEmailDue, digestDue, isEmailKey } from "@/lib/email/catalog";
import { MESSAGES } from "@/lib/i18n/messages";
import { AUDIENCES, channelOn, NOTICE_ROWS, parseChannelsOff, RETIRED_TYPES, rowOfType, twoSlots, typeOn } from "@/lib/notifications/admin-catalog";
import { parseTiming, TIMING_INFO, timingLabelKey, timingText } from "@/lib/notifications/timing";
import { NOTIFICATION_TYPES } from "@/lib/notifications/types";
import { renewalReminderDue } from "@/lib/pro/rules";
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

  it("codes and security notices are always on", () => {
    for (const id of ["email_code", "password_reset", "account_status", "late_files", "agreements"]) expect(NOTICE_ROWS.find((r) => r.id === id)?.locked, id).toBe(true);
    const off = parseChannelsOff({ email_code: ["email"], account_status: ["bell", "email"] });
    expect(off).toEqual({});
    expect(channelOn({ account_status: ["bell"] }, "account_status", "bell")).toBe(true);
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
    expect(parseTiming("timers.new_entry_digest_hours", "")).toEqual({ ok: false, error: "number" });
    expect(parseTiming("timers.new_entry_digest_hours", "-3")).toEqual({ ok: false, error: "number" });
  });

  it("the new-designs email is once a day at first, and chat emails every 30 minutes", () => {
    expect(SETTINGS["timers.new_entry_digest_hours"].default).toBe(24);
    expect(SETTINGS["notify.chat_email_minutes"].default).toBe(30);
    const now = new Date("2026-10-15T12:00:00Z");
    const ago = (min: number) => new Date(now.getTime() - min * 60_000);
    expect(digestDue(ago(3 * 60), 2, now, 3 * 3_600_000)).toBe(true);
    expect(digestDue(ago(3 * 60), 2, now)).toBe(false);
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
