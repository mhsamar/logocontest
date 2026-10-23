import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isNewSince } from "@/components/admin/ui";
import { ADMIN_NAV, ADMIN_NEW, freshItem, showsNew } from "@/lib/admin/nav";

// Owner, 2026-10-23: every admin menu item shows what is waiting (red) and what is new since this admin last opened
// it (gold); opening a section clears its gold count, and new rows on the page get a "New" tag.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("menu sections with a gold 'new' count", () => {
  it("each key sits on exactly one menu item and fits the admin_seen check", () => {
    const keys = ADMIN_NAV.flatMap((g) => g.items).flatMap((i) => (i.fresh ? [i.fresh] : []));
    expect([...keys].sort()).toEqual([...ADMIN_NEW].sort());
    for (const k of ADMIN_NEW) {
      expect(freshItem(k)?.fresh).toBe(k);
      expect(k).toMatch(/^[a-z_]{1,32}$/);
    }
    expect(read("supabase/migrations/0073_admin_seen.sql")).toContain("check (section ~ '^[a-z_]{1,32}$')");
  });

  it("only a section's own page, on a tab that shows new rows, counts as looking at it", () => {
    // A contest or a person opened from elsewhere doesn't clear the Contests or Users count.
    expect(read("src/app/admin/contests/[slug]/page.tsx")).not.toContain("sectionVisit(");
    expect(read("src/app/admin/users/[id]/page.tsx")).not.toContain("sectionVisit(");
    // Tabs that never show new rows aren't a look (a held-design push opens Designs on the held tab).
    expect(showsNew("designs", "held")).toBe(false);
    expect(showsNew("designs", "recent")).toBe(true);
    expect(showsNew("designs", null)).toBe(true);
    expect(showsNew("payments", "failed")).toBe(false);
    expect(showsNew("payments", "paid")).toBe(true);
  });

  it("tags a row only when it came in after the last visit", () => {
    const since = new Date("2026-10-23T10:00:00Z");
    expect(isNewSince(new Date("2026-10-23T10:00:01Z"), since)).toBe(true);
    expect(isNewSince("2026-10-23T09:59:59Z", since)).toBe(false);
    expect(isNewSince(null, since)).toBe(false);
    expect(isNewSince(new Date(), null)).toBe(false);
  });
});

describe("wiring", () => {
  it("keeps the last-visit table server-only", () => {
    const sql = read("supabase/migrations/0073_admin_seen.sql");
    expect(sql).toContain("enable row level security");
    expect(sql).not.toMatch(/create policy/i);
  });

  it("records a look in one database step, and a look soon after belongs to the same visit", () => {
    const sql = read("supabase/migrations/0073_admin_seen.sql");
    expect(sql).toContain("create or replace function public.admin_seen_visit(p_admin uuid, p_section text, p_gap_minutes int, p_first timestamptz)");
    expect(sql).toContain("for update");
    expect(sql).toContain("r.seen_at > now() - make_interval(mins => greatest(p_gap_minutes, 1)) then r.visit_since else r.seen_at end");
    expect(sql).toContain("revoke all on function public.admin_seen_visit(uuid, text, int, timestamptz) from public, anon, authenticated;");
    const badges = read("src/lib/admin/badges.ts");
    expect(badges).toContain('getSetting("timers.admin_visit_minutes")');
    expect(badges).toContain("!canSeeItem(user, item)) return { since: null, at: null }");
  });

  it("every section's own page records the look and tags what is new", () => {
    for (const p of ["contests", "unpaid", "entries", "users", "payments", "trash", "activity", "audit", "pro"]) {
      const page = read(`src/app/admin/${p}/page.tsx`);
      expect(page, p).toContain("sectionVisit(");
      expect(page, p).toContain("visit.since");
      expect(page, p).toContain("{visit.at && <SeenNow section=");
    }
    expect(read("src/components/admin/users-board.tsx")).toContain("NewPill");
  });

  it("the layout only runs the red counts; the menu loads both on opening, every minute and on page changes", () => {
    expect(read("src/app/admin/layout.tsx")).toContain("const todo = await menuTodoCounts(user);");
    const nav = read("src/components/admin/admin-nav.tsx");
    expect(nav).toContain('fetch("/api/admin/counts", { cache: "no-store" })');
    // Every render of a section's page that records a look clears its gold count at once (SeenNow).
    expect(nav).toContain("cleared.current[section] = Date.now();");
    expect(nav).toContain("}, [seen, section, at]);");
    // Back/Forward restores a page with its old render time: that isn't a new look.
    expect(nav).toContain("if (handled.current.has(key)) return;");
    // On the section's page, arrivals after the look still show (no forced 0).
    expect(nav).toContain("const shown = live;");
    expect(read("src/components/admin/whats-new.tsx")).toContain("const c = useAdminCounts() ?? counts;");
    expect(nav).toContain('<Count n={fresh} kind="fresh" />');
  });

  it("before migration 0073 there are no gold counts and no tags, and nothing breaks", () => {
    const badges = read("src/lib/admin/badges.ts");
    expect(badges).toContain("if (error) return null;");
    expect(badges).toContain("if (!seen) return { ...FRESH_ZERO };");
    expect(badges).toContain("return error || !data ? { since: null, at: null } : { since: new Date(data as string), at: new Date().toISOString() };");
  });

  it("each gold count matches the rows its page tags", () => {
    const badges = read("src/lib/admin/badges.ts");
    // The pages list test accounts too, so the gold counts include them (monthly rewards keep their own test mode).
    expect(badges.slice(badges.indexOf("async function freshCount"))).not.toContain("is_test");
    expect(badges).toContain('.not("status", "in", "(draft,pending_payment,deleted)").gt("starts_at", since)');
    expect(badges).toContain('hasPermission(user, "users.view") ? db.from("profiles")');
    expect(read("src/app/admin/trash/page.tsx")).toContain("r.byId !== me.id && isNewSince(r.deletedAt, visit.since)");
    expect(badges).toContain('.not("status", "in", "(removed,held,winner)")');
    expect(badges).toContain('db.from("pro_activity_log").select("id", head).in("action", ["paid", "renewed"])');
    expect(read("src/app/admin/entries/page.tsx")).toContain('showsNew("designs", tab) ? sectionVisit(me, "designs")');
    expect(read("src/app/admin/payments/page.tsx")).toContain(".sort((a, b) => fresh(b) - fresh(a))");
  });
});
