import "server-only";
import { faqParams } from "@/lib/home/faq-params";
import type { Locale } from "@/lib/i18n/config";
import type { Translate } from "@/lib/i18n/translate";
import { getSettings } from "@/lib/settings";
import { SUPPORT_PHONE } from "@/lib/site";
import { AGREEMENT_BN, LEGAL_BN } from "./bn";
import { AGREEMENT_EN, LEGAL_EN } from "./en";
import { fillLegal, type AgreementText, type LegalBlock, type LegalDoc, type LegalSlug } from "./types";

/** Numbers for the legal texts, all from settings (the same ones the Q&A uses, plus the claim and re-pick days). */
export async function legalParams(t: Translate, locale: Locale): Promise<Record<string, string | number>> {
  const [{ params }, s] = await Promise.all([faqParams(t, locale), getSettings(["timers.copy_claim_days", "timers.repick_window_days"])]);
  return { ...params, claimDays: s["timers.copy_claim_days"], repick: s["timers.repick_window_days"], phone: SUPPORT_PHONE };
}

const fillBlock = (b: LegalBlock, p: Record<string, string | number>): LegalBlock => (typeof b === "string" ? fillLegal(b, p) : { list: b.list.map((x) => fillLegal(x, p)) });

/** One legal page in the reader's language, with its numbers filled in. */
export function legalDoc(slug: LegalSlug, locale: Locale, params: Record<string, string | number>): LegalDoc {
  const doc = (locale === "bn" ? LEGAL_BN : LEGAL_EN)[slug];
  return {
    title: doc.title,
    description: doc.description,
    summary: doc.summary.map((x) => fillLegal(x, params)),
    sections: doc.sections.map((sec) => ({ ...sec, blocks: sec.blocks.map((b) => fillBlock(b, params)) })),
  };
}

export function agreementText(locale: Locale): AgreementText {
  return locale === "bn" ? AGREEMENT_BN : AGREEMENT_EN;
}
