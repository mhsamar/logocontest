import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn, revalidateTag: () => {} }));

const { CAROUSEL_MAX, pickLive, tileInitials, toCarousel } = await import("@/lib/home/carousel");
type Row = Parameters<typeof pickLive>[0][number];

// "Contests live right now", the home carousel (owner, 2026-10-29; Design/logocontest-site/index.html).
const row = (id: string, more: Partial<Row> = {}): Row => ({
  id,
  slug: `${id}-a1b2c3`,
  brand_name: id,
  business_type: "food",
  package: "standard",
  prize_amount: 5000,
  starts_at: "2026-10-20T00:00:00Z",
  ends_at: "2026-11-10T00:00:00Z",
  is_private: false,
  is_nda: false,
  is_promoted: false,
  is_urgent: false,
  is_highlighted: false,
  owner: { is_test: false },
  ...more,
});
const ids = (rows: Row[]) => rows.map((r) => r.id);

describe("which live contests the carousel shows, and in what order", () => {
  it("puts paid add-ons first, as the browse page's open tab: Featured, Urgent, Highlighted, Private, then the rest", () => {
    const rows = [row("plain"), row("private", { is_private: true }), row("nda", { is_nda: true }), row("hl", { is_highlighted: true }), row("urgent", { is_urgent: true }), row("featured", { is_promoted: true, is_urgent: true })];
    const out = ids(pickLive(rows, null));
    expect(out[0]).toBe("featured");
    expect(out[1]).toBe("urgent");
    expect(out[2]).toBe("hl");
    expect(out.slice(3, 5).sort()).toEqual(["nda", "private"]);
    expect(out[5]).toBe("plain");
  });

  it("inside a group, ending soonest first, and a contest without an end last", () => {
    const rows = [row("late", { ends_at: "2026-12-01T00:00:00Z" }), row("none", { ends_at: null }), row("soon", { ends_at: "2026-11-01T00:00:00Z" })];
    expect(ids(pickLive(rows, null))).toEqual(["soon", "late", "none"]);
  });

  it("stops at 12", () => {
    const rows = Array.from({ length: 20 }, (_, i) => row(`c${String(i).padStart(2, "0")}`, { ends_at: `2026-11-${String(i + 1).padStart(2, "0")}T00:00:00Z` }));
    const out = pickLive(rows, null);
    expect(CAROUSEL_MAX).toBe(12);
    expect(out).toHaveLength(12);
    expect(out[0].id).toBe("c00");
    expect(out[11].id).toBe("c11");
    expect(pickLive(rows, null, 3)).toHaveLength(3);
  });

  it("never a test client's contest (owner, 2026-10-22)", () => {
    const rows = [row("real"), row("test", { owner: { is_test: true } }), row("listed", { owner: [{ is_test: true }] }), row("no-owner", { owner: null })];
    expect(ids(pickLive(rows, null))).toEqual(["real", "no-owner"]);
  });

  it("hides a contest that opened after the Pro early-access cutoff (owner, 2026-10-13)", () => {
    const cut = new Date("2026-10-29T10:00:00Z");
    const rows = [row("old", { starts_at: "2026-10-29T09:59:00Z" }), row("new", { starts_at: "2026-10-29T10:01:00Z" }), row("unset", { starts_at: null })];
    expect(ids(pickLive(rows, cut))).toEqual(["old", "unset"]);
    expect(ids(pickLive(rows, null))).toEqual(["old", "new", "unset"]);
  });
});

describe("a card's facts", () => {
  it("never carries a private or NDA contest's name or slug (the slug is made from the name)", () => {
    for (const more of [{ is_private: true }, { is_nda: true }]) {
      const c = toCarousel(row("walima", more), 2, null);
      expect(c.name).toBeNull();
      expect(c.slug).toBeNull();
      expect(JSON.stringify(c)).not.toContain("walima-a1b2c3");
      expect(c.businessType).toBe("food");
    }
  });

  it("keeps an open contest's name, link, package, add-ons, prize, designs and end", () => {
    const c = toCarousel(row("Nirob Tea", { package: "premium", is_urgent: true, prize_amount: 10000 }), 4, { en: "Business card", bn: "বিজনেস কার্ড" });
    expect(c).toMatchObject({ name: "Nirob Tea", slug: "Nirob Tea-a1b2c3", package: "premium", urgent: true, highlighted: false, prize: 10000, designs: 4, endsAt: "2026-11-10T00:00:00Z" });
    expect(c.kind?.en).toBe("Business card");
  });
});

describe("the letter tile's initials", () => {
  it("first letters of the first two words, or one letter for one word", () => {
    expect(tileInitials("Padma Tech")).toEqual(["P", "T"]);
    expect(tileInitials("walima")).toEqual(["W"]);
    expect(tileInitials("  Kotha   Books Shop ")).toEqual(["K", "B"]);
  });

  it("skips signs, keeps a Bangla letter whole and never comes back empty", () => {
    expect(tileInitials("Fish & Chips")).toEqual(["F", "C"]);
    expect(tileInitials("“Nirob” Tea")).toEqual(["N", "T"]);
    expect(tileInitials("নীরব চা")).toEqual(["নী", "চা"]);
    expect(tileInitials("   ")).toEqual(["•"]);
    expect(tileInitials("&")).toEqual(["•"]);
  });
});
