import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { PageShell, Panel } from "@/components/ui/panel";
import { PageTitle } from "@/components/ui/section-heading";
import { formatDate } from "@/lib/dates";
import type { Locale } from "@/lib/i18n/config";
import { getI18n, pageAlternates } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import type { LandingContent, LandingCopy, LandingSection } from "@/lib/landing/types";
import { formatTaka } from "@/lib/money";
import { openGraphFor } from "@/lib/seo";
import { fillFacts, siteFacts, type SiteFacts } from "@/lib/seo/facts";
import { breadcrumbs, faqPage, ldJson, service } from "@/lib/seo/jsonld";

/**
 * A search landing page (owner, 2026-10-21; SEO-PLAN.md §2.8): the words come from a content module in English and
 * Bangla, every number from the live settings. Sections marked for the 3-design guarantee only show once it is live.
 */

type Filled = { copy: LandingCopy; facts: SiteFacts; locale: Locale };

async function filled(content: LandingContent): Promise<Filled> {
  const [{ locale }, facts] = await Promise.all([getI18n(), siteFacts()]);
  const year = new Date(`${content.updatedAt}T00:00:00Z`).getUTCFullYear();
  const raw = content[locale];
  const fill = (s: string) => fillFacts(s, facts, locale, year);
  const section = (s: LandingSection): LandingSection => {
    switch (s.kind) {
      case "text":
        return { ...s, heading: fill(s.heading), paragraphs: s.paragraphs.map(fill) };
      case "steps":
        return { ...s, heading: fill(s.heading), steps: s.steps.map((x) => ({ title: fill(x.title), body: fill(x.body) })) };
      case "prices":
        return { ...s, heading: fill(s.heading), note: fill(s.note) };
      case "compare":
        return { ...s, heading: fill(s.heading), columns: s.columns.map(fill), rows: s.rows.map((r) => ({ label: fill(r.label), cells: r.cells.map(fill) })), note: s.note ? fill(s.note) : undefined };
      case "list":
        return { ...s, heading: fill(s.heading), items: s.items.map(fill) };
      case "faq":
        return { ...s, heading: fill(s.heading), items: s.items.map((x) => ({ q: fill(x.q), a: fill(x.a) })) };
    }
  };
  const copy: LandingCopy = {
    title: fill(raw.title),
    description: fill(raw.description),
    h1: fill(raw.h1),
    answer: fill(raw.answer),
    breadcrumb: fill(raw.breadcrumb),
    sections: raw.sections.filter((s) => facts.guaranteeOn || !s.onlyWithGuarantee).map(section),
    cta: { heading: fill(raw.cta.heading), body: fill(raw.cta.body), button: fill(raw.cta.button) },
  };
  return { copy, facts, locale };
}

export async function landingMetadata(content: LandingContent): Promise<Metadata> {
  const { copy, locale } = await filled(content);
  const path = `/${content.slug}`;
  return {
    title: { absolute: copy.title },
    description: copy.description,
    alternates: await pageAlternates(path),
    openGraph: openGraphFor({ title: copy.title, description: copy.description, path, locale }),
  };
}

const card = "lc-card w-full p-6 sm:p-8";
const h2 = "m-0 text-[clamp(22px,2.6vw,30px)] font-semibold leading-tight tracking-[-0.03em] text-ink";

function Section({ s, facts, locale, t }: { s: LandingSection; facts: SiteFacts; locale: Locale; t: (k: MessageKey) => string }) {
  const taka = (n: number) => formatTaka(n, locale);
  switch (s.kind) {
    case "text":
      return (
        <section className={card}>
          <h2 className={h2}>{s.heading}</h2>
          {s.paragraphs.map((p, i) => (
            <p key={i} className="mb-0 mt-3 text-[17px] leading-relaxed text-ink/85">
              {p}
            </p>
          ))}
        </section>
      );
    case "steps":
      return (
        <section className={card}>
          <h2 className={h2}>{s.heading}</h2>
          <ol className="m-0 mt-5 grid list-none gap-3 p-0 sm:grid-cols-2">
            {s.steps.map((x, i) => (
              <li key={i} className="flex gap-3 rounded-[18px] bg-tint p-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">{new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(i + 1)}</span>
                <span>
                  <strong className="block text-[16px] text-ink">{x.title}</strong>
                  <span className="text-[15px] leading-relaxed text-muted">{x.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      );
    case "prices":
      return (
        <section className={card}>
          <h2 className={h2}>{s.heading}</h2>
          <div className="mt-5">
            {/* Fits a phone without scrolling: "You pay" must always be visible. */}
            <table className="w-full border-collapse text-left text-[14.5px] sm:text-[16px]">
              <thead>
                <tr className="text-[13px] text-muted sm:text-[14px]">
                  <th className="border-b border-line py-2.5 pr-2 font-semibold sm:pr-3">{s.columns.package}</th>
                  <th className="border-b border-line px-1.5 py-2.5 font-semibold sm:px-3">{s.columns.prize}</th>
                  <th className="border-b border-line px-1.5 py-2.5 font-semibold sm:px-3">{s.columns.fee}</th>
                  <th className="border-b border-line py-2.5 pl-2 text-right font-semibold sm:pl-3 sm:text-left">{s.columns.total}</th>
                </tr>
              </thead>
              <tbody>
                {facts.packages.map((p) => (
                  <tr key={p.key}>
                    <td className="border-b border-line py-3 pr-2 font-semibold text-ink sm:pr-3">{t(`wizard.packages.${p.key}.name` as MessageKey)}</td>
                    <td className="border-b border-line px-1.5 py-3 tabular-nums sm:px-3">{taka(p.prize)}</td>
                    <td className="border-b border-line px-1.5 py-3 tabular-nums sm:px-3">{taka(p.total - p.prize)}</td>
                    <td className="border-b border-line py-3 pl-2 text-right font-bold tabular-nums text-primary sm:pl-3 sm:text-left">{taka(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mb-0 mt-4 text-[15px] leading-relaxed text-muted">{s.note}</p>
        </section>
      );
    case "compare":
      return (
        <section className={card}>
          <h2 className={h2}>{s.heading}</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-[15px]">
              <thead>
                <tr>
                  {s.columns.map((c, i) => (
                    <th key={i} className={`border-b border-line px-3 py-2.5 align-bottom font-semibold ${i === 1 && s.ours !== "row" ? "text-primary" : "text-ink"}`}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.rows.map((r, i) => (
                  <tr key={i} className={s.ours === "row" && i === 0 ? "bg-tint" : undefined}>
                    <th scope="row" className={`border-b border-line px-3 py-3 align-top font-semibold ${s.ours === "row" && i === 0 ? "text-primary" : "text-ink"}`}>
                      {r.label}
                    </th>
                    {r.cells.map((c, j) => (
                      <td key={j} className={`border-b border-line px-3 py-3 align-top ${s.ours !== "row" && j === 0 ? "bg-tint font-medium text-ink" : s.ours === "row" && i === 0 ? "font-medium text-ink" : "text-ink/80"}`}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {s.note && <p className="mb-0 mt-4 text-[14px] leading-relaxed text-muted">{s.note}</p>}
        </section>
      );
    case "list":
      return (
        <section className={card}>
          <h2 className={h2}>{s.heading}</h2>
          <ul className="m-0 mt-4 grid list-none gap-2.5 p-0 sm:grid-cols-2">
            {s.items.map((x, i) => (
              <li key={i} className="flex gap-2.5 text-[16px] leading-relaxed text-ink/85">
                <svg viewBox="0 0 24 24" className="mt-1 size-4 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                {x}
              </li>
            ))}
          </ul>
        </section>
      );
    case "faq":
      return (
        <section className={card}>
          <h2 className={h2}>{s.heading}</h2>
          <div className="mt-4 divide-y divide-line">
            {s.items.map((x, i) => (
              <details key={i} className="group py-3.5" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-semibold text-ink">
                  {x.q}
                  <span aria-hidden className="text-primary transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mb-0 mt-2.5 text-[16px] leading-relaxed text-ink/80">{x.a}</p>
              </details>
            ))}
          </div>
        </section>
      );
  }
}

/** Other landing pages and guides to link to from each one. */
const RELATED = [
  { slug: "logo-design-price", key: "landing.related.price" },
  { slug: "logo-design", key: "landing.related.service" },
  { slug: "how-it-works", key: "landing.related.how" },
  { slug: "winners", key: "landing.related.winners" },
  { slug: "about", key: "landing.related.about" },
] as const;

export async function LandingPage({ content, offers }: { content: LandingContent; offers?: boolean }) {
  const [{ copy, facts, locale }, { t }] = await Promise.all([filled(content), getI18n()]);
  const path = `/${content.slug}`;
  const faqs = copy.sections.flatMap((s) => (s.kind === "faq" ? s.items : []));
  const ld = [
    breadcrumbs([{ name: t("landing.home"), path: "/" }, { name: copy.breadcrumb, path }], locale),
    ...(offers ? [service({ name: copy.h1, description: copy.description, path, locale, offers: facts.packages.map((p) => ({ name: t(`wizard.packages.${p.key}.name` as MessageKey), total: p.total })) })] : []),
    ...(faqs.length ? [faqPage(faqs, locale)] : []),
  ];
  return (
    <PageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(ld) }} />
      <Panel as="header">
        <nav aria-label={t("landing.breadcrumb")} className="mb-5 flex flex-wrap items-center justify-center gap-1.5 text-[14px] text-muted">
          <Link href="/" className="hover:text-ink">
            {t("landing.home")}
          </Link>
          <span aria-hidden>›</span>
          <span aria-current="page" className="text-ink">
            {copy.breadcrumb}
          </span>
        </nav>
        <PageTitle center lead={copy.h1} sub={copy.answer} />
        <p className="mb-0 mt-4 text-center text-[14px] text-muted">{t("landing.updated", { date: formatDate(new Date(`${content.updatedAt}T12:00:00Z`), locale, "long") })}</p>
      </Panel>
      <Panel tone="grey" className="flex flex-col items-center gap-3.5">
        <div className="flex w-full max-w-[880px] flex-col gap-3.5">
          {copy.sections.map((s, i) => (
            <Section key={i} s={s} facts={facts} locale={locale} t={t} />
          ))}
          <section className="w-full rounded-[24px] bg-[linear-gradient(150deg,#A30F0F,#8B0000_55%,#5C0A0C)] p-6 text-white sm:p-8">
            <h2 className="m-0 text-[clamp(22px,2.6vw,30px)] font-semibold leading-tight tracking-[-0.03em]">{copy.cta.heading}</h2>
            <p className="mb-0 mt-2.5 max-w-2xl text-[17px] text-[#F6DAD8]">{copy.cta.body}</p>
            <ButtonLink href="/start" variant="secondary" className="mt-5">
              {copy.cta.button}
            </ButtonLink>
          </section>
          <nav aria-label={t("landing.related.label")} className="flex flex-wrap justify-center gap-2 pt-2">
            {RELATED.filter((r) => r.slug !== content.slug).map((r) => (
              <Link key={r.slug} href={`/${r.slug}`} className="inline-flex min-h-11 items-center rounded-full bg-white px-4 text-[15px] font-semibold text-ink hover:text-primary">
                {t(r.key)}
              </Link>
            ))}
          </nav>
        </div>
      </Panel>
    </PageShell>
  );
}
