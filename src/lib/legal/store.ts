import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { CONTENT_TAG } from "@/lib/content/texts";
import { isSupabaseConfigured } from "@/lib/env";
import type { Locale } from "@/lib/i18n/config";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEGAL_VERSION } from "./types";

export const LEGAL_DOC_SLUGS = ["terms", "privacy", "payment-refund", "designer-rules", "agreement"] as const;
export type LegalDocSlug = (typeof LEGAL_DOC_SLUGS)[number];
export const isLegalDocSlug = (v: string): v is LegalDocSlug => (LEGAL_DOC_SLUGS as readonly string[]).includes(v);

export type PublishedLegal = { slug: LegalDocSlug; locale: Locale; body: string; version: string; requireResign: boolean; publishedAt: string };

const load = unstable_cache(
  async (): Promise<PublishedLegal[]> => {
    if (!isSupabaseConfigured()) return [];
    const { data, error } = await createAdminClient().from("legal_docs").select("slug, locale, body, version, require_resign, published_at");
    if (error) return [];
    return data.map((r) => ({ slug: r.slug, locale: r.locale, body: r.body, version: r.version, requireResign: r.require_resign, publishedAt: r.published_at }) as PublishedLegal);
  },
  ["legal-docs-v1"],
  { tags: [CONTENT_TAG], revalidate: 3600 },
);

export const publishedLegal = cache(load);

/** The admin's published text of one page in one language, or null for the built-in text. */
export async function publishedDoc(slug: LegalDocSlug, locale: Locale): Promise<PublishedLegal | null> {
  return (await publishedLegal()).find((d) => d.slug === slug && d.locale === locale) ?? null;
}

/** The agreement version designers sign now: the newest published one, or the built-in date. */
export async function currentAgreementVersion(): Promise<string> {
  const versions = (await publishedLegal()).filter((d) => d.slug === "agreement").map((d) => d.version);
  return [LEGAL_VERSION, ...versions].sort().at(-1)!;
}

/** Agreements signed before this time must be signed again (null: any signature counts). Set on publish (A-16). */
export async function resignSince(): Promise<Date | null> {
  const v = await getSetting("legal.agreement_resign_since");
  return v ? new Date(v) : null;
}
