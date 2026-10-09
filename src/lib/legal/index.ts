import "server-only";
import { faqParams } from "@/lib/home/faq-params";
import type { Locale } from "@/lib/i18n/config";
import type { Translate } from "@/lib/i18n/translate";
import { getSettings } from "@/lib/settings";
import { getContact } from "@/lib/content/contact";
import { AGREEMENT_BN, LEGAL_BN } from "./bn";
import { AGREEMENT_EN, LEGAL_EN } from "./en";
import { textToAgreement, textToDoc } from "./format";
import { publishedDoc } from "./store";
import { fillLegal, LEGAL_VERSION, type AgreementText, type LegalBlock, type LegalDoc, type LegalSlug } from "./types";

/** Numbers for the legal texts, all from settings (the same ones the Q&A uses, plus the claim and re-pick days). */
export async function legalParams(t: Translate, locale: Locale): Promise<Record<string, string | number>> {
  const [{ params }, s, contact] = await Promise.all([faqParams(t, locale), getSettings(["timers.copy_claim_days", "timers.repick_window_days"]), getContact(locale)]);
  return { ...params, claimDays: s["timers.copy_claim_days"], repick: s["timers.repick_window_days"], phone: contact.phone };
}

const fillBlock = (b: LegalBlock, p: Record<string, string | number>): LegalBlock => (typeof b === "string" ? fillLegal(b, p) : { list: b.list.map((x) => fillLegal(x, p)) });

/** The built-in page or agreement, before any admin edits. */
export const builtInDoc = (slug: LegalSlug, locale: Locale): LegalDoc => (locale === "bn" ? LEGAL_BN : LEGAL_EN)[slug];
export const builtInAgreement = (locale: Locale): AgreementText => (locale === "bn" ? AGREEMENT_BN : AGREEMENT_EN);

/** One legal page in the reader's language (the admin's published text, else the built-in one), numbers filled in. */
export async function legalDoc(slug: LegalSlug, locale: Locale, params: Record<string, string | number>): Promise<LegalDoc & { version: string }> {
  const published = await publishedDoc(slug, locale);
  const parsed = published ? textToDoc(published.body) : null;
  const doc = parsed?.ok ? parsed.doc : builtInDoc(slug, locale);
  return {
    title: doc.title,
    description: doc.description,
    summary: doc.summary.map((x) => fillLegal(x, params)),
    sections: doc.sections.map((sec) => ({ ...sec, blocks: sec.blocks.map((b) => fillBlock(b, params)) })),
    version: parsed?.ok ? published!.version : LEGAL_VERSION,
  };
}

/** The originality agreement in the reader's language (published or built-in). */
export async function agreementText(locale: Locale): Promise<AgreementText> {
  const published = await publishedDoc("agreement", locale);
  const parsed = published ? textToAgreement(published.body) : null;
  return parsed?.ok ? parsed.agreement : builtInAgreement(locale);
}
