import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareButtons } from "@/components/share/share-buttons";
import { ButtonLink } from "@/components/ui/button";
import { PageShell } from "@/components/ui/panel";
import { StatusChip } from "@/components/ui/status-chip";
import { TrophyIcon } from "@/components/ui/trophy";
import { siteOrigin } from "@/lib/email";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber, formatTaka } from "@/lib/money";
import { openGraphFor } from "@/lib/seo";
import { sharedDesign, type SharedDesign } from "@/lib/share/design";
import { designPath, designPinPath } from "@/lib/share/links";

const LABEL = "m-0 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted";

const byName = ({ entry }: SharedDesign) => (entry.designer ? (entry.designer.username ? `@${entry.designer.username}` : entry.designer.name) : null);

export async function generateMetadata({ params }: PageProps<"/contest/[slug]/design/[number]">): Promise<Metadata> {
  const { slug, number } = await params;
  const [{ t, locale }, shared] = await Promise.all([getI18n(), sharedDesign(slug, Number(number))]);
  if (!shared) return { title: t("notFound.title"), robots: { index: false } };
  const n = formatNumber(shared.entry.number, locale);
  const brand = shared.contest.brandName;
  const name = byName(shared);
  const title = t("share.page.metaTitle", { n, brand });
  const description = name ? t("share.page.description", { n, brand, name }) : t("share.page.descriptionNoName", { n, brand });
  const path = designPath(shared.contest.slug, shared.entry.number);
  // The picture comes from this page's opengraph-image (the design itself).
  return { title, description, openGraph: openGraphFor({ title, description, path, locale }), alternates: { canonical: path } };
}

/**
 * One design's public page (owner, 2026-10-18): what Facebook and Pinterest open when a design is shared, with the
 * design as its preview picture. Everyone sees the visitor's view; designs a visitor can't see are "not found".
 */
export default async function SharedDesignPage({ params }: PageProps<"/contest/[slug]/design/[number]">) {
  const { slug, number } = await params;
  const [{ t, locale }, shared, origin] = await Promise.all([getI18n(), sharedDesign(slug, Number(number)), siteOrigin()]);
  if (!shared) notFound();
  const { contest, entry } = shared;
  const fmt = (n: number) => formatNumber(n, locale);
  const winner = entry.status === "winner";
  const name = byName(shared);
  const url = `${origin}${designPath(contest.slug, entry.number)}`;
  const text = t(winner ? "share.winnerText" : "share.designText", { n: fmt(entry.number), brand: contest.brandName });
  const statusKnown = contest.rawStatus === contest.status;
  const facts: [string, React.ReactNode][] = [
    [t("share.page.status"), <StatusChip key="s" status={statusKnown ? contest.status : (contest.rawStatus as "draft")} label={t(`status.${contest.rawStatus as "draft"}`)} />],
    [t("share.page.prize"), formatTaka(contest.prize, locale)],
    [t("share.page.designs"), fmt(contest.entries)],
  ];

  return (
    <PageShell>
      <section className="grid gap-6 rounded-[32px] bg-surface p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10 lg:p-8 max-[720px]:rounded-[24px]" data-shared-design={entry.number}>
        {/* The design: its cover big, the other pictures under it */}
        <div className="flex min-w-0 flex-col gap-2.5">
          <figure className="m-0 overflow-hidden rounded-[24px] bg-[#F4F5F7] ring-1 ring-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={entry.previews[0]} alt={t("share.page.picture", { n: fmt(1), d: fmt(entry.number) })} className="block aspect-square w-full object-contain" />
          </figure>
          {entry.previews.length > 1 && (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {entry.previews.slice(1).map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src} alt={t("share.page.picture", { n: fmt(i + 2), d: fmt(entry.number) })} loading="lazy" className="block aspect-square w-full rounded-[14px] bg-[#F4F5F7] object-cover ring-1 ring-line" />
              ))}
            </div>
          )}
        </div>

        {/* Its facts, the contest and sharing */}
        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {winner && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF4D6] px-3 py-1 text-xs font-bold text-[#8A5A00]">
                  <TrophyIcon className="size-4" />
                  {t("share.page.winner")}
                </span>
              )}
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{t("share.page.kicker", { n: fmt(entry.number) })}</span>
            </div>
            <h1 className="m-0 mt-2 break-words text-[clamp(28px,3.6vw,44px)] font-semibold leading-[1.05] tracking-[-0.04em] text-ink">{contest.brandName}</h1>
            {name && <p className="m-0 mt-2 text-[15px] text-muted">{t("share.page.by", { name })}</p>}
          </div>

          <div>
            <p className={LABEL}>{t("share.page.contest")}</p>
            <dl className="m-0 mt-2 divide-y divide-line rounded-[16px] bg-surface px-4 text-sm ring-1 ring-line">
              {facts.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-muted">{k}</dt>
                  <dd className="m-0 font-semibold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <ButtonLink href={`/contest/${contest.slug}?tab=entries&entry=${entry.number}`} size="lg" block>
            {t("share.page.seeContest")}
          </ButtonLink>

          <div>
            <p className={LABEL}>{t("share.design")}</p>
            <ShareButtons url={url} media={`${origin}${designPinPath(contest.slug, entry.number)}`} text={text} className="mt-2" />
          </div>

          <div className="mt-auto rounded-[20px] bg-tint p-5">
            <p className="m-0 text-[17px] font-semibold text-ink">{t("share.page.startTitle")}</p>
            <p className="m-0 mt-1.5 text-sm text-muted">{t("share.page.startLead")}</p>
            <ButtonLink href="/start" variant="outline" className="mt-3.5">
              {t("share.page.startButton")}
            </ButtonLink>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
