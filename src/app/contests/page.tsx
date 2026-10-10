import type { Metadata } from "next";
import Link from "next/link";
import { BrowseFilters } from "@/components/contests/browse-filters";
import { visibleBusinessTypes } from "@/lib/content/lists";
import { ContestRow } from "@/components/contests/contest-row";
import { FeaturedCard } from "@/components/contests/featured-card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageShell, Panel } from "@/components/ui/panel";
import { Arrow, IconBadge, PageTitle } from "@/components/ui/section-heading";
import { Svg } from "@/components/ui/svg";
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

  const tile = (n: number, rot: string) => (
    <div key={n} className={cx("lc-ph aspect-square rounded-[18px] bg-white", rot)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/examples/browse/logo-${n}.jpg`} alt="" className={cx("h-full w-full", n === 9 ? "bg-[#0b4125] object-contain" : "object-cover")} loading="lazy" />
    </div>
  );

  return (
    <PageShell>
      {user?.role === "designer" ? (
        // Signed-in designers are here to find contests, so no banner at all (owner, 2026-10-08).
        <h1 className="sr-only">{t("nav.browse")}</h1>
      ) : user?.role === "client" ? (
        // Clients already run a contest, so they get one short line instead of the big banner (owner, 2026-10-08).
        <Panel className="!py-6">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="sr-only">{t("nav.browse")}</h1>
            <p className="m-0 flex items-center gap-3 text-lg font-semibold">
              <IconBadge>
                <Svg d="M12 5v14M5 12h14" size={22} stroke="#FFFFFF" width={2.4} />
              </IconBadge>
              {t("browse.clientBar.text")}
            </p>
            <ButtonLink href="/start">
              {t("browse.clientBar.cta")}
              <Arrow />
            </ButtonLink>
          </div>
        </Panel>
      ) : (
        /* Page header: steps and buttons on the left, example logos on the right */
        <Panel>
          <div className="mx-auto flex max-w-[1160px] flex-col gap-10 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 flex-1">
              <PageTitle pill={t("browse.hero.eyebrow")} lead={t("browse.hero.title")} />
              <p className="mb-0 mt-4 text-muted">{t("browse.hero.subtitle")}</p>
              <ol className="m-0 mt-3 list-none space-y-2 p-0">
                {(["s1", "s2", "s3", "s4", "s5"] as const).map((k, i) => (
                  <li key={k} className="flex items-start gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-tint text-sm font-bold text-primary">{formatNumber(i + 1, locale)}</span>
                    <span className="pt-0.5 leading-snug">{t(`browse.hero.steps.${k}`)}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
                <ButtonLink href="/start" size="lg">
                  {t("browse.hero.cta")}
                  <Arrow />
                </ButtonLink>
                <ButtonLink href="/how-it-works" variant="secondary" size="lg">
                  {t("browse.hero.how")}
                </ButtonLink>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-xs shrink-0 md:mx-0 md:w-72" aria-hidden>
              <Badge tone="tint" className="absolute -top-3 right-2 z-10">
                {t("home.how.art.example")}
              </Badge>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  [1, 2, 9],
                  [3, 10, 12],
                  [8, 6, 5],
                ].map((col, c) => (
                  <div key={c} className={cx("flex flex-col gap-2.5", c === 1 ? "-mt-3" : "mt-3")}>
                    {col.map((n, i) => tile(n, (c + i) % 3 === 0 ? "-rotate-2" : (c + i) % 3 === 1 ? "rotate-1" : "-rotate-1"))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      )}

      {featured.length > 0 && (
        <Panel tone="grey">
          <div className="mx-auto flex max-w-[1160px] flex-col gap-6">
            <h2 className="m-0 text-center text-[clamp(26px,3vw,38px)] font-semibold tracking-[-0.03em]">{t("browse.featured")}</h2>
            {/* Centred, so one or two featured contests don't hug the left edge */}
            <ul className="m-0 flex list-none flex-wrap justify-center gap-3.5 p-0">
              {featured.map((c) => (
                <li key={c.slug} className="lc-rv w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)]">
                  <FeaturedCard contest={c} now={now} saved={saved ? saved.has(c.id) : undefined} />
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      )}

      <Panel>
        <div className="mx-auto max-w-[1160px]">
          <h2 className="m-0 text-[clamp(26px,3vw,38px)] font-semibold tracking-[-0.03em]">{t("browse.all")}</h2>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <nav aria-label={t("browse.all")} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
              <ul className="m-0 flex w-max list-none gap-1 rounded-[18px] bg-chip p-1">
                {BROWSE_TABS.map((tab) => {
                  const active = tab === query.tab;
                  return (
                    <li key={tab}>
                      <Link
                        href={browseHref(query, { tab })}
                        aria-current={active ? "page" : undefined}
                        className={cx("flex min-h-11 items-center gap-2 rounded-[14px] px-4 text-[15px] font-semibold transition-colors", active ? "bg-ink text-white" : "text-muted hover:text-ink")}
                      >
                        {t(`browse.tabs.${tab}`)}
                        <span className={cx("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-white/15" : "bg-white")}>{formatNumber(list.counts[tab], locale)}</span>
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
              <ul className="m-0 mt-6 list-none space-y-3 p-0">
                {list.rows.map((c) => (
                  <li key={c.slug} className="lc-rv-soft">
                    <ContestRow contest={c} now={now} saved={saved ? saved.has(c.id) : undefined} />
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                <p className="m-0 text-sm text-muted">{t("browse.showing", { from, to, total: list.total })}</p>
                {pages > 1 && (
                  <nav aria-label={t("browse.page", { page: query.page })}>
                    <ul className="m-0 flex list-none items-center gap-1 p-0">
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
        </div>
      </Panel>
    </PageShell>
  );
}

function PageLink({ href, label, current, children }: { href: string | null; label: string; current?: boolean; children: React.ReactNode }) {
  const base = "flex size-11 items-center justify-center rounded-[14px] text-[15px] font-semibold tabular-nums";
  return (
    <li>
      {href ? (
        <Link
          href={href}
          aria-label={label}
          aria-current={current ? "page" : undefined}
          className={cx(base, current ? "lc-g bg-[image:var(--gradient-red)] text-white" : "border border-line bg-surface text-ink hover:border-primary")}
        >
          {children}
        </Link>
      ) : (
        <span className={cx(base, "border border-line bg-surface text-line")} aria-hidden>
          {children}
        </span>
      )}
    </li>
  );
}
