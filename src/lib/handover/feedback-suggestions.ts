/**
 * Ready-made feedback lines for the approval sheet (owner, 2026-11-03): the client taps one instead of writing from
 * scratch. The lines follow the rating the client picked and fill in the brand, its business and the style from the
 * brief; a line that needs a detail the brief doesn't have is left out. Pure, so it is tested without the page.
 */

export type FeedbackContext = { brand: string; business: string | null; style: string | null };

type Line = { key: string; needs?: "business" | "style" };

/** By rating: 4–5 praise, 3 kind, 1–2 polite. Before a rating is picked the praise lines show. */
const LINES: Record<"high" | "mid" | "low", Line[]> = {
  high: [
    { key: "fitsBrand" },
    { key: "business", needs: "business" },
    { key: "style", needs: "style" },
    { key: "brief" },
    { key: "files" },
    { key: "again" },
  ],
  mid: [{ key: "goodBrand" }, { key: "details" }, { key: "filesOk" }, { key: "thanks" }],
  low: [{ key: "notQuite" }, { key: "slow" }, { key: "effort" }],
};

export const feedbackTone = (stars: number) => (stars === 0 || stars >= 4 ? "high" : stars === 3 ? "mid" : "low");

/** The i18n keys (under handover.review.suggest) and their params, at most `max` of them. */
export function feedbackSuggestions(stars: number, ctx: FeedbackContext, max = 4) {
  const tone = feedbackTone(stars);
  const params = { brand: ctx.brand.trim(), business: ctx.business?.trim() ?? "", style: ctx.style?.trim() ?? "" };
  return LINES[tone]
    .filter((l) => !l.needs || params[l.needs])
    .slice(0, max)
    .map((l) => ({ key: `handover.review.suggest.${tone}.${l.key}`, params }));
}

/** The text after tapping a line: added on a new sentence, never twice. */
export function addSuggestion(text: string, line: string) {
  if (text.includes(line)) return text;
  const t = text.trimEnd();
  return t ? `${t} ${line}` : line;
}

/** The context from a contest, with the business and the first style in the reader's language. */
export function feedbackContextOf(
  contest: { brandName: string; businessType: string; brief: { businessTypeOther: string | null; styles: string[] } | null },
  t: (key: never) => string,
): FeedbackContext {
  const label = (key: string) => (t as (key: string) => string)(key);
  const other = contest.brief?.businessTypeOther?.trim();
  const business = contest.businessType === "other" ? other || null : contest.businessType ? label(`wizard.businessTypes.${contest.businessType}`) : null;
  const style = contest.brief?.styles[0] ? label(`wizard.styles.${contest.brief.styles[0]}`) : null;
  return { brand: contest.brandName, business, style };
}
