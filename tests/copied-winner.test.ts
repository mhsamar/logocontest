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

  it("every designer hears why, with the proof's link; then the client picks again or the team picks now", () => {
    const a = read("src/lib/admin/contest-actions.ts");
    expect(a).toContain('"winner_copy_removed", n, proof || `/contest/${c.slug}`');
    expect(a).toContain('"win_removed_copy", n, proof || `/contest/${c.slug}`');
    expect(a).toContain('"repick_copied", { ...n, days }, contestHref(c.slug, "designs")');
    expect(a).toContain('await pickFor(admin.id, c, f.entry, reason, "force_award_after_copy")');
    expect(a).toContain('if (proof && !/^https?:\\/\\/\\S{4,}$/i.test(proof)) return fail("admin.contests.copied.badLink");');
  });
});
