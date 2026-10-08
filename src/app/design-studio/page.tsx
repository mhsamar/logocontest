import type { Metadata } from "next";
import Link from "next/link";
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
    { label: t("studio.stats.designs"), value: stats.designs, tint: "bg-white/80 ring-white" },
    { label: t("studio.stats.today"), value: stats.today, tint: "bg-gradient-to-br from-[#fff0f3] to-[#ffdce4] ring-white", live: true },
    { label: t("studio.stats.winners"), value: stats.winners, tint: "bg-gradient-to-br from-[#fff9e8] to-[#ffe9b8] ring-[#f1c75c]/60", gold: true },
  ];

  return (
    <div className="mx-auto w-full max-w-page px-4 pb-16 pt-4">
      <section className="relative animate-rise overflow-clip rounded-[2rem] bg-aurora p-5 shadow-frame ring-1 ring-white sm:p-8">
        <span className="pointer-events-none absolute -right-10 -top-12 size-48 animate-float-soft rounded-full bg-[#ffe2a0]/50 blur-2xl" aria-hidden />
        <span className="pointer-events-none absolute -bottom-16 left-1/4 size-56 animate-float rounded-full bg-[#ebc9ff]/40 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-primary ring-1 ring-white">
              <span className="relative flex size-2" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              {t("studio.live")}
            </span>
            <h1 className="mt-3 text-h1 font-bold tracking-tight text-ink lg:text-4xl">{t("studio.title")}</h1>
            <p className="mt-2 text-muted">{t("studio.lead")}</p>
          </div>
          <dl className="grid grid-cols-3 gap-2 sm:gap-3">
            {tiles.map((s, i) => (
              <div key={s.label} className={cx("flex min-w-0 animate-rise flex-col-reverse rounded-2xl px-3 py-2.5 ring-1 backdrop-blur sm:min-w-32 sm:px-4 sm:py-3", s.tint)} style={{ animationDelay: `${150 + i * 80}ms` }}>
                <dt className="truncate text-xs text-muted">{s.label}</dt>
                <dd className={cx("text-xl font-bold tabular-nums text-ink sm:text-2xl", s.gold && "prize-text")}>
                  <CountUp value={s.value} locale={locale} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <nav aria-label={t("studio.filters.label")} className="-mx-4 mt-8 overflow-x-auto px-4 [scrollbar-width:none]">
        <GlideTrack className="w-max">
          <ul className="flex w-max gap-1 rounded-full bg-surface p-1 ring-1 ring-line">
            {STUDIO_FILTERS.map((f) => (
              <li key={f}>
                <Link
                  href={f === "all" ? "/design-studio" : `/design-studio?filter=${f}`}
                  scroll={false}
                  aria-current={f === filter ? "page" : undefined}
                  className={cx("relative flex min-h-10 items-center rounded-full px-4 text-sm font-semibold transition-colors", f === filter ? "bg-ink text-white" : "text-muted hover:text-ink")}
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
  );
}
