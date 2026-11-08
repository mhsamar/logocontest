import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Change a winner whose logo was copied (owner, 2026-11-07). */
const read = (p: string) => readFileSync(p, "utf8");

describe("copied winner", () => {
  it("takes the win away like an upheld copy claim, only while the prize is unpaid", () => {
    const sql = read("supabase/migrations/0086_remove_copied_winner.sql");
    expect(sql).toContain("if v_h.credited_at is not null then");
    expect(sql).toContain("update public.handovers set status = 'cancelled', counts_as_win = false where id = v_h.id;");
    expect(sql).toContain("where contest_id = p_contest_id and designer_id = v_h.designer_id and status in ('active', 'winner');");
    expect(sql).toContain("judging_ends_at = now() + make_interval(days => p_repick_days)");
    expect(sql).toContain("revoke all on function public.admin_remove_copied_winner");
  });

  it("since 2026-11-08 the team no longer changes the winner: it shares the prize (see copied-winner-share)", () => {
    const a = read("src/lib/admin/contest-actions.ts");
    expect(a).not.toContain("removeCopiedWinner");
    expect(a).toContain('if (proof && !/^https?:\\/\\/\\S{4,}$/i.test(proof)) return fail("admin.contests.copied.badLink");');
  });
});
