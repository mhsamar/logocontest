import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Owner, 2026-10-25: a designer's designs show their pictures on their admin profile, and a design they withdrew (or
// the team removed) is its own line in their Activity.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

type Row = Record<string, unknown>;
const state = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, asked: [] as string[] }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/entries/queries", () => ({ ENTRY_FILES_BUCKET: "entry-files" }));
vi.mock("@/lib/storage", () => ({
  getFileStorage: () => ({ createReadUrls: async (_bucket: string, paths: string[]) => (state.asked.push(...paths), new Map(paths.map((p) => [p, `https://signed.example/${p}`]))) }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (name: string) => {
      const filters: ((r: Row) => boolean)[] = [];
      let order: { key: string; asc: boolean } | null = null;
      const q = {
        select: () => q,
        eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
        in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), q),
        order: (key: string, o?: { ascending?: boolean }) => ((order = { key, asc: o?.ascending !== false }), q),
        then: (ok: (v: unknown) => unknown) => {
          let rows = (state.tables[name] ?? []).filter((r) => filters.every((f) => f(r)));
          if (order) rows = [...rows].sort((a, b) => (order!.asc ? 1 : -1) * String(a[order!.key]).localeCompare(String(b[order!.key])));
          return Promise.resolve({ data: rows }).then(ok);
        },
      };
      return q;
    },
  }),
}));

const row = (id: string, status: string, more: Row = {}) => ({ id, number: 1, status, created_at: "2026-10-20T09:00:00Z", withdrawn_at: null, contest_id: "c1", contest: { slug: "c", brand_name: "Brand" }, images: [] as { position: number; preview_path: string }[], ...more });

beforeEach(() => {
  state.tables = {};
  state.asked = [];
});

describe("a designer's designs on their admin profile", () => {
  it("each design gets its first picture, and when it left its contest", async () => {
    const { designerEntries } = await import("@/lib/admin/users");
    state.tables.audit_logs = [
      { action: "remove_entry", subject_type: "entry", subject_id: "r1", created_at: "2026-10-21T10:30:00Z" },
      // A later, second Remove click doesn't move the time.
      { action: "remove_entry", subject_type: "entry", subject_id: "r1", created_at: "2026-10-22T08:00:00Z" },
    ];
    const out = await designerEntries(
      "d1",
      [
        row("w1", "withdrawn", { withdrawn_at: "2026-10-25T09:14:58Z", images: [{ position: 2, preview_path: "b.webp" }, { position: 1, preview_path: "a.webp" }] }),
        row("r1", "removed", { images: [{ position: 1, preview_path: "c.webp" }] }),
        row("a1", "active"),
      ],
      { pictures: true },
    );
    expect(out[0]).toMatchObject({ id: "w1", coverUrl: "https://signed.example/a.webp", withdrawnAt: new Date("2026-10-25T09:14:58Z"), removedAt: null });
    expect(out[1]).toMatchObject({ id: "r1", coverUrl: "https://signed.example/c.webp", withdrawnAt: null, removedAt: new Date("2026-10-21T10:30:00Z") });
    // A design without a picture asks for no link.
    expect(out[2]).toMatchObject({ id: "a1", coverUrl: null, withdrawnAt: null, removedAt: null });
    expect(state.asked).toEqual(["a.webp", "c.webp"]);
  });

  it("withdrawn and later removed by the team: both times stay", async () => {
    const { designerEntries } = await import("@/lib/admin/users");
    state.tables.audit_logs = [{ action: "remove_entry", subject_type: "entry", subject_id: "x", created_at: "2026-10-26T08:00:00Z" }];
    const [e] = await designerEntries("d1", [row("x", "removed", { withdrawn_at: "2026-10-25T09:14:58Z" })]);
    expect(e).toMatchObject({ withdrawnAt: new Date("2026-10-25T09:14:58Z"), removedAt: new Date("2026-10-26T08:00:00Z") });
  });

  it("removed by an upheld report or copy claim: dated from those", async () => {
    const { designerEntries } = await import("@/lib/admin/users");
    state.tables.reports = [{ entry_id: "rep", status: "upheld", resolved_at: "2026-10-23T05:00:00Z" }];
    state.tables.copy_claims = [
      { designer_id: "d1", contest_id: "c9", status: "upheld", resolved_at: "2026-10-24T05:00:00Z" },
      { designer_id: "other", contest_id: "c8", status: "upheld", resolved_at: "2026-10-24T06:00:00Z" },
    ];
    const out = await designerEntries("d1", [row("rep", "removed"), row("cl", "removed", { contest_id: "c9" }), row("no", "removed", { contest_id: "c8" })]);
    expect(out.map((e) => e.removedAt?.toISOString() ?? null)).toEqual(["2026-10-23T05:00:00.000Z", "2026-10-24T05:00:00.000Z", null]);
  });

  it("no picture links for staff who may not see designs", async () => {
    const { designerEntries } = await import("@/lib/admin/users");
    const [e] = await designerEntries("d1", [row("p", "held", { images: [{ position: 1, preview_path: "held.webp" }] })]);
    expect(e.coverUrl).toBeNull();
    expect(state.asked).toEqual([]);
    const page = read("src/app/admin/users/[id]/page.tsx");
    expect(page).toContain("const pictures = canSeeDesigns(viewer);");
    expect(page).toContain("getUser(id, { pictures })");
    expect(page).toContain("<DesignerDesigns entries={u.entries} canOpen={pictures}");
    expect(read("src/lib/admin/design-view.ts")).toContain("if (!admin || !canSeeDesigns(admin) ||");
    expect(read("src/lib/admin/permissions.ts")).toContain('const DESIGN_AREAS: Permission[] = ["designs.view", "contests.view", "reports.view", "claims.view", "monthly.view", "content.view"];');
  });

  it("the Activity lists every leave event (all such designs, both kinds), and Admin › Designs says Withdrawn", () => {
    const users = read("src/lib/admin/users.ts");
    expect(users).toContain('.in("status", ["withdrawn", "removed"]).order("created_at", { ascending: false }).limit(100)');
    const page = read("src/app/admin/users/[id]/page.tsx");
    expect(page).toContain("...u.leftEntries.flatMap((e) =>");
    expect(page).toContain('[e.withdrawnAt, "admin.users.tl.withdrew"],');
    expect(page).toContain('[e.removedAt, "admin.users.tl.removedByTeam"],');
    expect(read("src/components/admin/user-work.tsx")).toContain("data-design-thumb");
    expect(read("src/app/admin/entries/page.tsx")).toContain(') : e.status === "withdrawn" ? (');
    // A second Remove on an already removed design records and tells nothing again.
    expect(read("src/lib/admin/moderation-actions.ts")).toContain("if (changed?.length) {");
    for (const f of ["src/lib/i18n/messages/en.ts", "src/lib/i18n/messages/bn.ts"]) {
      const m = read(f);
      for (const k of ["withdrew:", "removedByTeam:", "goneLine:", "withdrawnOn:", "designRemovedOn:"]) expect(m, `${f} ${k}`).toContain(k);
    }
  });
});
