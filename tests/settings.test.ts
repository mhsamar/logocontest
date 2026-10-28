import { readFileSync } from "node:fs";
import { join } from "node:path";
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
    expect([d("upgrades.logo_scan_price"), d("upgrades.highlight_price"), d("upgrades.urgent_price"), d("upgrades.nda_price")]).toEqual([250, 500, 500, 1500]);
    expect([d("packages.custom_min_prize"), d("packages.custom_step")]).toEqual([3000, 500]);
    // Owner, 2026-10-22: 25%, or 20% for prizes above ৳50,000 (was 15% above ৳30,000); every add-on free from ৳25,000.
    expect([d("fees.client_service_fee_percent"), d("fees.client_service_fee_large_percent"), d("fees.client_service_fee_large_from")]).toEqual([25, 20, 50000]);
    expect(d("upgrades.all_free_from")).toBe(25000);
    // Extension is a paid add-on, never free (owner, 2026-10-07)
    expect(d("upgrades.extension_price_per_day")).toBe(500);
    expect([d("upgrades.blind_price"), d("upgrades.private_price"), d("upgrades.promoted_price")]).toEqual([1000, 1000, 1000]);
    // Owner, 2026-10-09: the Monthly Winner gets a gift box, not money.
    expect(Object.keys(SETTINGS).includes("monthly.champion_prize")).toBe(false);
    expect(d("timers.designer_ending_notice_hours")).toEqual([12, 6]);
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
    expect(d("timers.judging_window_days")).toBe(3); // owner, 2026-10-12
    expect(d("timers.repick_window_days")).toBe(3);
    expect(d("timers.judging_reminder_days")).toEqual([1, 3, 5]);
    expect(d("timers.designer_file_upload_days")).toBe(3);
    expect(d("timers.client_response_days")).toBe(5);
    expect(d("limits.max_revision_requests")).toBe(0); // no limit, owner 2026-10-12
    expect(d("timers.strike_expiry_days")).toBe(30);
    expect(d("timers.suspension_hours")).toBe(48);
    expect(d("timers.files_strike_hours")).toBe(24);
    expect(d("timers.payout_hold_days")).toBe(3);
    expect(d("limits.strikes_for_ban")).toBe(3);
    expect(d("limits.withdrawal_min")).toBe(500);
    expect([d("limits.entry_min_images"), d("limits.entry_max_images")]).toEqual([1, 8]); // owner, 2026-10-08
    expect(d("limits.entry_image_min_px")).toBe(1000);
    expect(d("limits.max_entries_per_designer")).toBe(0); // unlimited
    expect(d("limits.approval_feedback_max_words")).toBe(120);
    expect(d("limits.false_flag_warnings_for_ban")).toBe(3);
  });

  it("every setting belongs to an A-11 group, auth, or Brand & notice (A-17)", () => {
    const groups = new Set(Object.values(SETTINGS).map((s) => s.group));
    // "monthly" has no settings since the Monthly Winner prize became a gift box (owner, 2026-10-09).
    // "brand", "contact" and "notice" are edited in /admin/brand, "legal" in /admin/legal (owner, 2026-10-09),
    // "home" in /admin/hero, "rewards" in /admin/monthly; "live" (the live designers tag) is on A-11; "how" (How it works
    // videos) in /admin/homepage (owner, 2026-10-11).
    // "checker" (logo checker API prices, owner 2026-10-14) is on A-11 too, and so are "ads" and "trash" (2026-10-14) and "email" (2026-10-15).
    // "pinterest" (auto-posting, owner 2026-10-19) is on /admin/pinterest.
    // "cards" (contest cards, owner 2026-10-19) is on /admin/contest-cards.
    // "system" (the .bd watch's state, owner 2026-10-21) has no form: only the 5-minute job writes it.
    // "costs" (the prices Admin › Costs uses, owner 2026-10-27) is on A-11.
    expect([...groups].sort()).toEqual(["ads", "auth", "brand", "cards", "checker", "contact", "costs", "email", "fees", "guarantee", "home", "how", "legal", "limits", "live", "notice", "notifications", "packages", "payments", "payouts", "pinterest", "rewards", "security", "site", "support", "system", "timers", "trash", "upgrades"]);
  });
});

describe("logins and devices (owner, 2026-10-22)", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/0071_no_idle_signout.sql"), "utf8").replace(/^\s*--.*$/gm, "");

  it("nobody is signed out for not using the site or closing it; the Super admin may use 2 devices", () => {
    expect(SETTINGS["security.admin_idle_minutes"].default).toBe(0);
    expect(SETTINGS["security.admin_close_tab_signout"].default).toBe(false);
    expect(SETTINGS["security.super_admin_max_devices"].default).toBe(2);
    expect(SETTINGS["security.admin_max_devices"].default).toBe(2);
    expect(SETTINGS["security.max_devices"].default).toBe(3);
    expect("security.super_admin_one_device" in SETTINGS).toBe(false);
  });

  it("the idle sign-out can be switched back on: 0 (never) or 10 to 480 minutes", () => {
    const ok = (n: number) => SETTINGS["security.admin_idle_minutes"].schema.safeParse(n).success;
    expect([0, 10, 30, 480].map(ok)).toEqual([true, true, true, true]);
    expect([5, 481, -1, 1.5].map(ok)).toEqual([false, false, false, false]);
  });

  it("the database falls back to the same values as the site, and checks idle only above 0", () => {
    expect(sql).toContain("setting_int('security.admin_idle_minutes', 0)");
    expect(sql).toContain("setting_bool('security.admin_close_tab_signout', false)");
    expect(sql).toContain("setting_int('security.super_admin_max_devices', 2)");
    expect(sql).toContain("setting_int('security.admin_max_devices', 2)");
    expect(sql).toContain("setting_int('security.max_devices', 3)");
    expect(sql).not.toMatch(/admin_idle_minutes', 30/);
    expect(sql.match(/idle > 0/g)?.length).toBe(3);
  });
});
