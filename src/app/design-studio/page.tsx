import type { Metadata } from "next";
import "@/components/studio/studio.css";
import { StudioBoard } from "@/components/studio/studio-board";
import { StudioFilters } from "@/components/studio/studio-filters";
import { StudioHero } from "@/components/studio/studio-hero";
import { PageShell } from "@/components/ui/panel";
import { visibleBusinessTypes } from "@/lib/content/lists";
import { getI18n } from "@/lib/i18n/server";
import { parseStudioQuery, studioHref } from "@/lib/studio/options";
import { getStudioDesign, listStudio, studioHero, studioStats } from "@/lib/studio/queries";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("studio.metaTitle"), description: t("studio.metaDescription") };
}

/**
 * P-13 Design Studio (owner 2026-10-08; redesign 2026-10-12, Design/design-studio): every public design, newest first,
 * open to everyone. Hero with real stats, moving columns and the last real events; tabs, search, business type and
 * sort in the URL; cards with a hover preview (swipe on touch) and a full preview that lives in the URL (?design=).
 * Private and NDA contests stay out, blind contests only show their public winner (lib/studio/queries.ts).
 */
export default async function DesignStudioPage({ searchParams }: PageProps<"/design-studio">) {
  const sp = await searchParams;
  const query = parseStudioQuery(sp);
  const designParam = typeof sp.design === "string" ? sp.design : null;
  const [{ t }, page, stats, hero, types, linked] = await Promise.all([
    getI18n(),
    listStudio(query),
    studioStats(),
    studioHero(),
    visibleBusinessTypes(query.type),
    designParam ? getStudioDesign(designParam) : Promise.resolve(null),
  ]);

  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-[1384px] flex-col gap-5">
        <StudioHero stats={stats} hero={hero} />
        <section className="flex flex-col gap-4" aria-label={t("studio.tabs.label")}>
          <StudioFilters query={query} counts={{ all: stats.designs, winners: stats.winners, new: stats.today }} types={types} />
          <StudioBoard
            key={studioHref(query)}
            initial={page.designs}
            total={page.total}
            nextOffset={page.nextOffset}
            query={query}
            linked={linked}
            nowIso={new Date().toISOString()}
          />
        </section>
      </div>
    </PageShell>
  );
}
