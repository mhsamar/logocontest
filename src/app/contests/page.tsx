import type { Metadata } from "next";
import Link from "next/link";
import { BrowseFilters } from "@/components/contests/browse-filters";
import { ContestRow } from "@/components/contests/contest-row";
import { FeaturedCard } from "@/components/contests/featured-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cx } from "@/lib/cx";
import { can } from "@/lib/auth/policies";
import { getCurrentUser } from "@/lib/auth/session";
import { featuredContests, listContests } from "@/lib/contests/browse";
import { savedContestIds } from "@/lib/contests/community";
import { BROWSE_PAGE_SIZE, BROWSE_TABS, browseHref, pageList, parseBrowseQuery } from "@/lib/contests/browse-query";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("browse.meta.title"), description: t("browse.meta.description") };
}

// P-02 Browse contests
export default async function BrowsePage({ searchParams }: PageProps<"/contests">) {
  const query = parseBrowseQuery(await searchParams);
  // Featured contests only sit on top of the plain, unfiltered first page.
  const showFeatured = query.tab === "open" && query.page === 1 && !query.type;
  const [{ t, locale }, list, featured] = await Promise.all([getI18n(), listContests(query), showFeatured ? featuredContests(3) : []]);
  const now = new Date();
  // Designers get a heart on each row (BLUEPRINT §10 saved contests).
  const user = await getCurrentUser();
  const saved = can(user, "contest.save") ? await savedContestIds(user?.id, [...list.rows, ...featured].map((c) => c.id)) : null;
  const pages = Math.max(1, Math.ceil(list.total / BROWSE_PAGE_SIZE));
  const from = list.total === 0 ? 0 : (query.page - 1) * BROWSE_PAGE_SIZE + 1;
  const to = Math.min(list.total, query.page * BROWSE_PAGE_SIZE);

  return (
    <div className="pb-16">
      {/* Page header: dark ink panel with the faint grid */}
      <section className="mx-auto w-full max-w-page px-4 pt-4">
        <div className="relative overflow-hidden bg-aurora rounded-[2rem] px-6 py-10 text-ink shadow-frame ring-1 ring-white sm:px-10 sm:py-14">
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">{t("browse.hero.eyebrow")}</p>
              <h1 className="mt-3 text-balance text-h1 font-bold leading-tight tracking-tight lg:text-[2.5rem]">{t("browse.hero.title")}</h1>
            </div>
            <Link
              href="/start"
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-6 font-semibold text-white shadow-card transition-colors hover:bg-primary-dark"
            >
              {t("browse.hero.cta")}
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mx-auto w-full max-w-page px-4 pt-12">
          <h2 className="text-h3 font-semibold text-ink lg:text-h3-lg">{t("browse.featured")}</h2>
          {/* Centred, so one or two featured contests don't hug the left edge */}
          <ul className="mt-5 flex flex-wrap justify-center gap-4">
            {featured.map((c) => (
              <li key={c.slug} className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)]">
                <FeaturedCard contest={c} now={now} saved={saved ? saved.has(c.id) : undefined} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-auto w-full max-w-page px-4 pt-12">
        <h2 className="text-h3 font-semibold text-ink lg:text-h3-lg">{t("browse.all")}</h2>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <nav aria-label={t("browse.all")} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
            <ul className="flex w-max gap-1 rounded-full bg-surface p-1 ring-1 ring-line">
              {BROWSE_TABS.map((tab) => {
                const active = tab === query.tab;
                return (
                  <li key={tab}>
                    <Link
                      href={browseHref(query, { tab })}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors",
                        active ? "bg-ink text-white" : "text-muted hover:text-ink",
                      )}
                    >
                      {t(`browse.tabs.${tab}`)}
                      <span className={cx("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-white/15" : "bg-canvas")}>{formatNumber(list.counts[tab], locale)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <BrowseFilters query={query} />
        </div>

        {list.rows.length > 0 ? (
          <>
            <ul className="mt-6 space-y-3">
              {list.rows.map((c) => (
                <li key={c.slug}>
                  <ContestRow contest={c} now={now} saved={saved ? saved.has(c.id) : undefined} />
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
              <p className="text-sm text-muted">{t("browse.showing", { from, to, total: list.total })}</p>
              {pages > 1 && (
                <nav aria-label={t("browse.page", { page: query.page })}>
                  <ul className="flex items-center gap-1">
                    <PageLink href={query.page > 1 ? browseHref(query, { page: query.page - 1 }) : null} label={t("browse.prev")}>
                      ‹
                    </PageLink>
                    {pageList(query.page, pages).map((n, i) =>
                      n === null ? (
                        <li key={`gap-${i}`} className="px-1 text-muted" aria-hidden>
                          …
                        </li>
                      ) : (
                        <PageLink key={n} href={browseHref(query, { page: n })} label={t("browse.page", { page: n })} current={n === query.page}>
                          {formatNumber(n, locale)}
                        </PageLink>
                      ),
                    )}
                    <PageLink href={query.page < pages ? browseHref(query, { page: query.page + 1 }) : null} label={t("browse.next")}>
                      ›
                    </PageLink>
                  </ul>
                </nav>
              )}
            </div>
          </>
        ) : (
          <div className="mx-auto mt-8 max-w-xl">
            <EmptyState title={t("browse.emptyTitle")} body={t("browse.emptyBody")} action={<ButtonLink href="/start">{t("browse.hero.cta")}</ButtonLink>} />
          </div>
        )}
      </section>
    </div>
  );
}

function PageLink({ href, label, current, children }: { href: string | null; label: string; current?: boolean; children: React.ReactNode }) {
  const base = "flex size-10 items-center justify-center rounded-md text-sm font-semibold tabular-nums";
  return (
    <li>
      {href ? (
        <Link
          href={href}
          aria-label={label}
          aria-current={current ? "page" : undefined}
          className={cx(base, current ? "bg-primary text-white" : "bg-surface text-ink ring-1 ring-line hover:ring-primary")}
        >
          {children}
        </Link>
      ) : (
        <span className={cx(base, "bg-surface text-line ring-1 ring-line")} aria-hidden>
          {children}
        </span>
      )}
    </li>
  );
}
