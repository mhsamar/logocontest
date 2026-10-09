/** Legal pages (BLUEPRINT §14, P-10) and the designer originality agreement (§9.6). */

export const LEGAL_SLUGS = ["terms", "privacy", "payment-refund", "designer-rules"] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

/** A paragraph, or a bullet list. `{name}` placeholders are filled from settings when shown. */
export type LegalBlock = string | { list: string[] };

export type LegalSection = { id: string; heading: string; blocks: LegalBlock[] };

export type LegalDoc = { title: string; description: string; summary: string[]; sections: LegalSection[] };

/** Bump when the wording changes; shown as "Last updated" and stored with each signed agreement. */
export const LEGAL_VERSION = "2026-10-09";

export type AgreementText = { title: string; intro: string; clauses: string[]; closing: string };

export const isLegalSlug = (v: string): v is LegalSlug => (LEGAL_SLUGS as readonly string[]).includes(v);

/** Fills `{name}` placeholders; unknown names are left as they are. */
export function fillLegal(text: string, params: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, key: string) => (key in params ? String(params[key]) : m));
}
