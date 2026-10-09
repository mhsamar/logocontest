import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LEGAL_NAV } from "@/components/layout/nav-items";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { legalDoc, legalParams } from "@/lib/legal";
import { isLegalSlug, LEGAL_VERSION } from "@/lib/legal/types";

export async function generateMetadata({ params }: PageProps<"/legal/[page]">): Promise<Metadata> {
  const { page } = await params;
  if (!isLegalSlug(page)) return {};
  const { t, locale } = await getI18n();
  const doc = legalDoc(page, locale, await legalParams(t, locale));
  return { title: doc.title, description: doc.description, alternates: { canonical: `/legal/${page}` } };
}

// P-10 legal pages (UI-JOURNEY, owner 2026-10-09): Terms, Privacy, Payment & No-Refund Policy, Designer Rules.
export default async function LegalPage({ params }: PageProps<"/legal/[page]">) {
  const { page } = await params;
  if (!isLegalSlug(page)) notFound();
  const { t, locale } = await getI18n();
  const doc = legalDoc(page, locale, await legalParams(t, locale));
  const num = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US");

  const contents = (
    <ol className="space-y-0.5 text-sm">
      {doc.sections.map((s, i) => (
        <li key={s.id}>
          <a href={`#${s.id}`} className="flex min-h-9 items-center gap-2 rounded-lg px-2 text-muted transition-colors hover:bg-surface hover:text-ink">
            <span className="w-5 shrink-0 text-xs font-semibold tabular-nums text-primary">{num.format(i + 1)}</span>
            {s.heading}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="mx-auto w-full max-w-page px-4 pb-16 pt-6 sm:pt-10">
      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
        <aside className="hidden lg:block">
          <nav aria-label={t("legal.contents")} className="sticky top-28">
            <p className="px-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t("legal.contents")}</p>
            <div className="mt-2">{contents}</div>
          </nav>
        </aside>

        <article className="mx-auto w-full max-w-2xl lg:mx-0">
          <header className="animate-rise">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">{t("footer.legal")}</p>
            <h1 className="mt-2 text-h1 font-bold tracking-tight text-ink lg:text-h1-lg">{doc.title}</h1>
            <p className="mt-2 text-sm text-muted">{t("legal.lastUpdated", { date: formatDate(new Date(LEGAL_VERSION), locale, "long") })}</p>
          </header>

          <section aria-labelledby="in-short" className="mt-6 animate-rise rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line" style={{ animationDelay: "80ms" }}>
            <h2 id="in-short" className="flex items-center gap-2 font-semibold text-ink">
              <svg viewBox="0 0 24 24" className="size-5 text-primary" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
                <path d="M9 12l2 2 4-4M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t("legal.inShort")}
            </h2>
            <ul className="mt-3 space-y-2">
              {doc.summary.map((line) => (
                <li key={line} className="flex gap-2 text-sm leading-relaxed text-ink">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </section>

          <details className="mt-4 rounded-2xl bg-surface ring-1 ring-line lg:hidden">
            <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold text-ink">{t("legal.contents")}</summary>
            <div className="px-2 pb-3">{contents}</div>
          </details>

          <div className="mt-8 space-y-9">
            {doc.sections.map((s, i) => (
              <section key={s.id} id={s.id} className="reveal scroll-mt-28">
                <h2 className="flex items-baseline gap-3 text-xl font-bold text-ink">
                  <span className="text-base font-semibold tabular-nums text-primary">{num.format(i + 1)}.</span>
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
            <p className="text-sm font-semibold text-ink">{t("legal.other")}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {LEGAL_NAV.filter((x) => x.href !== `/legal/${page}`).map((x) => (
                <li key={x.href}>
                  <Link
                    href={x.href}
                    className={cx(
                      "inline-flex min-h-11 items-center rounded-full bg-surface px-4 text-sm font-semibold text-ink ring-1 ring-line transition-colors hover:text-primary hover:ring-primary",
                    )}
                  >
                    {t(x.label)}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/help" className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-primary hover:underline">
                  {t("nav.help")} →
                </Link>
              </li>
            </ul>
          </nav>
        </article>
      </div>
    </div>
  );
}
