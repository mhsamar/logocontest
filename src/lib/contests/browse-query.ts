import { BUSINESS_TYPES, type BusinessType } from "./brief";
import type { MessageKey, Translate } from "@/lib/i18n/translate";

/** P-02 status tabs (UI-JOURNEY). Each tab covers one or more contest statuses. */
export const BROWSE_TABS = ["open", "judging", "completed"] as const;
/** Signed-in designers also get "Joined by me" (owner, 2026-10-11): contests they sent a design to. */
export const DESIGNER_TABS = ["open", "joined", "judging", "completed"] as const;
export type BrowseTab = (typeof DESIGNER_TABS)[number];

export const TAB_STATUSES: Record<BrowseTab, readonly string[]> = {
  open: ["open"],
  joined: ["open", "judging", "winner_selected", "handover", "completed", "no_result"],
  judging: ["judging", "winner_selected", "handover"],
  completed: ["completed", "no_result"],
};

export const BROWSE_SORTS = ["ending", "newest", "prize"] as const;
export type BrowseSort = (typeof BROWSE_SORTS)[number];

/** Quick filters above the list (owner, 2026-10-11). "Big prize" uses the amount in Settings. */
export const QUICK_FILTERS = ["featured", "urgent", "ending", "big"] as const;
export type QuickFilter = (typeof QUICK_FILTERS)[number];
/** "Ending soon": an open contest with this many days or fewer left (the days line turns orange too). */
export const ENDING_SOON_DAYS = 3;

export const BROWSE_PAGE_SIZE = 20;
export const SEARCH_MAX = 60;

/** `page` counts how many pages are shown: "Load more contests" adds the next one under the first. */
export type BrowseQuery = { tab: BrowseTab; sort: BrowseSort; type: BusinessType | null; page: number; quick: QuickFilter[]; q: string };

const pick = <T extends string>(list: readonly T[], value: unknown): T | null =>
  typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : null;

const defaultSort = (tab: BrowseTab): BrowseSort => (tab === "open" ? "ending" : "newest");

/** Reads ?status=&sort=&type=&page=&f=&q= from the URL. Anything unknown falls back to the default. */
export function parseBrowseQuery(params: Record<string, string | string[] | undefined>): BrowseQuery {
  const one = (k: string) => (Array.isArray(params[k]) ? params[k][0] : params[k]);
  const tab = pick(DESIGNER_TABS, one("status")) ?? "open";
  // "Ending soon" only means something while contests are taking entries.
  const sort = pick(BROWSE_SORTS, one("sort")) ?? defaultSort(tab);
  const page = Math.max(1, Math.min(10_000, Number.parseInt(one("page") ?? "1", 10) || 1));
  const asked = new Set((one("f") ?? "").split(","));
  const quick = QUICK_FILTERS.filter((f) => asked.has(f));
  const q = (one("q") ?? "").replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX);
  return { tab, sort: tab !== "open" && sort === "ending" ? "newest" : sort, type: pick(BUSINESS_TYPES, one("type")), page, quick, q };
}

/** Builds a /contests URL, leaving out defaults so links stay short. */
export function browseHref(q: BrowseQuery, change: Partial<BrowseQuery> = {}): string {
  const next = { ...q, ...change };
  // Changing a filter goes back to page 1.
  if (!("page" in change)) next.page = 1;
  if ("tab" in change && !("sort" in change)) next.sort = defaultSort(next.tab);
  const p = new URLSearchParams();
  if (next.tab !== "open") p.set("status", next.tab);
  if (next.sort !== defaultSort(next.tab)) p.set("sort", next.sort);
  if (next.type) p.set("type", next.type);
  if (next.quick.length) p.set("f", QUICK_FILTERS.filter((f) => next.quick.includes(f)).join(","));
  if (next.q) p.set("q", next.q);
  if (next.page > 1) p.set("page", String(next.page));
  const s = p.toString();
  return s ? `/contests?${s}` : "/contests";
}

/** The quick filter list with one filter switched on or off. */
export const toggleQuick = (list: QuickFilter[], f: QuickFilter): QuickFilter[] => (list.includes(f) ? list.filter((x) => x !== f) : [...list, f]);

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

/** A contest card's category: the service name for non-logo contests (owner, 2026-10-13), else the business type. */
export function categoryLabel(c: { kind: { en: string; bn: string } | null; businessType: string }, t: Translate, locale: string): string {
  if (c.kind) return locale === "bn" ? c.kind.bn || c.kind.en : c.kind.en;
  return t(`wizard.businessTypes.${c.businessType}` as MessageKey);
}
