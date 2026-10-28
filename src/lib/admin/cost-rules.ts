/**
 * Admin › Costs (owner, 2026-10-27: "ai er expense ai site a sob rakhba, mailing er khoroch, AI checker er khoroch,
 * nude photo check er khoroch ... monthly count"). Only what the site itself can count (owner's choice): no hosting,
 * domain or ad bills. Pure: the counts come from the database and the prices from Settings.
 *
 * - AI logo checker: exact, every check keeps its own cost.
 * - Nude photo check, Google SafeSearch: one call per design picture (profile photos are not counted).
 * - Nude photo check, AI: one AI call per new logo design (the design check).
 * - AI support assistant: one AI call per assistant message.
 * - Emails: one per email sent.
 * The AI calls other than the checker don't keep their cost, so they are worked out from typical token counts.
 */

/** Typical tokens of one design check: the instructions, each picture, and the answer with the model's thinking. */
export const DESIGN_CHECK_TOKENS = { in: 1_000, inPerPicture: 1_100, out: 600 } as const;
/** Typical tokens of one support assistant answer: the site's facts, the chat so far, and the answer. */
export const SUPPORT_REPLY_TOKENS = { in: 6_000, out: 1_000 } as const;

export type CostPrices = {
  /** Taka per US dollar. */
  usdToBdt: number;
  /** USD per input / output token of the AI model. */
  aiIn: number;
  aiOut: number;
  /** USD per SafeSearch picture, and the pictures Google checks free each month. */
  safeSearch: number;
  safeSearchFree: number;
  /** USD per email, and the emails the plan includes each month. */
  email: number;
  emailFree: number;
};

/** The settings the prices come from (cents, so they stay whole numbers). */
export const COST_KEYS = [
  "checker.usd_to_bdt",
  "checker.cost_ai_in_cents_per_m",
  "checker.cost_ai_out_cents_per_m",
  "costs.safesearch_cents_per_1000",
  "costs.safesearch_free_per_month",
  "costs.email_cents_per_1000",
  "costs.email_free_per_month",
] as const;

export function pricesFrom(s: Record<(typeof COST_KEYS)[number], number>): CostPrices {
  return {
    usdToBdt: s["checker.usd_to_bdt"],
    aiIn: s["checker.cost_ai_in_cents_per_m"] / 100 / 1_000_000,
    aiOut: s["checker.cost_ai_out_cents_per_m"] / 100 / 1_000_000,
    safeSearch: s["costs.safesearch_cents_per_1000"] / 100 / 1000,
    safeSearchFree: s["costs.safesearch_free_per_month"],
    email: s["costs.email_cents_per_1000"] / 100 / 1000,
    emailFree: s["costs.email_free_per_month"],
  };
}

/** What happened in one month, as the site counted it. */
export type MonthCounts = {
  /** Logo checker: checks made and their kept cost in taka. */
  checks: number;
  checkerBdt: number;
  /** New logo designs (each gets the AI design check) and their pictures; every new design picture (each gets SafeSearch). */
  designs: number;
  designPictures: number;
  pictures: number;
  /** Messages the support assistant posted. */
  aiReplies: number;
  emails: number;
  emailsFailed: number;
};

/** Which paid checks are switched on now; one that is off costs nothing. */
export type CostSwitches = { designCheck: boolean; safeSearch: boolean };

export type CostLineKey = "checker" | "safeSearch" | "designCheck" | "support" | "email";
export type CostLine = {
  key: CostLineKey;
  /** How many: checks, pictures, designs, answers or emails. */
  count: number;
  bdt: number;
  /** True when the site knows each one's cost (the checker keeps it; emails have one price); false when worked out. */
  exact: boolean;
  /** Switched off now: counted, but not charged. */
  off?: boolean;
  /** For lines with a free monthly allowance: how much of it was used. */
  free?: { used: number; limit: number };
};

const taka = (usd: number, p: CostPrices) => Math.round(usd * p.usdToBdt * 100) / 100;

/** Taka for one design check with this many pictures, and for one assistant answer. */
export const designCheckUsd = (pictures: number, p: CostPrices) => (DESIGN_CHECK_TOKENS.in + DESIGN_CHECK_TOKENS.inPerPicture * pictures) * p.aiIn + DESIGN_CHECK_TOKENS.out * p.aiOut;
export const supportReplyUsd = (p: CostPrices) => SUPPORT_REPLY_TOKENS.in * p.aiIn + SUPPORT_REPLY_TOKENS.out * p.aiOut;

export function costLines(c: MonthCounts, p: CostPrices, on: CostSwitches): CostLine[] {
  const designUsd = c.designs * (DESIGN_CHECK_TOKENS.in * p.aiIn + DESIGN_CHECK_TOKENS.out * p.aiOut) + c.designPictures * DESIGN_CHECK_TOKENS.inPerPicture * p.aiIn;
  return [
    { key: "checker", count: c.checks, bdt: Math.round(c.checkerBdt * 100) / 100, exact: true },
    {
      key: "safeSearch",
      count: c.pictures,
      bdt: on.safeSearch ? taka(Math.max(0, c.pictures - p.safeSearchFree) * p.safeSearch, p) : 0,
      exact: false,
      ...(on.safeSearch ? {} : { off: true }),
      free: { used: Math.min(c.pictures, p.safeSearchFree), limit: p.safeSearchFree },
    },
    { key: "designCheck", count: c.designs, bdt: on.designCheck ? taka(designUsd, p) : 0, exact: false, ...(on.designCheck ? {} : { off: true }) },
    { key: "support", count: c.aiReplies, bdt: taka(c.aiReplies * supportReplyUsd(p), p), exact: false },
    { key: "email", count: c.emails, bdt: taka(Math.max(0, c.emails - p.emailFree) * p.email, p), exact: true, free: { used: Math.min(c.emails, p.emailFree), limit: p.emailFree } },
  ];
}

/** The month's total in taka, to the paisa. */
export const linesTotal = (lines: CostLine[]) => Math.round(lines.reduce((a, l) => a + l.bdt, 0) * 100) / 100;
