"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { WinnerTrophy } from "@/components/ui/trophy";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { loadMoreStudio } from "@/lib/studio/actions";
import type { StudioFilter } from "@/lib/studio/options";
import type { StudioDesign } from "@/lib/studio/queries";

/** P-13 grid: one tile per design (first mockup), trophy on winners, "Load more" 24 at a time. */
export function StudioGrid({ initial, nextCursor, filter, newSince }: { initial: StudioDesign[]; nextCursor: string | null; filter: StudioFilter; newSince: string }) {
  const { t, locale } = useI18n();
  const [designs, setDesigns] = useState(initial);
  const [cursor, setCursor] = useState(nextCursor);
  const [error, setError] = useState(false);
  const [busy, start] = useTransition();
  const fmt = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-IN");
  const fresh = Date.parse(newSince);

  const more = () =>
    start(async () => {
      if (!cursor) return;
      setError(false);
      const page = await loadMoreStudio(filter, cursor);
      if (!page) return setError(true);
      setDesigns((d) => [...d, ...page.designs.filter((x) => !d.some((y) => y.id === x.id))]);
      setCursor(page.nextCursor);
    });

  if (designs.length === 0) return <p className="mt-8 rounded-2xl border border-dashed border-line bg-surface px-4 py-14 text-center text-muted">{t("studio.empty")}</p>;

  return (
    <>
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {designs.map((d, i) => (
          <li key={d.id} className="reveal">
            <Link
              href={`/contest/${d.contestSlug}?tab=entries&entry=${d.number}`}
              aria-label={t("studio.open", { n: fmt.format(d.number), brand: d.brandName })}
              className={cx(
                "group relative block aspect-square animate-rise overflow-clip rounded-2xl bg-surface shadow-card transition-shadow duration-300 hover:shadow-raised",
                d.isWinner ? "ring-2 ring-[#f1c75c]" : "ring-1 ring-line",
              )}
              style={{ animationDelay: `${(i % 24) * 40}ms` }}
            >
              {d.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived storage links
                <img src={d.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-canvas text-2xl font-bold text-muted">#{fmt.format(d.number)}</span>
              )}
              {d.isWinner && <WinnerTrophy size="sm" className="absolute right-2 top-2" />}
              {!d.isWinner && Date.parse(d.createdAt) >= fresh && (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-white shadow-card">
                  <span className="size-1.5 animate-pulse rounded-full bg-white" aria-hidden />
                  {t("studio.newBadge")}
                </span>
              )}
              {d.imageCount > 1 && (
                <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-ink/60 px-2 py-0.5 text-[0.6875rem] font-semibold text-white backdrop-blur transition-opacity duration-300 sm:group-hover:opacity-0">
                  <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                    <rect x="7" y="7" width="13" height="13" rx="2" />
                    <path d="M4 16V5a1 1 0 0 1 1-1h11" />
                  </svg>
                  {fmt.format(d.imageCount)}
                </span>
              )}
              {/* Brand, number and designer: always on phones, slides up on hover on larger screens */}
              <span className="absolute inset-x-0 bottom-0 flex flex-col bg-gradient-to-t from-ink/85 via-ink/45 to-transparent px-3 pb-2.5 pt-10 text-white transition-[opacity,translate] duration-300 sm:translate-y-2 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100">
                <span className="truncate text-sm font-bold">{d.brandName}</span>
                <span className="truncate text-xs text-white/80">
                  #{fmt.format(d.number)} · {d.designer ? (d.designer.username ? `@${d.designer.username}` : d.designer.name) : t("studio.hiddenDesigner")}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col items-center gap-3">
        {error && <Alert tone="danger">{t("studio.error")}</Alert>}
        {cursor ? (
          <Button variant="secondary" size="lg" onClick={more} loading={busy}>
            {busy ? t("studio.loading") : t("studio.loadMore")}
          </Button>
        ) : (
          <p className="text-sm text-muted">{t("studio.end")}</p>
        )}
      </div>
    </>
  );
}
