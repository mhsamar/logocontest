/**
 * Search landing pages (owner, 2026-10-21; SEO-PLAN.md §2.8): /logo-design-price, /logo-design and /about. The words
 * live in content modules (src/lib/landing/content/*.ts), one per page, in English and Bangla. Every number comes
 * from the live settings through placeholders, never typed into the text:
 *
 *   {minPrize}   smallest prize (৳3,000)          {minTotal}   smallest total with the fee (৳3,750)
 *   {fee}        service fee percent (25)         {largeFee}   fee percent for big prizes (15)
 *   {largeFrom}  prize above which it applies     {defaultDays} usual contest length in days (7)
 *   {minDays} / {maxDays}  shortest / longest contest   {judgingDays}  days the client has to pick a winner
 *   (The AI logo checker is free on every logo contest: no placeholder, just say so.)
 *   {guaranteeDesigners}  the guarantee's number of different designers (3)
 *   {year}       the year of the page's updatedAt
 * Amounts come out as "৳3,750" in English and "৳৩,৭৫০" in Bangla.
 */

export type LandingSection =
  /** Plain paragraphs under a heading. */
  | { kind: "text"; heading: string; paragraphs: string[]; onlyWithGuarantee?: boolean }
  /** Numbered steps. */
  | { kind: "steps"; heading: string; steps: { title: string; body: string }[]; onlyWithGuarantee?: boolean }
  /** The live package table (prize, fee, total for each package); the copy gives the heading, column names and a note. */
  | { kind: "prices"; heading: string; columns: { package: string; prize: string; fee: string; total: string }; note: string; onlyWithGuarantee?: boolean }
  /**
   * A comparison table: first column is the row label. `ours` says where logocontest.bd is, to highlight it: the first
   * data column (default) or the first row.
   */
  | { kind: "compare"; heading: string; columns: string[]; rows: { label: string; cells: string[] }[]; note?: string; ours?: "column" | "row"; onlyWithGuarantee?: boolean }
  /** A bullet list. */
  | { kind: "list"; heading: string; items: string[]; onlyWithGuarantee?: boolean }
  /** Questions and answers (also given to search engines as FAQ data). */
  | { kind: "faq"; heading: string; items: { q: string; a: string }[]; onlyWithGuarantee?: boolean };

export type LandingCopy = {
  /** The whole <title>, at most about 60 characters (the site name is not added). */
  title: string;
  /** Meta description, at most 155 characters. */
  description: string;
  h1: string;
  /** One or two sentences right under the heading that answer the search directly. */
  answer: string;
  /** Name of the page in breadcrumbs. */
  breadcrumb: string;
  sections: LandingSection[];
  /** The closing box with the main button (Start a contest). */
  cta: { heading: string; body: string; button: string };
};

export type LandingContent = {
  /** The page's address without a slash, e.g. "logo-design-price". */
  slug: string;
  /** The real date the words were last changed (YYYY-MM-DD), shown as "Updated …". */
  updatedAt: string;
  en: LandingCopy;
  bn: LandingCopy;
};
