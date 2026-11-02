/**
 * The client's daily pop-up (owner, 2026-11-02), one at a time, the most urgent first: final files to check, then a
 * winner to pick once the contest ended, then more time on a live contest's last day ("not liking the logos yet?",
 * one price for 3, 5 or 7 days), then new designs to rate, then the add-ons that bring more and better designers
 * (Featured, Urgent, Highlight) that it doesn't have yet. Pure.
 */

export const UPSELL_ADDONS = ["promote", "urgent", "highlight"] as const;
export type UpsellAddon = (typeof UPSELL_ADDONS)[number];

export type UpsellContest = {
  id: string;
  slug: string;
  brand: string;
  prize: number;
  /** "open", "judging", "winner_selected", "handover"… */
  status: string;
  endsAt: Date | null;
  active: Record<UpsellAddon, boolean>;
  /** Shown designs the client hasn't rated. */
  unrated: number;
  /** The winner sent the final files and they wait for the client. */
  filesReady: boolean;
};
type Base = { contestId: string; slug: string; brand: string };
export type Upsell =
  | (Base & { mode: "files" })
  | (Base & { mode: "pick" })
  | (Base & { mode: "extend"; endsAt: string; price: number; days: number[] })
  | (Base & { mode: "rate"; count: number })
  | (Base & { mode: "boost"; items: { key: UpsellAddon; price: number; free: boolean }[] });

/** "Last day": the contest ends within this. */
export const LAST_DAY_MS = 24 * 3_600_000;

export function pickUpsell(contests: UpsellContest[], prices: Record<UpsellAddon, number> & { extensionPrice: number; extensionDays: number[] }, allFree: (prize: number) => boolean, now: Date): Upsell | null {
  const base = (c: UpsellContest): Base => ({ contestId: c.id, slug: c.slug, brand: c.brand });
  const files = contests.find((c) => c.filesReady);
  if (files) return { ...base(files), mode: "files" };
  const judging = contests.find((c) => c.status === "judging");
  if (judging) return { ...base(judging), mode: "pick" };
  const live = contests.filter((c) => c.status === "open" && c.endsAt && c.endsAt.getTime() > now.getTime()).sort((a, b) => a.endsAt!.getTime() - b.endsAt!.getTime());
  // The one ending first, on its last day: more time.
  const ending = live.find((c) => c.endsAt!.getTime() - now.getTime() <= LAST_DAY_MS);
  if (ending && prices.extensionDays.length) return { ...base(ending), mode: "extend", endsAt: ending.endsAt!.toISOString(), price: prices.extensionPrice, days: prices.extensionDays };
  const toRate = live.find((c) => c.unrated > 0);
  if (toRate) return { ...base(toRate), mode: "rate", count: toRate.unrated };
  // Otherwise the first live contest that still lacks one of the three.
  for (const c of live) {
    const items = UPSELL_ADDONS.filter((k) => !c.active[k]).map((key) => ({ key, price: prices[key], free: allFree(c.prize) || prices[key] === 0 }));
    if (items.length) return { ...base(c), mode: "boost", items };
  }
  return null;
}

/** Bangladesh date "2026-11-02": the pop-up shows once per day per contest and offer, on this device. */
export const dhakaDate = (now: Date) => new Date(now.getTime() + 6 * 3_600_000).toISOString().slice(0, 10);
export const upsellSeenKey = (u: Pick<Upsell, "contestId" | "mode">) => `lc-upsell:${u.contestId}:${u.mode}`;
