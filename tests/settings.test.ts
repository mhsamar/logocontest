import { describe, expect, it } from "vitest";
import { SETTINGS, parseSetting, type SettingKey } from "@/lib/settings/registry";

describe("settings registry", () => {
  it("every default passes its own schema", () => {
    for (const [key, def] of Object.entries(SETTINGS)) {
      expect(def.schema.safeParse(def.default).success, key).toBe(true);
    }
  });

  it("returns stored values when valid", () => {
    expect(parseSetting("otp.length", 4)).toBe(4);
  });

  it("falls back to the default when the stored value is invalid or missing", () => {
    expect(parseSetting("otp.length", "six")).toBe(6);
    expect(parseSetting("otp.length", 99)).toBe(6);
    expect(parseSetting("otp.ttl_minutes" as SettingKey, undefined)).toBe(5);
  });
});

describe("BLUEPRINT defaults", () => {
  const d = <K extends keyof typeof SETTINGS>(k: K) => SETTINGS[k].default;

  it("packages and fees match §2 and §7", () => {
    expect([d("packages.economy_prize"), d("packages.standard_prize"), d("packages.premium_prize")]).toEqual([3000, 5000, 10000]);
    expect([d("packages.custom_min_prize"), d("packages.custom_step")]).toEqual([3000, 500]);
    expect(d("fees.client_service_fee_percent")).toBe(20);
    expect(d("fees.designer_tiers")).toEqual([
      { min_wins: 0, rate_percent: 7 },
      { min_wins: 5, rate_percent: 5 },
      { min_wins: 10, rate_percent: 2 },
    ]);
  });

  it("timers and limits match §6, §7.3 and §9", () => {
    expect(d("timers.contest_duration_options_days")).toEqual([5, 7, 10]);
    expect(d("timers.contest_duration_default_days")).toBe(7);
    expect(d("timers.judging_window_days")).toBe(5);
    expect(d("timers.repick_window_days")).toBe(3);
    expect(d("timers.judging_reminder_days")).toEqual([1, 3, 5]);
    expect(d("timers.designer_file_upload_days")).toBe(3);
    expect(d("timers.client_auto_approve_days")).toBe(5);
    expect(d("limits.max_revision_requests")).toBe(2);
    expect(d("limits.withdrawal_min")).toBe(500);
    expect([d("limits.entry_min_images"), d("limits.entry_max_images")]).toEqual([5, 10]);
    expect(d("limits.max_entries_per_designer")).toBe(0); // unlimited
    expect(d("limits.approval_feedback_max_words")).toBe(120);
    expect(d("limits.false_flag_warnings_for_ban")).toBe(3);
  });

  it("every setting belongs to an A-11 group or auth", () => {
    const groups = new Set(Object.values(SETTINGS).map((s) => s.group));
    expect([...groups].sort()).toEqual(["auth", "fees", "limits", "monthly", "packages", "timers", "upgrades"]);
  });
});
