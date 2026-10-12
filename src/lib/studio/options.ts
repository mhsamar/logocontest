import { BUSINESS_TYPES, type BusinessType } from "@/lib/contests/brief";

/** Design Studio (UI-JOURNEY P-13; redesign owner 2026-10-12, Design/design-studio): tabs, sort and page size. */
export const STUDIO_TABS = ["all", "winners", "new"] as const;
export type StudioTab = (typeof STUDIO_TABS)[number];
export const STUDIO_SORTS = ["newest", "oldest", "liked", "files"] as const;
export type StudioSort = (typeof STUDIO_SORTS)[number];
export const STUDIO_PAGE_SIZE = 24;
/** A design shows at most this many files (entry_images positions 0–7). */
export const STUDIO_MAX_FILES = 8;
/** The "New" badge: sent in the last 24 hours. */
export const STUDIO_NEW_MS = 86_400_000;

export type StudioQuery = { tab: StudioTab; q: string; type: BusinessType | null; sort: StudioSort };

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);

/** Reads ?tab=&q=&type=&sort= (and the old ?filter=winners). Anything unknown falls back to the default. */
export function parseStudioQuery(sp: Record<string, unknown>): StudioQuery {
  const tab = String(first(sp.tab) ?? (first(sp.filter) === "winners" ? "winners" : ""));
  const sort = String(first(sp.sort) ?? "");
  const type = String(first(sp.type) ?? "");
  return {
    tab: (STUDIO_TABS as readonly string[]).includes(tab) ? (tab as StudioTab) : "all",
    q: String(first(sp.q) ?? "").replace(/\s+/g, " ").trim().slice(0, 60),
    type: (BUSINESS_TYPES as readonly string[]).includes(type) ? (type as BusinessType) : null,
    sort: (STUDIO_SORTS as readonly string[]).includes(sort) ? (sort as StudioSort) : "newest",
  };
}

/** The page address for a query, with some parts changed. Defaults are left out so links stay short. */
export function studioHref(q: StudioQuery, change: Partial<StudioQuery> = {}): string {
  const next = { ...q, ...change };
  const p = new URLSearchParams();
  if (next.tab !== "all") p.set("tab", next.tab);
  if (next.q) p.set("q", next.q);
  if (next.type) p.set("type", next.type);
  if (next.sort !== "newest") p.set("sort", next.sort);
  const s = p.toString();
  return s ? `/design-studio?${s}` : "/design-studio";
}

/** Start of today in Bangladesh (UTC+6, no daylight saving) as an ISO time: "new today" counts from here. */
export function startOfDhakaDay(now = new Date()): string {
  const dhaka = new Date(now.getTime() + 6 * 3_600_000);
  return new Date(Date.UTC(dhaka.getUTCFullYear(), dhaka.getUTCMonth(), dhaka.getUTCDate()) - 6 * 3_600_000).toISOString();
}

/** The file under the pointer when a card of this width is split into equal strips, one per file. */
export function stripIndex(x: number, width: number, files: number): number {
  if (files <= 1 || width <= 0) return 0;
  return Math.min(files - 1, Math.max(0, Math.floor((x / width) * files)));
}

/** Which side the hover preview opens on: the side with more room, and upward near the bottom of the screen. */
export function previewSide(
  card: { left: number; right: number; top: number },
  view: { width: number; height: number },
  preview: { width: number; height: number },
): { x: "right" | "left"; y: "down" | "up" } {
  const roomRight = view.width - card.right;
  const roomLeft = card.left;
  const x = roomRight >= preview.width + 24 || roomRight >= roomLeft ? "right" : "left";
  const y = card.top + preview.height > view.height - 16 && card.top > view.height / 2 ? "up" : "down";
  return { x, y };
}
