import { BUSINESS_TYPES, type BusinessType } from "./brief";

/** P-02 status tabs (UI-JOURNEY). Each tab covers one or more contest statuses. */
export const BROWSE_TABS = ["open", "judging", "completed"] as const;
export type BrowseTab = (typeof BROWSE_TABS)[number];

export const TAB_STATUSES: Record<BrowseTab, readonly string[]> = {
  open: ["open"],
  judging: ["judging", "winner_selected", "handover"],
  completed: ["completed", "no_result"],
};

export const BROWSE_SORTS = ["ending", "newest", "prize"] as const;
export type BrowseSort = (typeof BROWSE_SORTS)[number];

export const BROWSE_PAGE_SIZE = 20;

export type BrowseQuery = { tab: BrowseTab; sort: BrowseSort; type: BusinessType | null; page: number };

const pick = <T extends string>(list: readonly T[], value: unknown): T | null =>
  typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : null;

/** Reads ?status=&sort=&type=&page= from the URL. Anything unknown falls back to the default. */
export function parseBrowseQuery(params: Record<string, string | string[] | undefined>): BrowseQuery {
  const one = (k: string) => (Array.isArray(params[k]) ? params[k][0] : params[k]);
  const tab = pick(BROWSE_TABS, one("status")) ?? "open";
  // "Ending soon" only means something while contests are taking entries.
  const sort = pick(BROWSE_SORTS, one("sort")) ?? (tab === "open" ? "ending" : "newest");
  const page = Math.max(1, Math.min(10_000, Number.parseInt(one("page") ?? "1", 10) || 1));
  return { tab, sort: tab !== "open" && sort === "ending" ? "newest" : sort, type: pick(BUSINESS_TYPES, one("type")), page };
}

/** Builds a /contests URL, leaving out defaults so links stay short. */
export function browseHref(q: BrowseQuery, change: Partial<BrowseQuery> = {}): string {
  const next = { ...q, ...change };
  // Changing a filter goes back to page 1.
  if (!("page" in change)) next.page = 1;
  if ("tab" in change && !("sort" in change)) next.sort = next.tab === "open" ? "ending" : "newest";
  const p = new URLSearchParams();
  if (next.tab !== "open") p.set("status", next.tab);
  if (next.sort !== (next.tab === "open" ? "ending" : "newest")) p.set("sort", next.sort);
  if (next.type) p.set("type", next.type);
  if (next.page > 1) p.set("page", String(next.page));
  const s = p.toString();
  return s ? `/contests?${s}` : "/contests";
}

/** Page numbers to show: first, last, and two either side of the current one, with gaps as null. */
export function pageList(current: number, total: number): (number | null)[] {
  const pages = new Set([1, total, current - 2, current - 1, current, current + 1, current + 2]);
  const sorted = [...pages].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (const n of sorted) {
    if (out.length && n - (out[out.length - 1] as number) > 1) out.push(null);
    out.push(n);
  }
  return out;
}

export type TimelinePhase = { key: "entries" | "judging" | "handover"; progress: number; endsAt: Date | null; state: "done" | "active" | "upcoming" };

/**
 * P-03 timeline: Accepting entries → Judging → Files & handover, each with a
 * 0–1 progress value. Judging ends `judgingDays` after entries close unless
 * the contest has its own date.
 */
export function contestTimeline(
  c: { status: string; startsAt: Date | null; endsAt: Date | null; judgingEndsAt: Date | null },
  judgingDays: number,
  now: Date,
): TimelinePhase[] {
  const frac = (from: Date | null, to: Date | null) => {
    if (!from || !to || to <= from) return 0;
    return Math.min(1, Math.max(0, (now.getTime() - from.getTime()) / (to.getTime() - from.getTime())));
  };
  const judgingEnds = c.judgingEndsAt ?? (c.endsAt ? new Date(c.endsAt.getTime() + judgingDays * 86_400_000) : null);
  const step = ({ open: 0, judging: 1, winner_selected: 2, handover: 2, completed: 3, no_result: 3 } as Record<string, number>)[c.status] ?? 0;
  const phase = (i: number, key: TimelinePhase["key"], progress: number, endsAt: Date | null): TimelinePhase => ({
    key,
    endsAt,
    progress: step > i ? 1 : step === i ? progress : 0,
    state: step > i ? "done" : step === i ? "active" : "upcoming",
  });
  return [
    phase(0, "entries", frac(c.startsAt, c.endsAt), c.endsAt),
    phase(1, "judging", frac(c.endsAt, judgingEnds), judgingEnds),
    // Handover has no fixed end until a winner is picked.
    phase(2, "handover", 0.5, null),
  ];
}
