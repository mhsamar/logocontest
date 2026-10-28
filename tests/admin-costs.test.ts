import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { costLines, designCheckUsd, linesTotal, pricesFrom, supportReplyUsd, type MonthCounts } from "@/lib/admin/cost-rules";
import { ADMIN_AREAS, PRESETS } from "@/lib/admin/permissions";
import { ADMIN_NAV } from "@/lib/admin/nav";
import { SETTINGS } from "@/lib/settings/registry";

// Owner, 2026-10-27: "AI usages er akta tab koro admin a ... mailing er khoroch, AI checker er khoroch, nude photo check
// er khoroch ... monthly count". Only what the site counts itself (owner's choice): no hosting or other bills, no SQL.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const prices = pricesFrom({
  "checker.usd_to_bdt": 122,
  "checker.cost_ai_in_cents_per_m": 30,
  "checker.cost_ai_out_cents_per_m": 250,
  "costs.safesearch_cents_per_1000": 150,
  "costs.safesearch_free_per_month": 1000,
  "costs.email_cents_per_1000": 40,
  "costs.email_free_per_month": 3000,
});
const month: MonthCounts = { checks: 68, checkerBdt: 172.004, designs: 69, designPictures: 200, pictures: 1211, aiReplies: 9, emails: 3500, emailsFailed: 50 };

describe("Admin › Costs", () => {
  it("prices come from Settings in cents", () => {
    expect(prices).toEqual({ usdToBdt: 122, aiIn: 0.3 / 1e6, aiOut: 2.5 / 1e6, safeSearch: 0.0015, safeSearchFree: 1000, email: 0.0004, emailFree: 3000 });
    for (const [k, v] of [["costs.safesearch_cents_per_1000", 150], ["costs.safesearch_free_per_month", 1000], ["costs.email_cents_per_1000", 0], ["costs.email_free_per_month", 3000]] as const) {
      expect(SETTINGS[k].default, k).toBe(v);
      expect(SETTINGS[k].group).toBe("costs");
    }
  });

  it("each line: the checker exact, Google and emails past their free allowance, the AI worked out from typical sizes", () => {
    const lines = costLines(month, prices, { designCheck: true, safeSearch: true });
    const by = Object.fromEntries(lines.map((l) => [l.key, l]));
    expect(by.checker).toEqual({ key: "checker", count: 68, bdt: 172, exact: true });
    // 211 pictures over the free 1,000, at $1.50 per 1,000.
    expect(by.safeSearch).toEqual({ key: "safeSearch", count: 1211, bdt: Math.round(211 * 0.0015 * 122 * 100) / 100, exact: false, free: { used: 1000, limit: 1000 } });
    // 69 logo designs: the instructions and answer each, plus 1,100 tokens for each of their 200 pictures (a contest
    // service's pictures get SafeSearch but not the AI check).
    const design = 69 * (1000 * prices.aiIn + 600 * prices.aiOut) + 200 * 1100 * prices.aiIn;
    expect(by.designCheck.bdt).toBe(Math.round(design * 122 * 100) / 100);
    expect(by.support.bdt).toBe(Math.round(9 * supportReplyUsd(prices) * 122 * 100) / 100);
    expect(by.email).toEqual({ key: "email", count: 3500, bdt: Math.round(500 * 0.0004 * 122 * 100) / 100, exact: true, free: { used: 3000, limit: 3000 } });
    expect(linesTotal(lines)).toBe(Math.round(lines.reduce((a, l) => a + l.bdt, 0) * 100) / 100);
    // About ৳0.30 a design with two pictures, ৳0.52 an answer.
    expect(Math.round(designCheckUsd(2, prices) * 122 * 100) / 100).toBe(0.3);
    expect(Math.round(supportReplyUsd(prices) * 122 * 100) / 100).toBe(0.52);
  });

  it("a check that is switched off is counted but costs nothing; within the free allowance costs nothing", () => {
    const lines = costLines({ ...month, pictures: 200, emails: 393 }, prices, { designCheck: false, safeSearch: false });
    const by = Object.fromEntries(lines.map((l) => [l.key, l]));
    expect(by.safeSearch).toMatchObject({ count: 200, bdt: 0, off: true });
    expect(by.designCheck).toMatchObject({ count: 69, bdt: 0, off: true });
    expect(by.email).toMatchObject({ count: 393, bdt: 0, free: { used: 393, limit: 3000 } });
    const on = costLines({ ...month, pictures: 200 }, prices, { designCheck: true, safeSearch: true });
    expect(on.find((l) => l.key === "safeSearch")).toMatchObject({ bdt: 0 });
    expect(on.find((l) => l.key === "safeSearch")?.off).toBeUndefined();
  });

  it("its own view-only permission, in the Money menu; not in the ready-made roles", () => {
    expect(ADMIN_AREAS.costs).toEqual({ manage: false });
    const money = ADMIN_NAV.find((g) => g.label === "admin.groups.money")!;
    expect(money.items.find((i) => i.href === "/admin/costs")).toEqual({ href: "/admin/costs", icon: "costs", label: "admin.nav.costs", perm: "costs.view" });
    for (const preset of Object.values(PRESETS)) expect(preset).not.toContain("costs.view");
    expect(read("src/app/admin/costs/page.tsx")).toContain('await requirePermission("costs.view");');
    expect(read("src/app/admin/settings/page.tsx")).toContain('"checker", "costs", "monthly"');
  });

  it("only counts are read (no rows), except the checker's kept costs; this month and the five before", () => {
    const src = read("src/lib/admin/costs.ts");
    expect(src.match(/\.select\("id", head\)/g)?.length).toBe(5);
    expect(src).toContain('.select("id, contest:contests!inner(service)", head).or("service.is.null,service.eq.logo", { referencedTable: "contest" })');
    expect(src).toContain('.select("id, entry:entries!entry_id!inner(contest:contests!inner(service))", head).eq("entry.contest.service", "logo")');
    // The checker's costs in pages of 1,000 (the API never sends more at once), and its count as a count.
    expect(src).toContain('.select("cost_usd, cost_bdt").gte("created_at", from).lt("created_at", to).order("id").range(at, at + 999);');
    expect(src).toContain("checks: n(checks),");
    expect(src).toContain("Array.from({ length: 6 }");
    expect(src).toContain('safeSearch: process.env.MODERATION_DRIVER === "google"');
  });

  it("every text in English and Bangla", async () => {
    const [{ default: en }, { default: bn }] = await Promise.all([import("@/lib/i18n/messages/en"), import("@/lib/i18n/messages/bn")]);
    const keys = (o: object, p = ""): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    const enCosts = keys((en as unknown as { admin: { costs: object } }).admin.costs);
    const bnCosts = keys((bn as unknown as { admin: { costs: object } }).admin.costs);
    expect(bnCosts.sort()).toEqual(enCosts.sort());
    expect(enCosts.length).toBeGreaterThan(40);
  });
});
