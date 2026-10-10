import { dhakaStart } from "./analytics";

/** Admin period switcher (design/admin): Today / 3 days / 7 days / 30 days / All time / Custom, in Dhaka days. */
export const PERIODS = ["today", "3", "7", "30", "all", "custom"] as const;
export type PeriodKey = (typeof PERIODS)[number];
export type Period = { since: Date | null; until: Date | null };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The period for ?range= (plus ?from=&to= for Custom). Null when a Custom range is missing or wrong. */
export function periodOf(range: PeriodKey, from: string, to: string, now = new Date()): Period | null {
  if (range === "today") return { since: dhakaStart(0, now), until: null };
  if (range === "all") return { since: null, until: null };
  if (range === "custom") {
    if (!DAY.test(from) || !DAY.test(to)) return null;
    const since = new Date(`${from}T00:00:00+06:00`);
    const until = new Date(new Date(`${to}T00:00:00+06:00`).getTime() + 86_400_000);
    return Number.isNaN(since.getTime()) || Number.isNaN(until.getTime()) || until <= since ? null : { since, until };
  }
  return { since: dhakaStart(Number(range) - 1, now), until: null };
}

/** Reads ?range=, ?from= and ?to=; `allowed` leaves out keys a page doesn't offer. Falls back to 30 days. */
export function readPeriod(sp: Record<string, string | string[] | undefined>, allowed: readonly PeriodKey[] = PERIODS, fallback: PeriodKey = "30") {
  const range: PeriodKey = allowed.find((r) => r === sp.range) ?? fallback;
  const from = typeof sp.from === "string" ? sp.from : "";
  const to = typeof sp.to === "string" ? sp.to : "";
  const period = periodOf(range, from, to);
  return { range, from, to, period, effective: period ?? (periodOf(fallback, "", "") as Period) };
}
