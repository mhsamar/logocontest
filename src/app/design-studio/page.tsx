import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, Panel } from "@/components/ui/panel";
import { PageTitle } from "@/components/ui/section-heading";
import { StudioGrid } from "@/components/studio/studio-grid";
import { CountUp } from "@/components/ui/count-up";
import { GlideTrack } from "@/components/ui/glide-track";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import { parseStudioFilter, STUDIO_FILTERS } from "@/lib/studio/options";
import { listStudio, studioStats } from "@/lib/studio/queries";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("studio.metaTitle"), description: t("studio.metaDescription") };
}

// P-13 Design Studio (owner, 2026-10-08): every public design, newest first, open to everyone.
export default async function DesignStudioPage({ searchParams }: PageProps<"/design-studio">) {
  const sp = await searchParams;
  const filter = parseStudioFilter(sp.filter);
  const [{ t, locale }, page, stats] = await Promise.all([getI18n(), listStudio({ filter }), studioStats()]);
  const now = new Date();
  const newSince = new Date(now.getTime() - 86_400_000).toISOString();

  const tiles = [
    { label: t("studio.stats.designs"), value: stats.designs, tone: "bg-frame" },
    { label: t("studio.stats.today"), value: stats.today, tone: "bg-tint" },
    { label: t("studio.stats.winners"), value: stats.winners, tone: "bg-[#fff7e0]" },
  ];

  return (
    <PageShell>
      <Panel as="header">
        <div className="mx-auto flex max-w-[1160px] flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-tint px-3.5 py-1.5 text-sm font-bold text-primary">
              <span className="relative flex size-2" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60 motion-reduce:hidden" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              {t("studio.live")}
            </span>
            <PageTitle className="mt-4" lead={t("studio.title")} sub={t("studio.lead")} />
          </div>
          <dl className="m-0 grid grid-cols-3 gap-2.5">
            {tiles.map((x) => (
              <div key={x.label} className={cx("flex min-w-0 flex-col-reverse rounded-[20px] px-4 py-3.5 sm:min-w-32", x.tone)}>
                <dt className="truncate text-sm text-muted">{x.label}</dt>
                <dd className="lc-d m-0 text-2xl font-semibold tabular-nums tracking-[-0.03em] text-ink sm:text-3xl">
                  <CountUp value={x.value} locale={locale} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Panel>

      <Panel tone="grey">
      <div className="mx-auto max-w-[1160px]">
      <nav aria-label={t("studio.filters.label")} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
        <GlideTrack className="w-max">
          <ul className="m-0 flex w-max list-none gap-1 rounded-[18px] bg-surface p-1 ring-1 ring-line">
            {STUDIO_FILTERS.map((f) => (
              <li key={f}>
                <Link
                  href={f === "all" ? "/design-studio" : `/design-studio?filter=${f}`}
                  scroll={false}
                  aria-current={f === filter ? "page" : undefined}
                  className={cx("relative flex min-h-11 items-center rounded-[14px] px-4 text-[15px] font-semibold transition-colors", f === filter ? "bg-ink text-white" : "text-muted hover:text-ink")}
                >
                  {t(`studio.filters.${f}`)}
                </Link>
              </li>
            ))}
          </ul>
        </GlideTrack>
      </nav>

      <StudioGrid key={filter} initial={page.designs} nextCursor={page.nextCursor} filter={filter} newSince={newSince} />
      </div>
      </Panel>
    </PageShell>
  );
}
