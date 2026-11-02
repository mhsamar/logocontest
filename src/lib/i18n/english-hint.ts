/**
 * Who sees "View in English" on a Bangla page (owner, 2026-11-03): instead of being redirected, a visitor outside
 * Bangladesh (or who chose English before) gets a small bar linking to the /en version. Only by country, not the
 * browser's language (owner: most phones in Bangladesh are set to English). Not after they chose Bangla, nor once they
 * closed the bar (both kept in a cookie). Pure, so it is tested.
 */
export const HINT_COOKIE = "lc_en_hint";

export function showsEnglishHint(input: { chosen: string | null; dismissed: boolean; country: string | null }): boolean {
  if (input.dismissed || input.chosen === "bn") return false;
  if (input.chosen === "en") return true;
  return Boolean(input.country) && input.country!.toUpperCase() !== "BD";
}
