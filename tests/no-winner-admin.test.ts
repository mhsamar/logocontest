import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SETTINGS } from "@/lib/settings/registry";

/** No winner by the end of judging: the team decides (owner, 2026-11-06). */
const read = (p: string) => readFileSync(p, "utf8");

describe("no winner: the team decides", () => {
  it("is on by default and can be switched back to sharing at once", () => {
    expect(SETTINGS["lifecycle.no_winner_admin_decides"].default).toBe(true);
  });

  it("the daily run tells the team once and waits, only for judging that ran out with designers to share among", () => {
    const run = read("src/lib/lifecycle/run.ts");
    expect(run).toContain('if (judgingIds.has(c.id) && s["lifecycle.no_winner_admin_decides"])');
    expect(run).toContain('await once(c.id, "no_winner_admin")');
    expect(run).toContain('"no_winner_admin", { brand: c.brand_name, number: shares.length }, `/admin/contests/${c.slug}`');
    expect(run).toContain("if (shares.length > 0) {");
  });

  it("a winner after a shared result takes shares back only as far as the wallet allows, and never twice", () => {
    const sql = read("supabase/migrations/0085_award_after_no_result.sql");
    expect(sql).toContain("v_take := least(r.amount, greatest(v_bal, 0));");
    expect(sql).toContain("if not found or v_c.status <> 'no_result' then");
    expect(sql).toContain("if exists (select 1 from public.handovers where contest_id = p_contest_id) then");
    expect(sql).toContain("perform public.pick_winner(p_contest_id, p_entry_id, p_fee_rate, p_due_at);");
    expect(sql).toContain("revoke all on function public.admin_award_no_result");
  });

  it("the team's actions need contests.manage and a reason, and the take-back choice is explicit", () => {
    const a = read("src/lib/admin/contest-actions.ts");
    expect(a).toContain('(f.takeBack !== "1" && f.takeBack !== "0")');
    expect(a.match(/const admin = await adminUser\("contests.manage"\);/g)?.length).toBeGreaterThanOrEqual(3);
    expect(a).toContain('"share_taken_back", { brand: c.brand_name, amount: d.taken }');
  });
});
