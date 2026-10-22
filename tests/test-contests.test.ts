import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// A test client's contest works end to end for test accounts (by direct link) but never reaches real designers or
// the public (owner, 2026-10-22). These read the source, the repo's usual check for database filters.
const src = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("test contests stay with test accounts", () => {
  it("announcements, reminders and invitations go to test designers only", () => {
    expect(src("src/lib/contests/announce.ts")).toContain("onlyTest: test");
    expect(src("src/lib/notifications/broadcast.ts")).toContain('if (opts.onlyTest) q = q.eq("is_test", true)');
    expect(src("src/lib/email/events.ts")).toContain('if (opts.onlyTest) q = q.eq("is_test", true)');
    expect(src("src/lib/email/events.ts").match(/isTestAccount\(c\.clientId\)/g)?.length).toBe(2);
    expect(src("src/lib/lifecycle/run.ts")).toContain("onlyTest: tests.has(");
    expect(src("src/lib/pro/jobs.ts")).toContain("tests.has(c.id as string) ? testPro : pro");
    expect(src("src/lib/pro/invites.ts")).toContain('.eq("is_test", clientTest)');
    expect(src("src/lib/pro/invite-actions.ts")).toContain("test.has(id) !== clientTest");
  });

  it("public lists, counts, cards and pins leave them out", () => {
    for (const f of ["src/lib/contests/browse.ts", "src/lib/pro/workspace.ts", "src/lib/seo/listings.ts"]) expect(src(f), f).toContain('.eq("owner.is_test", false)');
    for (const f of ["src/lib/studio/queries.ts", "src/lib/rewards/queries.ts", "src/lib/pinterest/job.ts", "src/lib/seo/listings.ts"]) expect(src(f), f).toContain('.eq("contest.owner.is_test", false)');
    expect(src("src/lib/cards/job.ts")).toContain("testContestIds(");
    expect(src("src/app/contest/[slug]/pin/route.tsx")).toContain("clientIsTest");
  });

  it("the contest page itself still opens by direct link (no owner filter in getContestBySlug)", () => {
    const browse = src("src/lib/contests/browse.ts");
    const bySlug = browse.slice(browse.indexOf("export async function getContestBySlug"));
    expect(bySlug.slice(0, bySlug.indexOf("\n}\n"))).not.toContain("owner.is_test");
  });
});
