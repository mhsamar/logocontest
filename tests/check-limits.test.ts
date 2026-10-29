import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { limitFor } from "@/lib/logo-check/rules";
import { DEFAULT_PRO_SETTINGS } from "@/lib/pro/rules";
import { SETTINGS } from "@/lib/settings/registry";

// Fixed logo check limits (owner, 2026-10-29): clients 10 per contest whatever the prize, Basic 2 and Pro 20 a month,
// the 3-day free Pro Trial 5. All of them stay changeable in Admin (Settings › Limits, Admin › Pro plan).
const read = (p: string) => readFileSync(p, "utf8");

describe("logo check limits (owner, 2026-10-29)", () => {
  it("a contest gets 10 checks whatever the prize; the per-৳1,000 setting is gone from Admin", () => {
    expect(SETTINGS["limits.logo_checks_per_contest"].default).toBe(10);
    expect("limits.logo_checks_per_1000" in SETTINGS).toBe(false);
    expect(limitFor(false, { freeChecks: SETTINGS["limits.logo_checks_per_contest"].default, paidChecks: 10 })).toBe(10);
  });

  it("the database counts against the same number, with the same fallback, and sets the designers' numbers", () => {
    const sql = read("supabase/migrations/0080_check_limits.sql");
    expect(sql).toContain("('limits.logo_checks_per_contest', '10'::jsonb");
    expect(sql).toContain("where key = 'limits.logo_checks_per_contest'), 10);");
    expect(sql).toContain("v_limit := greatest(v_per, case when v_contest.logo_scan then v_paid else 0 end);");
    expect(sql).toContain("update public.pro_settings set pro_logo_checks = 20, trial_logo_checks = 5;");
    // The rollback brings back the old function and numbers.
    const down = read("supabase/rollback/0080_check_limits_down.sql");
    expect(down).toContain("v_limit := greatest((v_contest.prize_amount / 1000) * v_per");
    expect(down).toContain("update public.pro_settings set pro_logo_checks = 100, trial_logo_checks = 10;");
  });

  it("designers: Basic 2 and Pro 20 a month, the 3-day trial 5", () => {
    expect(DEFAULT_PRO_SETTINGS.basicLogoChecks).toBe(2);
    expect(DEFAULT_PRO_SETTINGS.proLogoChecks).toBe(20);
    expect(DEFAULT_PRO_SETTINGS.trialLogoChecks).toBe(5);
    expect(DEFAULT_PRO_SETTINGS.freeTrialDays).toBe(3);
  });

  it("the support assistant knows the numbers, and the checker's Q&A reaches it filled in", () => {
    const k = read("src/lib/support/knowledge.ts");
    expect(k).toContain('limits.logo_checks_per_contest"]} AI logo checks on each logo contest, whatever the prize');
    expect(k).toContain("fill(String(v))");
  });

  it("no page says 'per ৳1,000' about checks any more", () => {
    for (const f of ["src/lib/i18n/messages/en.ts", "src/lib/i18n/messages/bn.ts", "src/lib/i18n/messages/check-en.ts", "src/lib/i18n/messages/check-bn.ts", "src/lib/i18n/messages/home-pricing-en.ts", "src/lib/i18n/messages/home-pricing-bn.ts"]) {
      const s = read(f);
      expect(s, f).not.toMatch(/checks? (for each|per) ৳1,000|প্রতি ৳১,০০০-এ \{n\}টি/);
    }
  });
});
