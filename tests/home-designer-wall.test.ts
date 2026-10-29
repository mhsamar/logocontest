import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

// The newest designers wall on the new home page (owner, 2026-10-29; Design/logocontest-site/index.html).
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn, updateTag: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

import { copiesFor, initials, joinedAgo, JUST_JOINED, ROW_MIN_CARDS, wallRows, type WallDesigner } from "@/lib/home/designer-wall";
import homeWallBn from "@/lib/i18n/messages/home-wall-bn";
import homeWallEn from "@/lib/i18n/messages/home-wall-en";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
// 29 October 2026, 12:00 in Dhaka (06:00 UTC).
const NOW = new Date("2026-10-29T06:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

describe("when a designer joined", () => {
  it("counts Bangladesh calendar days, not 24-hour blocks", () => {
    expect(joinedAgo(NOW, NOW)).toEqual({ key: "home2.wall.joined.today", n: 0 });
    // 00:30 today in Dhaka (18:30 UTC yesterday) is still today.
    expect(joinedAgo("2026-10-28T18:30:00Z", NOW).key).toBe("home2.wall.joined.today");
    // 23:30 yesterday in Dhaka, only 12½ hours ago, is yesterday.
    expect(joinedAgo("2026-10-28T17:30:00Z", NOW).key).toBe("home2.wall.joined.yesterday");
    // A clock a little ahead never says "in the future".
    expect(joinedAgo(new Date(NOW.getTime() + 60_000), NOW).key).toBe("home2.wall.joined.today");
  });

  it("days, then weeks, months and years, with one and many", () => {
    expect(joinedAgo(daysAgo(1), NOW)).toEqual({ key: "home2.wall.joined.yesterday", n: 1 });
    expect(joinedAgo(daysAgo(5), NOW)).toEqual({ key: "home2.wall.joined.days", n: 5 });
    expect(joinedAgo(daysAgo(6), NOW)).toEqual({ key: "home2.wall.joined.days", n: 6 });
    expect(joinedAgo(daysAgo(7), NOW)).toEqual({ key: "home2.wall.joined.week", n: 1 });
    expect(joinedAgo(daysAgo(13), NOW)).toEqual({ key: "home2.wall.joined.week", n: 1 });
    expect(joinedAgo(daysAgo(21), NOW)).toEqual({ key: "home2.wall.joined.weeks", n: 3 });
    expect(joinedAgo(daysAgo(29), NOW)).toEqual({ key: "home2.wall.joined.weeks", n: 4 });
    expect(joinedAgo(daysAgo(30), NOW)).toEqual({ key: "home2.wall.joined.month", n: 1 });
    expect(joinedAgo(daysAgo(75), NOW)).toEqual({ key: "home2.wall.joined.months", n: 2 });
    expect(joinedAgo(daysAgo(365), NOW)).toEqual({ key: "home2.wall.joined.year", n: 1 });
    expect(joinedAgo(daysAgo(800), NOW)).toEqual({ key: "home2.wall.joined.years", n: 2 });
  });

  it("every key it can give exists in English and Bangla, with the same {n}", () => {
    for (const [key, en] of Object.entries(homeWallEn.joined)) {
      const bn = homeWallBn.joined[key as keyof typeof homeWallBn.joined];
      expect(bn, key).toBeTruthy();
      expect(bn.includes("{n}"), key).toBe(en.includes("{n}"));
    }
  });
});

describe("initials", () => {
  it("first letters of the first two words", () => {
    expect(initials("Rakib Hasan")).toBe("RH");
    expect(initials("  nusrat   jahan  ara ")).toBe("NJ");
    expect(initials("Tanvir")).toBe("T");
  });

  it("skips short forms like Md. and Mst. when more of the name follows", () => {
    expect(initials("Md. Rakib Hasan")).toBe("RH");
    expect(initials("Mst. Sadia Islam")).toBe("SI");
    expect(initials("Md.")).toBe("M");
  });

  it("works for Bangla names and never comes back empty", () => {
    expect(initials("রাকিব হাসান")).toBe("রহ");
    expect(initials("")).toBe("•");
    expect(initials(null)).toBe("•");
  });
});

describe("two rows", () => {
  const people = (n: number): WallDesigner[] =>
    Array.from({ length: n }, (_, i) => ({ name: `Designer ${String.fromCharCode(65 + i)}`, username: `d${i}`, photo: i % 3 ? null : `/api/avatar/${i}.webp`, joinedAt: daysAgo(i) }));

  it("deals the newest first, alternately into the two rows", () => {
    const [top, bottom] = wallRows(people(7), NOW);
    expect(top.map((d) => d.username)).toEqual(["d0", "d2", "d4", "d6"]);
    expect(bottom.map((d) => d.username)).toEqual(["d1", "d3", "d5"]);
  });

  it("Just joined on the newest three only, and only when that is true", () => {
    const [top, bottom] = wallRows(people(10), NOW);
    const fresh = [...top, ...bottom].filter((d) => d.fresh).map((d) => d.username);
    expect(fresh.sort()).toEqual(["d0", "d1", "d2"]);
    expect(JUST_JOINED).toBe(3);
    const old = people(10).map((d, i) => ({ ...d, joinedAt: daysAgo(60 + i) }));
    expect(wallRows(old, NOW).flat().some((d) => d.fresh)).toBe(false);
  });

  it("each card carries its initials, its tint and when it joined", () => {
    const [top, bottom] = wallRows(people(4), NOW);
    expect(top[0]).toMatchObject({ initials: "DA", photo: "/api/avatar/0.webp", ago: { key: "home2.wall.joined.today" } });
    expect(bottom[0]).toMatchObject({ initials: "DB", photo: null, ago: { key: "home2.wall.joined.yesterday" } });
    // Tints cycle along each row; the second row starts three along, as in the design.
    expect(top.map((d) => d.tone)).toEqual([0, 1]);
    expect(bottom.map((d) => d.tone)).toEqual([3, 4]);
    expect(wallRows(people(16), NOW)[0].map((d) => d.tone)).toEqual([0, 1, 2, 3, 4, 5, 0, 1]);
  });

  it("a short row is drawn often enough to fill a wide screen", () => {
    expect(copiesFor(0)).toBe(0);
    expect(copiesFor(4) * 4).toBeGreaterThanOrEqual(ROW_MIN_CARDS);
    expect(copiesFor(7)).toBe(2);
    expect(copiesFor(15)).toBe(1);
    for (let n = 1; n <= 15; n++) expect(copiesFor(n) * n).toBeGreaterThanOrEqual(ROW_MIN_CARDS);
  });
});

describe("what leaves the server", () => {
  const lib = read("src/lib/home/designer-wall.ts");
  const wall = read("src/components/home/landing/designer-wall.tsx");
  const css = read("src/components/home/landing/wall.css");

  it("only public profile fields of active, real designers, kept 10 minutes", () => {
    expect(lib).toMatch(/\.select\("name, username, avatar_path, created_at"\)/);
    expect(lib.match(/\.select\(/g)).toHaveLength(1);
    expect(lib).toMatch(/\.eq\("role", "designer"\)\s*\.eq\("status", "active"\)\s*\.eq\("is_test", false\)/);
    expect(lib).toMatch(/order\("created_at", \{ ascending: false \}\)\s*\.limit\(WALL_SIZE\)/);
    expect(lib).toMatch(/revalidate: 600/);
  });

  it("the copies are hidden from screen readers and Tab, and the row stops under the mouse", () => {
    expect(wall).toMatch(/aria-hidden=\{i > 0 \|\| undefined\}/);
    expect(wall).toMatch(/tabIndex=\{copy \? -1 : undefined\}/);
    expect(wall).toMatch(/href=\{`\/d\/\$\{d\.username\}`\}/);
    expect(css).toMatch(/\.lc-dw-mq:hover \.lc-dw-tr/);
    expect(css).toMatch(/overflow-x: clip/);
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
  });

  it("every CSS rule is scoped to the home page", () => {
    const selectors = css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "")
      .match(/[^{}]+(?=\{)/g)!
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("@"));
    for (const group of selectors) for (const s of group.split(",")) expect(s.trim(), s).toMatch(/^\.lc-landing /);
  });
});
