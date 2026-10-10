import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LEGAL_NAV } from "@/components/layout/nav-items";
import { PageShell, Panel } from "@/components/ui/panel";
import { Arrow, PageTitle } from "@/components/ui/section-heading";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { legalDoc, legalParams } from "@/lib/legal";
import { isLegalSlug } from "@/lib/legal/types";

export async function generateMetadata({ params }: PageProps<"/legal/[page]">): Promise<Metadata> {
  const { page } = await params;
  if (!isLegalSlug(page)) return {};
  const { t, locale } = await getI18n();
  const doc = await legalDoc(page, locale, await legalParams(t, locale));
  return { title: doc.title, description: doc.description, alternates: { canonical: `/legal/${page}` } };
}

// P-10 legal pages (UI-JOURNEY, owner 2026-10-09): Terms, Privacy, Payment & No-Refund Policy, Designer Rules.
export default async function LegalPage({ params }: PageProps<"/legal/[page]">) {
  const { page } = await params;
  if (!isLegalSlug(page)) notFound();
  const { t, locale } = await getI18n();
  const doc = await legalDoc(page, locale, await legalParams(t, locale));
  const num = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US");

  const contents = (
    <ol className="m-0 list-none space-y-0.5 p-0 text-[15px]">
      {doc.sections.map((s, i) => (
        <li key={s.id}>
          <a href={`#${s.id}`} className="flex min-h-10 items-center gap-2.5 rounded-xl px-2.5 font-medium text-muted transition-colors hover:bg-chip hover:text-ink">
            <span className="w-5 shrink-0 text-xs font-bold tabular-nums text-primary">{num.format(i + 1)}</span>
            {s.heading}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <PageShell>
      <Panel as="header">
        <PageTitle center pill={t("footer.legal")} lead={doc.title} sub={t("legal.lastUpdated", { date: formatDate(new Date(doc.version), locale, "long") })} />
      </Panel>

      <Panel tone="grey" className="lg:grid lg:grid-cols-[16rem_minmax(0,52rem)] lg:justify-center lg:gap-8">
        <aside className="hidden lg:block">
          <nav aria-label={t("legal.contents")} className="lc-card sticky top-32 p-3">
            <p className="m-0 px-2.5 pb-1 pt-1.5 text-xs font-bold uppercase tracking-[0.14em] text-muted">{t("legal.contents")}</p>
            {contents}
          </nav>
        </aside>

        <article className="lc-card w-full p-6 sm:p-10">
          <section aria-labelledby="in-short" className="rounded-[20px] bg-tint p-5 sm:p-6">
            <h2 id="in-short" className="m-0 flex items-center gap-2 text-lg font-semibold text-ink">
              <svg viewBox="0 0 24 24" className="size-5 text-primary" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
                <path d="M9 12l2 2 4-4M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t("legal.inShort")}
            </h2>
            <ul className="m-0 mt-3 list-none space-y-2 p-0">
              {doc.summary.map((line) => (
                <li key={line} className="flex gap-2.5 text-[15px] leading-relaxed text-ink">
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </section>

          <details className="mt-4 rounded-[18px] border border-line bg-chip lg:hidden">
            <summary className="flex min-h-12 cursor-pointer items-center px-4 font-bold text-ink">{t("legal.contents")}</summary>
            <div className="px-2 pb-3">{contents}</div>
          </details>

          <div className="mt-8 space-y-9">
            {doc.sections.map((s, i) => (
              <section key={s.id} id={s.id} className="lc-rv-soft scroll-mt-32">
                <h2 className="m-0 flex items-baseline gap-3 text-[22px] font-semibold tracking-[-0.02em] text-ink">
                  <span className="text-base font-bold tabular-nums text-primary">{num.format(i + 1)}.</span>
                  {s.heading}
                </h2>
                <div className="mt-3 space-y-3 leading-relaxed text-ink/90">
                  {s.blocks.map((b, j) =>
                    typeof b === "string" ? (
                      <p key={j}>{b}</p>
                    ) : (
                      <ul key={j} className="space-y-2">
                        {b.list.map((item) => (
                          <li key={item} className="flex gap-2.5">
                            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-ink/40" aria-hidden />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ),
                  )}
                </div>
              </section>
            ))}
          </div>

          <nav aria-label={t("legal.other")} className="mt-12 border-t border-line pt-6">
            <p className="m-0 text-sm font-bold text-ink">{t("legal.other")}</p>
            <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0">
              {LEGAL_NAV.filter((x) => x.href !== `/legal/${page}`).map((x) => (
                <li key={x.href}>
                  <Link
                    href={x.href}
                    className="inline-flex min-h-11 items-center rounded-full border border-line bg-chip px-4 text-sm font-bold text-ink transition-colors hover:border-primary hover:text-primary"
                  >
                    {t(x.label)}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/help" className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-bold text-primary hover:underline">
                  {t("nav.help")} <Arrow />
                </Link>
              </li>
            </ul>
          </nav>
        </article>
      </Panel>
    </PageShell>
  );
}
