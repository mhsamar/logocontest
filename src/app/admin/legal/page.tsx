import type { Metadata } from "next";
import Link from "next/link";
import { LegalEditor } from "@/components/admin/legal-editor";
import { AdminHead } from "@/components/admin/page-head";
import { noticeId } from "@/lib/content/notice-rules";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/dates";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { builtInAgreement, builtInDoc } from "@/lib/legal";
import { agreementToText, docToText } from "@/lib/legal/format";
import { LEGAL_PLACEHOLDERS } from "@/lib/legal/placeholders";
import { isLegalDocSlug, LEGAL_DOC_SLUGS, publishedDoc, type LegalDocSlug } from "@/lib/legal/store";
import { LEGAL_VERSION } from "@/lib/legal/types";
import { requirePermission } from "@/lib/admin/core";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.legal.title"), robots: { index: false } };
}

const chip = (active: boolean) =>
  cx("inline-flex min-h-9 items-center whitespace-nowrap rounded-full px-3.5 text-sm font-medium ring-1", active ? "bg-ink text-white ring-ink" : "bg-surface text-ink ring-line hover:ring-primary");

// A-16 Legal pages (BLUEPRINT §13.1 item 3): the four pages and the designer agreement, en + bn.
export default async function AdminLegalPage({ searchParams }: PageProps<"/admin/legal">) {
  await requirePermission("content.view");
  const sp = await searchParams;
  const slug: LegalDocSlug = typeof sp.doc === "string" && isLegalDocSlug(sp.doc) ? sp.doc : "terms";
  const lang: Locale = typeof sp.lang === "string" && isLocale(sp.lang) ? sp.lang : "en";
  const [{ t, locale }, published] = await Promise.all([getI18n(), publishedDoc(slug, lang)]);
  const builtIn = slug === "agreement" ? agreementToText(builtInAgreement(lang)) : docToText(builtInDoc(slug, lang));
  const text = published?.body ?? builtIn;

  return (
    <div className="space-y-4">
      <AdminHead title={t("admin.legal.title")} lead={t("admin.legal.lead")} />
      <nav aria-label={t("admin.legal.title")} className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-1.5 pb-1">
          {LEGAL_DOC_SLUGS.map((d) => (
            <li key={d} className="shrink-0">
              <Link href={`/admin/legal?doc=${d}&lang=${lang}`} aria-current={d === slug ? "page" : undefined} className={chip(d === slug)}>
                {t(`admin.legal.docs.${d}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex flex-wrap items-center gap-2">
        {LOCALES.map((l) => (
          <Link key={l} href={`/admin/legal?doc=${slug}&lang=${l}`} aria-current={l === lang ? "page" : undefined} className={chip(l === lang)}>
            {t(l === "en" ? "admin.texts.english" : "admin.texts.bangla")}
          </Link>
        ))}
        <p className="text-sm text-muted">
          {t(published ? "admin.legal.published" : "admin.legal.builtIn", { date: formatDate(new Date(published?.version ?? LEGAL_VERSION), locale, "long") })}
        </p>
      </div>
      {/* Remounts after a publish so the editor starts from the stored text. */}
      <LegalEditor key={`${slug}-${lang}-${noticeId(text)}`} slug={slug} locale={lang} initial={text} edited={!!published} placeholders={LEGAL_PLACEHOLDERS} />
    </div>
  );
}
