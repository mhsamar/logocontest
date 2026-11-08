import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** A copied winner's prize can be taken back and shared among the other designers (owner, 2026-11-08). */
const read = (p: string) => readFileSync(p, "utf8");

describe("copied winner: take back and share", () => {
  it("takes a paid prize back only as far as the wallet holds it, once, and still removes the copier's designs", () => {
    const sql = read("supabase/migrations/0088_copied_winner_take_back.sql");
    expect(sql).toContain("if v_h.credited_at is not null then");
    expect(sql).toContain("v_take := least(v_paid, greatest(v_bal, 0));");
    expect(sql).toContain("update public.handovers set status = 'cancelled'");
    expect(sql).toContain("update public.entries set status = 'removed'");
    expect(sql).not.toContain("was already paid");
    expect(sql).toContain("revoke all on function public.admin_remove_copied_winner(uuid, int, boolean) from public, anon, authenticated;");
  });

  it("the team can choose to share the prize, with its own notices, and it's in the audit", () => {
    const a = read("src/lib/admin/contest-actions.ts");
    expect(a).toContain('f.next !== "client" && f.next !== "share"');
    expect(a).toContain('designer: "copy_prize_shared", client: "copy_prize_shared_client"');
    expect(a).toContain('"prize_taken_back", { brand: c.brand_name, amount: out.taken }');
    const page = read("src/app/admin/contests/[slug]/page.tsx");
    expect(page).toContain('value: "share"');
  });

  it("the daily run still counts a no-result with nobody to share among", () => {
    expect(read("src/lib/lifecycle/run.ts")).toContain("!== false) report.noResult++");
  });
});
