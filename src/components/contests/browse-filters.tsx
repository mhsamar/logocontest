"use client";

import { useRouter } from "next/navigation";
import { BROWSE_SORTS, browseHref, type BrowseQuery, type BrowseSort } from "@/lib/contests/browse-query";
import type { BusinessType } from "@/lib/contests/brief";
import { useI18n } from "@/lib/i18n/client";

const SELECT =
  "h-[46px] w-full appearance-none rounded-xl border border-[#DCDEE3] bg-white pl-3.5 pr-9 text-[15px] font-semibold text-ink focus:outline-2 focus:outline-offset-1 focus:outline-primary";

/** The design's chevron on both dropdowns (owner, 2026-10-29; Design/logocontest-site/browse-contests.html), drawn over the select. */
const Chevron = () => (
  <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-3.5 top-1/2 size-[15px] -translate-y-1/2 text-ink" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
const WRAP = "relative flex w-full sm:w-auto";

/** P-02 business type (the admin's Business types list, A-15) and sort. Changes apply at once; without JavaScript the form's button does it. */
export function BrowseFilters({ query, types }: { query: BrowseQuery; types: BusinessType[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const sorts = BROWSE_SORTS.filter((s) => query.tab === "open" || s !== "ending");

  return (
    <form action="/contests" className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      {query.tab !== "open" && <input type="hidden" name="status" value={query.tab} />}
      {query.quick.length > 0 && <input type="hidden" name="f" value={query.quick.join(",")} />}
      {query.q && <input type="hidden" name="q" value={query.q} />}
      <label className="sr-only" htmlFor="browse-type">
        {t("browse.type.label")}
      </label>
      <span className={WRAP}>
        <select
          id="browse-type"
          name="type"
          defaultValue={query.type ?? ""}
          onChange={(e) => router.push(browseHref(query, { type: (e.target.value || null) as BusinessType | null }))}
          className={SELECT}
        >
          <option value="">{t("browse.type.all")}</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {t(`wizard.businessTypes.${type}`)}
            </option>
          ))}
        </select>
        <Chevron />
      </span>
      <label className="sr-only" htmlFor="browse-sort">
        {t("browse.sort.label")}
      </label>
      <span className={WRAP}>
        <select
          id="browse-sort"
          name="sort"
          defaultValue={query.sort}
          onChange={(e) => router.push(browseHref(query, { sort: e.target.value as BrowseSort }))}
          className={SELECT}
        >
          {sorts.map((s) => (
            <option key={s} value={s}>
              {t("browse.sort.label")}: {t(`browse.sort.${s}`)}
            </option>
          ))}
        </select>
        <Chevron />
      </span>
      <noscript>
        <button type="submit" className="min-h-11 rounded-full bg-ink px-4 text-sm font-semibold text-white">
          {t("browse.apply")}
        </button>
      </noscript>
    </form>
  );
}
