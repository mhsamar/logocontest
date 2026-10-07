import { describe, expect, it } from "vitest";
import { timeAgo } from "@/lib/dates";
import { browseHref, contestTimeline, pageList, parseBrowseQuery } from "@/lib/contests/browse-query";

describe("parseBrowseQuery", () => {
  it("defaults to open contests ending soonest", () => {
    expect(parseBrowseQuery({})).toEqual({ tab: "open", sort: "ending", type: null, page: 1 });
  });

  it("reads valid values and ignores unknown ones", () => {
    expect(parseBrowseQuery({ status: "completed", sort: "prize", type: "food", page: "3" })).toEqual({
      tab: "completed",
      sort: "prize",
      type: "food",
      page: 3,
    });
    expect(parseBrowseQuery({ status: "draft", sort: "x", type: "cars", page: "-4" })).toEqual({ tab: "open", sort: "ending", type: null, page: 1 });
  });

  it("'ending soon' falls back to newest outside the open tab", () => {
    expect(parseBrowseQuery({ status: "judging", sort: "ending" }).sort).toBe("newest");
  });
});

describe("browseHref", () => {
  const q = parseBrowseQuery({ status: "judging", type: "food", page: "4" });

  it("leaves defaults out", () => {
    expect(browseHref(parseBrowseQuery({}))).toBe("/contests");
  });

  it("resets to page 1 when a filter changes, and keeps the page when paging", () => {
    expect(browseHref(q, { type: null })).toBe("/contests?status=judging");
    expect(browseHref(q, { page: 5 })).toBe("/contests?status=judging&type=food&page=5");
  });

  it("switching tab picks that tab's default sort", () => {
    expect(browseHref(q, { tab: "open" })).toBe("/contests?type=food");
  });
});

describe("pageList", () => {
  it("shows all pages when there are few", () => {
    expect(pageList(1, 4)).toEqual([1, 2, 3, 4]);
  });
  it("puts gaps around the current page", () => {
    expect(pageList(10, 30)).toEqual([1, null, 8, 9, 10, 11, 12, null, 30]);
    expect(pageList(1, 30)).toEqual([1, 2, 3, null, 30]);
  });
});

describe("contestTimeline", () => {
  const day = 86_400_000;
  const start = new Date("2026-10-01T00:00:00Z");
  const end = new Date(start.getTime() + 10 * day);

  it("an open contest is partway through taking entries", () => {
    const [entries, judging, handover] = contestTimeline(
      { status: "open", startsAt: start, endsAt: end, judgingEndsAt: null },
      5,
      new Date(start.getTime() + 4 * day),
    );
    expect(entries).toMatchObject({ state: "active", progress: 0.4 });
    expect(judging).toMatchObject({ state: "upcoming", progress: 0, endsAt: new Date(end.getTime() + 5 * day) });
    expect(handover).toMatchObject({ state: "upcoming", progress: 0, endsAt: null });
  });

  it("a judging contest has finished taking entries", () => {
    const [entries, judging] = contestTimeline(
      { status: "judging", startsAt: start, endsAt: end, judgingEndsAt: null },
      5,
      new Date(end.getTime() + day),
    );
    expect(entries).toMatchObject({ state: "done", progress: 1 });
    expect(judging).toMatchObject({ state: "active", progress: 0.2 });
  });

  it("a completed contest has every phase done", () => {
    const phases = contestTimeline({ status: "completed", startsAt: start, endsAt: end, judgingEndsAt: null }, 5, new Date());
    expect(phases.map((p) => p.state)).toEqual(["done", "done", "done"]);
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  it("uses the largest whole unit", () => {
    expect(timeAgo(new Date("2026-10-08T11:59:30Z"), now, "en")).toBe("now");
    expect(timeAgo(new Date("2026-10-08T09:00:00Z"), now, "en")).toBe("3 hours ago");
    expect(timeAgo(new Date("2026-10-06T12:00:00Z"), now, "en")).toBe("2 days ago");
    expect(timeAgo(new Date("2026-10-06T12:00:00Z"), now, "bn")).toBe("২ দিন আগে");
  });
});
