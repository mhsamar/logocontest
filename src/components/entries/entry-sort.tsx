import Link from "next/link";
import { cx } from "@/lib/cx";
import { ENTRY_SORTS, type EntrySort as Sort } from "@/lib/entries/rules";
import type { Translate } from "@/lib/i18n/translate";

/**
 * Order the designs (owner, 2026-10-11): best rated (the default), most liked, most disliked, most comments, newest.
 * `href(sort)` builds each link so the page keeps its other choices (tab, filter).
 */
export function EntrySort({ current, href, t, tone = "chip" }: { current: Sort; href: (sort: Sort) => string; t: Translate; tone?: "chip" | "surface" }) {
  return (
    <nav aria-label={t("entry.sort.label")} className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]">
      <span className="shrink-0 text-[13px] font-semibold text-muted">{t("entry.sort.label")}</span>
      <ul className="m-0 flex w-max list-none gap-1.5 p-0">
        {ENTRY_SORTS.map((s) => (
          <li key={s}>
            <Link
              href={href(s)}
              scroll={false}
              aria-current={s === current ? "true" : undefined}
              className={cx(
                "flex min-h-9 items-center whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold ring-1 ring-inset transition-colors",
                s === current ? "bg-ink text-white ring-ink" : cx(tone === "chip" ? "bg-chip" : "bg-surface", "text-ink ring-line hover:ring-primary"),
              )}
            >
              {t(`entry.sort.${s}`)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
