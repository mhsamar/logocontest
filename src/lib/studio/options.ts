/** Design Studio filters and page size (UI-JOURNEY P-13). */
export const STUDIO_FILTERS = ["all", "winners"] as const;
export type StudioFilter = (typeof STUDIO_FILTERS)[number];
export const STUDIO_PAGE_SIZE = 24;

export const parseStudioFilter = (v: unknown): StudioFilter => (v === "winners" ? "winners" : "all");

/** Start of today in Bangladesh (UTC+6, no daylight saving) as an ISO time: "new today" counts from here. */
export function startOfDhakaDay(now = new Date()): string {
  const dhaka = new Date(now.getTime() + 6 * 3_600_000);
  return new Date(Date.UTC(dhaka.getUTCFullYear(), dhaka.getUTCMonth(), dhaka.getUTCDate()) - 6 * 3_600_000).toISOString();
}
