/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { GuideBody } from "@/components/guides/guide-body";
import { GuideCard } from "@/components/guides/guide-card";
import { ButtonLink } from "@/components/ui/button";
import { PageShell, Panel } from "@/components/ui/panel";
import { Arrow } from "@/components/ui/section-heading";
import { pictureUrl } from "@/lib/content/pictures";
import { formatDate } from "@/lib/dates";
import type { GuideCard as Card, GuideRow } from "@/lib/guides/queries";
import { guideText, readingMinutes } from "@/lib/guides/rules";
import type { Translate } from "@/lib/i18n/translate";
import { siteUrl } from "@/lib/seo";

// One guide (owner, 2026-10-15): title, summary, cover, the text, a next step, and more guides.
export function GuideArticle({ g, all, t, locale }: { g: GuideRow; all: Card[]; t: Translate; locale: "en" | "bn" }) {
  const x = guideText(g, locale);
  const cover = pictureUrl(g.cover_path);
  const minutes = readingMinutes(x.body.text);
  const num = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US");
  // More guides: the same group first, then "for everyone", then the newest.
  const rank = (c: string) => (c === g.category ? 0 : c === "everyone" ? 1 : 2);
  const more = all
    .filter((o) => o.id !== g.id)
    .sort((a, b) => rank(a.category) - rank(b.category))
    .slice(0, 3);
  const base = siteUrl();
  const url = `${base}/guides/${g.slug}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: x.title.text.slice(0, 110),
      description: x.summary.text,
      inLanguage: x.lang === "bn" ? "bn-BD" : "en",
      mainEntityOfPage: url,
      ...(cover ? { image: [cover] } : {}),
      datePublished: g.published_at,
      dateModified: g.updated_at,
      author: { "@type": "Organization", name: "logocontest.bd", url: base },
      publisher: { "@type": "Organization", name: "logocontest.bd", url: base, logo: { "@type": "ImageObject", url: `${base}/brand/logo-icon-tile.png` } },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: t("brand.name"), item: base },
        { "@type": "ListItem", position: 2, name: t("guides.pill"), item: `${base}/guides` },
        { "@type": "ListItem", position: 3, name: x.title.text, item: url },
      ],
    },
  ];
  const showClient = g.category !== "designers";
  const showDesigner = g.category !== "clients";

  return (
    <PageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Panel as="header">
        <div className="mx-auto flex max-w-[52rem] flex-col items-start gap-4">
          <nav aria-label={t("guides.breadcrumb")} className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted">
            <Link href="/guides" className="hover:text-primary">
              {t("guides.pill")}
            </Link>
            <span aria-hidden>›</span>
            <Link href={g.category === "everyone" ? "/guides" : `/guides?for=${g.category}`} className="text-primary hover:underline">
              {t(`guides.categories.${g.category}`)}
            </Link>
          </nav>
          <h1 lang={x.title.lang} className="m-0 text-[clamp(30px,4.4vw,50px)] font-semibold leading-[1.06] tracking-[-0.04em]">
            {x.title.text}
          </h1>
          <p lang={x.summary.lang} className="m-0 max-w-2xl text-lg leading-relaxed text-muted">
            {x.summary.text}
          </p>
          <p className="m-0 text-sm text-muted">
            {t("guides.meta.line", { date: formatDate(new Date(g.updated_at), locale, "long"), minutes: num.format(minutes) })}
          </p>
        </div>
      </Panel>

      <Panel tone="grey">
        <article className="lc-card mx-auto w-full max-w-[52rem] overflow-hidden">
          {cover && <img src={cover} alt="" className="aspect-[16/9] w-full object-cover" />}
          <div className="p-6 sm:p-10">
            {locale === "bn" && x.lang === "en" && <p className="m-0 mb-6 rounded-[14px] bg-chip px-4 py-3 text-sm text-muted">{t("guides.englishOnly")}</p>}
            <GuideBody body={x.body.text} lang={x.body.lang} />

            {/* The next step for the reader */}
            <aside className="mt-10 flex flex-col gap-4 rounded-[24px] bg-tint p-6 sm:p-8">
              <p className="m-0 text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">{t(showClient && !showDesigner ? "guides.cta.clientTitle" : showDesigner && !showClient ? "guides.cta.designerTitle" : "guides.cta.title")}</p>
              <div className="flex flex-wrap gap-2.5">
                {showClient && (
                  <ButtonLink href="/start" size="lg">
                    {t("guides.cta.start")}
                  </ButtonLink>
                )}
                {showDesigner && (
                  <ButtonLink href={showClient ? "/contests" : "/designers/signup"} size="lg" variant={showClient ? "secondary" : "primary"}>
                    {t(showClient ? "guides.cta.browse" : "guides.cta.join")}
                  </ButtonLink>
                )}
                <ButtonLink href="/logo-checker" size="lg" variant="secondary">
                  {t("guides.cta.checker")}
                </ButtonLink>
              </div>
            </aside>
          </div>
        </article>

        {more.length > 0 && (
          <section aria-labelledby="more-guides" className="mx-auto mt-10 max-w-[1160px]">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <h2 id="more-guides" className="m-0 text-[26px] font-semibold tracking-[-0.03em]">
                {t("guides.more")}
              </h2>
              <Link href="/guides" className="inline-flex min-h-11 items-center gap-1.5 font-bold text-primary hover:underline">
                {t("guides.all")} <Arrow />
              </Link>
            </div>
            <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {more.map((o) => (
                <GuideCard key={o.id} g={o} locale={locale} t={t} />
              ))}
            </ul>
          </section>
        )}
      </Panel>
    </PageShell>
  );
}
