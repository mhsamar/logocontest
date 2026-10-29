import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Owner, 2026-10-29: "Meet the designers who won" on the new home page (Design/logocontest-site/index.html #winners).

type Design = { entryId: string; designerId: string; brandName: string; coverUrl: string | null; designer: { id: string; name: string; username: string | null; avatarUrl: string | null } | null };
const state = vi.hoisted(() => ({
  configured: true,
  tables: {} as Record<string, { data: unknown; error: { message: string } | null }>,
  featured: [] as unknown[],
  newest: [] as unknown[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: () => state.configured }));
vi.mock("@/lib/home/logos", () => ({ HOME_LOGOS_TAG: "home-logos" }));
vi.mock("@/lib/rewards/queries", () => ({
  winningDesigns: async (q: { entryIds?: string[] }) => (q.entryIds ? state.featured : state.newest),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (name: string) => {
      const q = { select: () => q, order: () => q, limit: () => q, in: () => q, then: (ok: (v: unknown) => unknown) => Promise.resolve(state.tables[name] ?? { data: [], error: null }).then(ok) };
      return q;
    },
  }),
}));

const { pickWinners, homeWinners, MIN_HOME_WINNERS } = await import("@/lib/home/winners");
type Facts = Parameters<typeof pickWinners>[3] extends Map<string, infer F> ? F : never;

const d = (entryId: string, designerId = `p-${entryId}`, extra: Partial<Design> = {}): Design => ({
  entryId,
  designerId,
  brandName: `Brand ${entryId}`,
  coverUrl: `https://lc.test/api/img/${entryId}`,
  designer: { id: designerId, name: `Designer ${designerId}`, username: designerId, avatarUrl: null },
  ...extra,
});
const ok: Facts = { prize: 5000, service: "logo", designerIsTest: false, designerStatus: "active" };
const factsFor = (ids: string[], over: Record<string, Partial<Facts>> = {}) => new Map(ids.map((id) => [id, { ...ok, ...over[id] }]));
const ids = (out: { entryId: string }[]) => out.map((w) => w.entryId);

describe("home winners: order and repeats", () => {
  it("puts the admin's featured logos first, in their order, then the newest, without repeats", () => {
    const out = pickWinners(["b", "a"], [d("a"), d("b")], [d("c"), d("a"), d("e")], factsFor(["a", "b", "c", "e"]), 10);
    expect(ids(out)).toEqual(["b", "a", "c", "e"]);
  });

  it("shows each designer once among the newest, then fills the room left with their other wins, newest first", () => {
    const newest = [d("n1", "x"), d("n2", "x"), d("n3", "y"), d("n4", "x"), d("n5", "z")];
    const facts = factsFor(newest.map((n) => n.entryId));
    expect(ids(pickWinners([], [], newest, facts, 10))).toEqual(["n1", "n3", "n5", "n2", "n4"]);
    expect(ids(pickWinners([], [], newest, facts, 3))).toEqual(["n1", "n3", "n5"]);
  });

  it("keeps every featured pick even from one designer, and that designer's newest wins wait their turn", () => {
    const out = pickWinners(["f1", "f2"], [d("f1", "x"), d("f2", "x")], [d("n1", "x"), d("n2", "y")], factsFor(["f1", "f2", "n1", "n2"]), 10);
    expect(ids(out)).toEqual(["f1", "f2", "n2", "n1"]);
  });

  it("skips featured ids the gallery rules dropped (private, NDA, test client) and stops at the limit", () => {
    const out = pickWinners(["gone", "a"], [d("a")], [d("b"), d("c")], factsFor(["a", "b", "c"]), 2);
    expect(ids(out)).toEqual(["a", "b"]);
    expect(pickWinners([], [], [], new Map(), 12)).toEqual([]);
    expect(pickWinners([], [], [d("a")], factsFor(["a"]), 0)).toEqual([]);
  });
});

describe("home winners: what may be shown", () => {
  it("never a design without a picture, from another design type, by a test, suspended, banned or deleted designer, or without a prize", () => {
    const newest = [d("nopic", "p1", { coverUrl: null }), d("card", "p2"), d("test", "p3"), d("banned", "p4"), d("deleted", "p5"), d("free", "p6"), d("unknown", "p7"), d("susp", "p9"), d("good", "p8")];
    const facts = factsFor(["nopic", "card", "test", "banned", "deleted", "free", "susp", "good"], {
      card: { service: "business_card" },
      test: { designerIsTest: true },
      banned: { designerStatus: "banned" },
      deleted: { designerStatus: "deleted" },
      susp: { designerStatus: "suspended" },
      free: { prize: 0 },
    });
    expect(ids(pickWinners([], [], newest, facts, 12))).toEqual(["good"]);
  });

  it("a hidden design doesn't use up its designer's one card", () => {
    const out = pickWinners([], [], [d("card", "x"), d("logo", "x")], factsFor(["card", "logo"], { card: { service: "business_card" } }), 12);
    expect(ids(out)).toEqual(["logo"]);
  });

  it("sends only what the card shows: a blind winner has no designer, initials come from the name", () => {
    const blind = d("bl", "secret", { designer: null });
    const named = d("nm", "p", { designer: { id: "p", name: "  rakib hasan khan ", username: null, avatarUrl: "https://lc.test/api/avatar/p.jpg" } });
    const bangla = d("bn", "q", { designer: { id: "q", name: "সাদিয়া ইসলাম", username: "sadia", avatarUrl: null } });
    const out = pickWinners([], [], [blind, named, bangla], factsFor(["bl", "nm", "bn"], { nm: { prize: 10000 } }), 12);
    expect(out[0]).toEqual({ entryId: "bl", logoUrl: "https://lc.test/api/img/bl", brandName: "Brand bl", prize: 5000, designer: null });
    expect(out[1].designer).toEqual({ name: "  rakib hasan khan ", initials: "RH", username: null, avatarUrl: "https://lc.test/api/avatar/p.jpg" });
    expect(out[1].prize).toBe(10000);
    expect(out[2].designer?.initials).toBe("সই");
    expect(JSON.stringify(out)).not.toContain("secret");
  });
});

describe("homeWinners()", () => {
  beforeEach(() => {
    state.configured = true;
    state.featured = [d("f")];
    state.newest = [d("a"), d("f"), d("b")];
    state.tables = {
      featured_logos: { data: [{ entry_id: "f" }], error: null },
      entries: {
        data: [
          { id: "f", contest: { prize_amount: 8000, service: "logo" }, designer: { is_test: false, status: "active" } },
          { id: "a", contest: [{ prize_amount: 3000, service: "logo" }], designer: [{ is_test: false, status: "active" }] },
          { id: "b", contest: { prize_amount: 3000, service: "logo" }, designer: { is_test: true, status: "active" } },
        ],
        error: null,
      },
    };
  });

  it("reads the featured logos, the newest winners and their prizes", async () => {
    const out = await homeWinners(12);
    expect(out.map((w) => [w.entryId, w.prize])).toEqual([
      ["f", 8000],
      ["a", 3000],
    ]);
  });

  it("is empty without a database or when it can't answer, so the section hides instead of breaking the page", async () => {
    state.tables.entries = { data: null, error: { message: "down" } };
    expect(await homeWinners(12)).toEqual([]);
    state.configured = false;
    expect(await homeWinners(12)).toEqual([]);
  });

  it("hides the section below four winners", () => {
    expect(MIN_HOME_WINNERS).toBe(4);
  });
});

describe("winners.css stays inside the home page", () => {
  const css = readFileSync(join(process.cwd(), "src/components/home/landing/winners.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  it("scopes every rule under .lc-landing and prefixes its keyframes", () => {
    const keyframes = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);
    expect(keyframes.length).toBeGreaterThan(0);
    for (const k of keyframes) expect(k.startsWith("lc-wn-")).toBe(true);
    const outside = css.replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
    // Split selector lists on top-level commas only (not the ones inside :is()).
    const split = (list: string) => list.split(/,(?![^(]*\))/).map((s) => s.trim());
    const selectors = [...outside.matchAll(/([^{};]+)\{[^{}]*\}/g)].flatMap((m) => split(m[1])).filter((s) => s && !s.startsWith("@"));
    expect(selectors.length).toBeGreaterThan(20);
    for (const s of selectors) expect(s.startsWith(".lc-landing ")).toBe(true);
  });

  it("stops moving for reduced motion", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.lc-wn-track[\s\S]*animation: none/);
  });
});
