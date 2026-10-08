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
    // Owner, 2026-10-08: Starter, Growth, Pro, Premium, Elite.
    expect([d("packages.economy_prize"), d("packages.standard_prize"), d("packages.pro_prize"), d("packages.premium_prize"), d("packages.elite_prize")]).toEqual([
      3000, 5000, 8000, 12000, 15000,
    ]);
    expect([d("timers.contest_duration_min_days"), d("timers.contest_duration_max_days")]).toEqual([3, 30]);
    expect([d("upgrades.logo_scan_price"), d("upgrades.highlight_price"), d("upgrades.urgent_price"), d("upgrades.nda_price")]).toEqual([500, 500, 500, 1500]);
    expect([d("packages.custom_min_prize"), d("packages.custom_step")]).toEqual([3000, 500]);
    expect(d("fees.client_service_fee_percent")).toBe(20);
    // Extension is a paid add-on, never free (owner, 2026-10-07)
    expect(d("upgrades.extension_price_per_day")).toBe(500);
    expect([d("upgrades.blind_price"), d("upgrades.private_price"), d("upgrades.promoted_price")]).toEqual([1000, 1000, 1000]);
    expect(d("monthly.champion_prize")).toBe(5000);
    expect([d("fees.counted_win_min_prize"), d("fees.counted_win_min_designers"), d("fees.counted_wins_max_per_client")]).toEqual([3000, 3, 2]);
    expect(d("upgrades.extension_days_options")).toEqual([3, 5, 7]);
    expect(Object.keys(SETTINGS).some((k) => k.includes("low_entry_extension"))).toBe(false);
    // Owner, 2026-10-08: 15% to start, 10% after 10 wins, 5% after 50 wins.
    expect(d("fees.designer_tiers")).toEqual([
      { min_wins: 0, rate_percent: 15 },
      { min_wins: 10, rate_percent: 10 },
      { min_wins: 50, rate_percent: 5 },
    ]);
  });

  it("timers and limits match §6, §7.3 and §9", () => {
    expect(d("timers.contest_duration_options_days")).toEqual([3, 5, 7, 10, 14, 21, 30]);
    expect(d("timers.contest_duration_default_days")).toBe(7);
    expect(d("timers.judging_window_days")).toBe(5);
    expect(d("timers.repick_window_days")).toBe(3);
    expect(d("timers.judging_reminder_days")).toEqual([1, 3, 5]);
    expect(d("timers.designer_file_upload_days")).toBe(3);
    expect(d("timers.client_response_days")).toBe(5);
    expect(d("limits.max_revision_requests")).toBe(2);
    expect(d("limits.withdrawal_min")).toBe(500);
    expect([d("limits.entry_min_images"), d("limits.entry_max_images")]).toEqual([1, 8]); // owner, 2026-10-08
    expect(d("limits.entry_image_min_px")).toBe(1000);
    expect(d("limits.max_entries_per_designer")).toBe(0); // unlimited
    expect(d("limits.approval_feedback_max_words")).toBe(120);
    expect(d("limits.false_flag_warnings_for_ban")).toBe(3);
  });

  it("every setting belongs to an A-11 group or auth", () => {
    const groups = new Set(Object.values(SETTINGS).map((s) => s.group));
    expect([...groups].sort()).toEqual(["auth", "fees", "limits", "monthly", "packages", "site", "timers", "upgrades"]);
  });
});
