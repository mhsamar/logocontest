"use client";

import { useRouter } from "next/navigation";
import { BUSINESS_TYPES } from "@/lib/contests/brief";
import { BROWSE_SORTS, browseHref, type BrowseQuery, type BrowseSort } from "@/lib/contests/browse-query";
import type { BusinessType } from "@/lib/contests/brief";
import { useI18n } from "@/lib/i18n/client";

const SELECT =
  "min-h-11 w-full rounded-md bg-surface pl-3 pr-8 text-sm text-ink ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-primary sm:w-auto";

/** P-02 business type and sort. Changes apply at once; without JavaScript the form's button does it. */
export function BrowseFilters({ query }: { query: BrowseQuery }) {
  const { t } = useI18n();
  const router = useRouter();
  const sorts = BROWSE_SORTS.filter((s) => query.tab === "open" || s !== "ending");

  return (
    <form action="/contests" className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      {query.tab !== "open" && <input type="hidden" name="status" value={query.tab} />}
      <label className="sr-only" htmlFor="browse-type">
        {t("browse.type.label")}
      </label>
      <select
        id="browse-type"
        name="type"
        defaultValue={query.type ?? ""}
        onChange={(e) => router.push(browseHref(query, { type: (e.target.value || null) as BusinessType | null }))}
        className={SELECT}
      >
        <option value="">{t("browse.type.all")}</option>
        {BUSINESS_TYPES.map((type) => (
          <option key={type} value={type}>
            {t(`wizard.businessTypes.${type}`)}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="browse-sort">
        {t("browse.sort.label")}
      </label>
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
      <noscript>
        <button type="submit" className="min-h-11 rounded-full bg-ink px-4 text-sm font-semibold text-white">
          {t("browse.apply")}
        </button>
      </noscript>
    </form>
  );
}
