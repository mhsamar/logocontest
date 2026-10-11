/**
 * Paid add-ons first in the "All contests" list (owner, 2026-10-11; Design/contest-pages): Featured, then Urgent,
 * then Highlighted, then Private, then every other contest. A contest sits in the group of the first add-on it has
 * in this list; inside a group the visitor's sort applies. Change the order here and only here.
 */
export const ADDON_ORDER = ["featured", "urgent", "highlighted", "private"] as const;
export type AddonKey = (typeof ADDON_ORDER)[number];

type Flags = { isPromoted: boolean; isUrgent: boolean; isHighlighted: boolean; isPrivate: boolean; isNda: boolean };

export const hasAddon = (c: Flags, key: AddonKey): boolean =>
  key === "featured" ? c.isPromoted : key === "urgent" ? c.isUrgent : key === "highlighted" ? c.isHighlighted : c.isPrivate || c.isNda;

/** 0 for the first group, …, ADDON_ORDER.length for contests without a paid add-on. */
export function addonRank(c: Flags): number {
  const i = ADDON_ORDER.findIndex((k) => hasAddon(c, k));
  return i < 0 ? ADDON_ORDER.length : i;
}
