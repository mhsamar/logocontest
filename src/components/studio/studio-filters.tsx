"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BusinessType } from "@/lib/contests/brief";
import { useI18n } from "@/lib/i18n/client";
import { formatNumber } from "@/lib/money";
import { STUDIO_SORTS, STUDIO_TABS, studioHref, type StudioQuery, type StudioSort } from "@/lib/studio/options";
import { TrophyIcon } from "./studio-bits";

/**
 * Design Studio filters (owner, 2026-10-12; Design/design-studio): tabs with real counts, search, business type and
 * sort, all in the URL. Without JavaScript the search form still works.
 */
export function StudioFilters({ query, counts, types }: { query: StudioQuery; counts: Record<StudioQuery["tab"], number>; types: BusinessType[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const go = (change: Partial<StudioQuery>) => router.push(studioHref(query, change), { scroll: false });

  return (
    <div className="flex flex-wrap items-center gap-2.5 max-[640px]:flex-col max-[640px]:items-stretch">
      <nav aria-label={t("studio.tabs.label")} className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-[#E9EAEE] bg-white p-1 [scrollbar-width:none]">
        {STUDIO_TABS.map((tab) => (
          <Link key={tab} href={studioHref(query, { tab })} scroll={false} aria-current={tab === query.tab ? "page" : undefined} className="ds-tbx">
            {tab === "winners" && <TrophyIcon className="size-4" />}
            {t(`studio.tabs.${tab}`)}
            <span>{formatNumber(counts[tab], locale)}</span>
          </Link>
        ))}
      </nav>
      <form action="/design-studio" role="search" className="ml-auto flex h-[46px] min-w-0 max-w-[280px] flex-[1_1_160px] items-center gap-2.5 rounded-xl border border-[#DCDEE3] bg-white px-3.5 text-[#5F626B] focus-within:border-primary max-[640px]:ml-0 max-[640px]:max-w-none max-[640px]:flex-none">
        {query.tab !== "all" && <input type="hidden" name="tab" value={query.tab} />}
        {query.type && <input type="hidden" name="type" value={query.type} />}
        {query.sort !== "newest" && <input type="hidden" name="sort" value={query.sort} />}
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="flex-none">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input type="search" name="q" defaultValue={query.q} maxLength={60} aria-label={t("studio.searchLabel")} placeholder={t("studio.search")} className="min-w-0 flex-1 self-stretch border-0 bg-transparent text-[15px] text-ink outline-none" />
      </form>
      <div className="flex gap-2.5 max-[640px]:flex-col">
        <label className="sr-only" htmlFor="ds-type">
          {t("studio.type.label")}
        </label>
        <select id="ds-type" value={query.type ?? ""} onChange={(e) => go({ type: (e.target.value || null) as BusinessType | null })} className="ds-sel max-[640px]:w-full">
          <option value="">{t("studio.type.all")}</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {t(`wizard.businessTypes.${type}`)}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="ds-sort">
          {t("studio.sort.label")}
        </label>
        <select id="ds-sort" value={query.sort} onChange={(e) => go({ sort: e.target.value as StudioSort })} className="ds-sel max-[640px]:w-full">
          {STUDIO_SORTS.map((s) => (
            <option key={s} value={s}>
              {t(`studio.sort.${s}`)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
