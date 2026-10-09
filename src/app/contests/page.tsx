import type { Metadata } from "next";
import Link from "next/link";
import { BrowseFilters } from "@/components/contests/browse-filters";
import { visibleBusinessTypes } from "@/lib/content/lists";
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
  return { title: t("browse.meta.title"), description: t("browse.meta.description"), alternates: { canonical: "/contests" } };
}

// P-02 Browse contests
export default async function BrowsePage({ searchParams }: PageProps<"/contests">) {
  const query = parseBrowseQuery(await searchParams);
  // Featured contests only sit on top of the plain, unfiltered first page.
  const showFeatured = query.tab === "open" && query.page === 1 && !query.type;
  const [{ t, locale }, list, featured, types] = await Promise.all([getI18n(), listContests(query), showFeatured ? featuredContests(3) : [], visibleBusinessTypes(query.type)]);
  const now = new Date();
  // Designers get a heart on each row (BLUEPRINT §10 saved contests).
  const user = await getCurrentUser();
  const saved = can(user, "contest.save")
    ? await savedContestIds(
        user?.id,
        [...list.rows, ...featured].map((c) => c.id),
      )
    : null;
  const pages = Math.max(1, Math.ceil(list.total / BROWSE_PAGE_SIZE));
  const from = list.total === 0 ? 0 : (query.page - 1) * BROWSE_PAGE_SIZE + 1;
  const to = Math.min(list.total, query.page * BROWSE_PAGE_SIZE);
  // Signed-in designers see no banner, so the lists start right under the header.
  const noBanner = user?.role === "designer";

  return (
    <div className="pb-16">
      {user?.role === "designer" ? (
        // Signed-in designers are here to find contests, so no banner at all (owner, 2026-10-08).
        <h1 className="sr-only">{t("nav.browse")}</h1>
      ) : user?.role === "client" ? (
        // Clients already run a contest, so they get one short line instead of the big banner (owner, 2026-10-08).
        <section className="mx-auto w-full max-w-page px-4 pt-4">
          <div className="flex animate-rise flex-col items-start gap-3 rounded-2xl bg-aurora px-5 py-4 shadow-card ring-1 ring-white sm:flex-row sm:items-center sm:justify-between">
            <h1 className="sr-only">{t("nav.browse")}</h1>
            <p className="flex items-center gap-3 font-semibold text-ink">
              <span
                className="flex size-9 shrink-0 animate-float-soft items-center justify-center rounded-xl bg-gradient-to-br from-ink to-primary-dark text-white shadow-card"
                aria-hidden
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              {t("browse.clientBar.text")}
            </p>
            <Link
              href="/start"
              className="btn-sheen relative inline-flex min-h-11 shrink-0 items-center gap-2 overflow-clip rounded-full bg-primary px-5 text-sm font-semibold text-white shadow-card transition-[background-color,translate] duration-200 hover:-translate-y-0.5 hover:bg-primary-dark active:scale-[0.97]"
            >
              {t("browse.clientBar.cta")} →
            </Link>
          </div>
        </section>
      ) : (
        /* Page header (owner, 2026-10-08, from a reference): steps and buttons on the left, a collage of example logos on the right */
        <section className="mx-auto w-full max-w-page px-4 pt-4">
          <div className="relative overflow-hidden bg-aurora rounded-3xl px-6 py-8 text-ink shadow-frame ring-1 ring-white sm:px-10">
            <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between md:gap-8">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">{t("browse.hero.eyebrow")}</p>
                <h1 className="mt-2 max-w-2xl text-balance text-h1 font-bold leading-tight tracking-tight lg:text-4xl">{t("browse.hero.title")}</h1>
                <p className="mt-2 text-sm text-muted">{t("browse.hero.subtitle")}</p>

                <ol className="mt-3 space-y-1.5">
                  {(["s1", "s2", "s3", "s4", "s5"] as const).map((k, i) => (
                    <li key={k} className="flex items-start gap-2.5">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-primary shadow-card ring-1 ring-primary/15">
                        {formatNumber(i + 1, locale)}
                      </span>
                      <span className="pt-0.5 text-sm leading-snug text-ink">{t(`browse.hero.steps.${k}`)}</span>
                    </li>
                  ))}
                </ol>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/start"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 font-semibold text-white shadow-card transition-colors hover:bg-primary-dark"
                  >
                    {t("browse.hero.cta")}
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                  <Link
                    href="/how-it-works"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white/80 px-6 font-semibold text-ink ring-1 ring-inset ring-line backdrop-blur transition-colors hover:bg-white"
                  >
                    {t("browse.hero.how")}
                    <svg viewBox="0 0 24 24" className="size-4 text-primary" fill="currentColor" aria-hidden>
                      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-2 6.5 6 3.5-6 3.5Z" />
                    </svg>
                  </Link>
                </div>
              </div>

              {/* Collage of example logos; each column floats at its own pace */}
              <div className="relative mx-auto w-full max-w-xs shrink-0 md:mx-0 md:w-64 lg:w-72" aria-hidden>
                <span className="absolute -top-3 right-2 z-10 rounded-full bg-cream px-2.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-primary-dark shadow-card">
                  {t("home.how.art.example")}
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    [1, 2, 9],
                    [3, 10, 12],
                    [8, 6, 5],
                  ].map((col, c) => (
                    <div key={c} className={cx("flex flex-col gap-2", c === 1 ? "-mt-3 animate-float" : "mt-3 animate-float-soft")} style={{ animationDelay: `${c * 0.9}s` }}>
                      {col.map((n, i) => (
                        <div
                          key={n}
                          className={cx(
                            "aspect-square overflow-hidden rounded-lg bg-white shadow-raised ring-2 ring-white transition-transform duration-300 hover:z-10 hover:scale-105",
                            (c + i) % 3 === 0 ? "-rotate-2" : (c + i) % 3 === 1 ? "rotate-1" : "-rotate-1",
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/examples/browse/logo-${n}.jpg`}
                            alt=""
                            // Logo 9 is a wide image: shown whole on its own green
                            className={cx("h-full w-full", n === 9 ? "bg-[#0b4125] object-contain" : "object-cover")}
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section className={cx("mx-auto w-full max-w-page px-4", noBanner ? "pt-4" : "pt-12")}>
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

      <section className={cx("mx-auto w-full max-w-page px-4", noBanner && featured.length === 0 ? "pt-4" : "pt-12")}>
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
          <BrowseFilters query={query} types={types} />
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
