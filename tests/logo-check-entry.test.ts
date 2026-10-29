import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  badgeFor,
  closestResults,
  DEFAULT_LEVEL_RANGES,
  filterCounts,
  isReportId,
  levelFor,
  matchesFilter,
  REPORT_ALPHABET,
  reportIdFrom,
  reuseDecision,
  shouldFlag,
  sortForJudging,
  verifyState,
  type Badge,
  type CheckForBadge,
} from "@/lib/logo-check/entry-rules";
import { DEFAULT_PRO_SETTINGS, dhakaMonth, logoCheckLimit } from "@/lib/pro/rules";

// A tiny in-memory stand-in for the Supabase admin client: enough for the link and flag steps.
type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
const upserts: { table: string; row: Row }[] = [];
function from(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let patch: Row | null = null;
  const run = () => {
    const rows = (tables[table] ??= []).filter((r) => filters.every((f) => f(r)));
    if (patch) rows.forEach((r) => Object.assign(r, patch));
    return rows;
  };
  const api = {
    select: () => api,
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), api),
    is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), api),
    update: (p: Row) => ((patch = p), api),
    upsert: async (row: Row) => {
      upserts.push({ table, row });
      return { error: null };
    },
    maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
    then: (ok: (v: { data: Row[]; error: null }) => unknown) => Promise.resolve({ data: run(), error: null }).then(ok),
  };
  return api;
}
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from }) }));
vi.mock("@/lib/pro/settings", () => ({ getProSettings: async () => ({ settings: DEFAULT_PRO_SETTINGS, ready: true }) }));
const { flagIfHigh, linkEntryCheck, sha256Hex } = await import("@/lib/logo-check/entry-links");

const SHA = "a".repeat(64);
const OTHER = "b".repeat(64);
const check = (over: Partial<CheckForBadge> = {}): CheckForBadge => ({ id: "k1", status: "done", entryId: "e1", fileSha256: SHA, score: 4, level: "low", reportId: "LC-ABCD-EFGH", ...over });
const entry = { id: "e1", checkId: "k1", fileSha256: SHA };

describe("Logo check inside contests: limits (owner, 2026-10-14)", () => {
  it("Basic gets 2 checks a month and Pro 20 (owner, 2026-10-29), from Admin › Pro plan", () => {
    expect(logoCheckLimit(false, DEFAULT_PRO_SETTINGS)).toBe(2);
    expect(logoCheckLimit(true, DEFAULT_PRO_SETTINGS)).toBe(20);
    expect(logoCheckLimit(false, { ...DEFAULT_PRO_SETTINGS, basicLogoChecks: 5 })).toBe(5);
  });

  it("checks start again on the 1st of the month, Bangladesh time", () => {
    const lastMinute = dhakaMonth(new Date("2026-10-31T17:59:00Z")); // 31 Oct, 11:59 pm in Dhaka
    const firstMinute = dhakaMonth(new Date("2026-10-31T18:00:00Z")); // 1 Nov, midnight in Dhaka
    expect(lastMinute.key).toBe("2026-10-01");
    expect(firstMinute.key).toBe("2026-11-01");
    expect(lastMinute.to.toISOString()).toBe("2026-10-31T18:00:00.000Z");
  });
});

describe("match levels", () => {
  it("Low 0–20, Medium 21–60, High 61+ by default; admins can change the ranges", () => {
    expect([0, 20, 21, 60, 61, 100].map((s) => levelFor(s, DEFAULT_LEVEL_RANGES))).toEqual(["low", "low", "medium", "medium", "high", "high"]);
    expect(levelFor(30, { lowMax: 30, mediumMax: 50 })).toBe("low");
  });

  it("only High is flagged to admin", () => {
    expect([shouldFlag("low"), shouldFlag("medium"), shouldFlag("high"), shouldFlag(null)]).toEqual([false, false, true, false]);
  });
});

describe("the badge", () => {
  it("shows the result while the entry uses the checked file", () => {
    expect(badgeFor(entry, check())).toEqual({ kind: "checked", level: "low", score: 4, reportId: "LC-ABCD-EFGH" });
  });

  it("a different file fingerprint removes the badge (Not checked)", () => {
    expect(badgeFor({ ...entry, fileSha256: OTHER }, check())).toEqual({ kind: "none" });
    expect(badgeFor({ ...entry, fileSha256: null }, check())).toEqual({ kind: "none" });
  });

  it("no badge for a check on another entry, another check, or one still running", () => {
    expect(badgeFor(entry, check({ entryId: "e2" }))).toEqual({ kind: "none" });
    expect(badgeFor({ ...entry, checkId: "k2" }, check())).toEqual({ kind: "none" });
    expect(badgeFor(entry, check({ status: "running", score: null, level: null }))).toEqual({ kind: "none" });
    expect(badgeFor(entry, null)).toEqual({ kind: "none" });
  });
});

describe("judging page order and filters", () => {
  const low = (n: number): Badge => ({ kind: "checked", level: "low", score: n, reportId: "LC-AAAA-AAAA" });
  const list = [
    { number: 1, pro: false, rating: 5, badge: low(9), status: "active", isShortlisted: true },
    { number: 2, pro: true, rating: null, badge: { kind: "none" } as Badge, status: "active", isShortlisted: false },
    { number: 3, pro: false, rating: 2, badge: { kind: "checked", level: "high", score: 82, reportId: "LC-BBBB-BBBB" } as Badge, status: "active", isShortlisted: false },
    { number: 4, pro: true, rating: 3, badge: low(4), status: "active", isShortlisted: false },
    { number: 5, pro: false, rating: null, badge: { kind: "checked", level: "medium", score: 38, reportId: "LC-CCCC-CCCC" } as Badge, status: "rejected", isShortlisted: false },
  ];
  const order = (s: Parameters<typeof sortForJudging>[1]) => sortForJudging(list, s).map((e) => e.number);

  it("Pro first is Pro entries newest first, then everyone else newest first; the checker never moves them", () => {
    expect(order("pro")).toEqual([4, 2, 5, 3, 1]);
    const sameButOtherResults = list.map((e) => ({ ...e, badge: { kind: "none" } as Badge }));
    expect(sortForJudging(sameButOtherResults, "pro").map((e) => e.number)).toEqual([4, 2, 5, 3, 1]);
  });

  it("Newest, Top rated, and Lowest match (Low → Medium → High → Not checked)", () => {
    expect(order("newest")).toEqual([5, 4, 3, 2, 1]);
    expect(order("top")).toEqual([1, 4, 3, 5, 2]);
    expect(order("lowest")).toEqual([4, 1, 5, 3, 2]);
  });

  it("Checked, Not checked and Shortlisted, with counts; rejected only under Rejected", () => {
    expect(list.filter((e) => matchesFilter(e, "checked")).map((e) => e.number)).toEqual([1, 3, 4]);
    expect(filterCounts(list)).toEqual({ all: 4, checked: 3, unchecked: 1, shortlisted: 1, unrated: 1, rejected: 1 });
  });
});

describe("verify page and report reuse", () => {
  it("a valid report while the file matches, File changed when it doesn't", () => {
    expect(verifyState(SHA, SHA)).toBe("valid");
    expect(verifyState(SHA, OTHER)).toBe("changed");
    expect(verifyState(SHA, null)).toBe("changed");
  });

  it("the client reuses a report of the same file instead of using a check", () => {
    expect(reuseDecision(null, SHA)).toBe("new");
    expect(reuseDecision({ fileSha256: SHA }, SHA)).toBe("reuse");
    expect(reuseDecision({ fileSha256: OTHER }, SHA)).toBe("detach");
    expect(reuseDecision({ fileSha256: null }, SHA)).toBe("reuse");
  });

  it("report IDs are LC-XXXX-XXXX without look-alike letters", () => {
    const id = reportIdFrom(new Uint8Array([0, 1, 2, 3, 31, 32, 255, 100]));
    expect(isReportId(id)).toBe(true);
    expect(REPORT_ALPHABET).not.toMatch(/[IO01]/);
    expect(isReportId("LC-0000-1111")).toBe(false);
    expect(isReportId("CC-0001")).toBe(false);
  });

  it("closest results keep a source name, an https link and the similarity, never an image", () => {
    const out = closestResults([
      { title: "Shop", site: "shop.example", pageUrl: "https://shop.example/p", similarity: 12 },
      { title: null, site: "bad.example", pageUrl: "javascript:alert(1)", similarity: 40 },
    ]);
    expect(out).toEqual([
      { name: "bad.example", url: null, similarity: 40 },
      { name: "shop.example", url: "https://shop.example/p", similarity: 12 },
    ]);
  });
});

describe("linking a check to the sent entry, and the admin flag", () => {
  beforeEach(() => {
    for (const k of Object.keys(tables)) delete tables[k];
    upserts.length = 0;
    tables.entries = [{ id: "e1", check_id: null, file_sha256: null }];
    tables.logo_checks = [{ id: "11111111-1111-1111-1111-111111111111", source: "pre_submit", requested_by: "d1", contest_id: "c1", file_sha256: SHA, status: "done", entry_id: null, level: "high", score: 82 }];
  });
  const K = "11111111-1111-1111-1111-111111111111";

  it("the fingerprint is the SHA-256 of the exact bytes", () => {
    expect(sha256Hex(new TextEncoder().encode("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("links the check when the file matches, and a High match goes to Admin › Copyright checker", async () => {
    expect(await linkEntryCheck({ entryId: "e1", designerId: "d1", contestId: "c1", fileSha256: SHA, checkId: K })).toBe(true);
    expect(tables.entries[0]).toMatchObject({ check_id: K, file_sha256: SHA });
    expect(tables.logo_checks[0].entry_id).toBe("e1");
    expect(upserts).toEqual([{ table: "logo_check_flags", row: { check_id: K, entry_id: "e1", contest_id: "c1", score: 82 } }]);
  });

  it("a different file is not linked (Not checked), and nothing is flagged", async () => {
    expect(await linkEntryCheck({ entryId: "e1", designerId: "d1", contestId: "c1", fileSha256: OTHER, checkId: K })).toBe(false);
    expect(tables.entries[0]).toMatchObject({ check_id: null, file_sha256: OTHER });
    expect(upserts).toEqual([]);
  });

  it("someone else's check, or one from another contest, is never linked", async () => {
    expect(await linkEntryCheck({ entryId: "e1", designerId: "d2", contestId: "c1", fileSha256: SHA, checkId: K })).toBe(false);
    expect(await linkEntryCheck({ entryId: "e1", designerId: "d1", contestId: "c2", fileSha256: SHA, checkId: K })).toBe(false);
    expect(tables.entries[0].check_id).toBeNull();
  });

  it("Low and Medium matches are not flagged; a High match whose file changed is not either", async () => {
    tables.logo_checks[0].level = "medium";
    await linkEntryCheck({ entryId: "e1", designerId: "d1", contestId: "c1", fileSha256: SHA, checkId: K });
    expect(upserts).toEqual([]);
    tables.logo_checks[0].level = "high";
    tables.entries[0].file_sha256 = OTHER;
    expect(await flagIfHigh(K)).toBe(false);
  });
});
