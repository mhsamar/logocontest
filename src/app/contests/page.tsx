import type { Metadata } from "next";
import Link from "next/link";
import { BrowseFilters } from "@/components/contests/browse-filters";
import { ContestCard, FeaturedContestCard } from "@/components/contests/browse-cards";
import { OfferCards, RacePanel } from "@/components/contests/reward-strip";
import { visibleBusinessTypes } from "@/lib/content/lists";
import { can } from "@/lib/auth/policies";
import { getCurrentUser } from "@/lib/auth/session";
import { browseContests, designerFacts, featuredContests } from "@/lib/contests/browse";
import { savedContestIds } from "@/lib/contests/community";
import { BROWSE_PAGE_SIZE, BROWSE_TABS, DESIGNER_TABS, browseHref, parseBrowseQuery, toggleQuick, type QuickFilter } from "@/lib/contests/browse-query";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";
import { getSetting } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("browse.meta.title"), description: t("browse.meta.description"), alternates: { canonical: "/contests" } };
}

const CARD = "rounded-[24px] border border-[#E9EAEE] bg-white";
const BTN = "inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full px-[22px] text-base font-bold transition-opacity hover:opacity-90";
const RED = "bg-[linear-gradient(180deg,#B3201B,#8B0000)] text-white";
const WHITE = "border border-[#DCDEE3] bg-white text-ink";
const CHIP = "inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[14.5px] font-bold transition-colors";

const Arrow = () => (
  <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Star = () => (
  <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden>
    <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.5 6.6-.8z" />
  </svg>
);

// P-02 Browse contests (redesign owner 2026-10-11, Design/contest-pages): a short hero, Featured contests with the gold
// bar, then All contests with tabs, quick filters, search, business type and sort, paid add-ons first, and Load more.
// Guests (and clients, whose menu has My Contests instead) get the visitor look; signed-in designers the designer look.
export default async function BrowsePage({ searchParams }: PageProps<"/contests">) {
  const [query, user, { t, locale }] = await Promise.all([searchParams.then(parseBrowseQuery), getCurrentUser(), getI18n()]);
  const designer = user?.role === "designer" ? user : null;
  if (!designer && query.tab === "joined") query.tab = "open";
  const now = new Date();
  const filtered = Boolean(query.q || query.type || query.quick.length);
  const showFeatured = query.tab === "open" && !filtered;
  const [list, featured, types] = await Promise.all([
    getSetting("limits.big_prize_from").then((bigPrize) => browseContests(query, { designerId: designer?.id ?? null, bigPrize, now })),
    showFeatured ? featuredContests(3) : [],
    visibleBusinessTypes(query.type),
  ]);
  const ids = list.rows.map((c) => c.id);
  const [saved, facts] = await Promise.all([
    can(user, "contest.save") ? savedContestIds(user?.id, ids) : null,
    designer ? designerFacts(ids, designer.id) : null,
  ]);
  const fmt = (n: number) => formatNumber(n, locale);
  const tabs = designer ? DESIGNER_TABS : BROWSE_TABS;
  const quicks: QuickFilter[] = designer ? ["featured", "urgent"] : ["featured", "urgent", "ending", "big"];
  const shown = list.rows.length;

  return (
    <div className="flex w-full flex-1 flex-col gap-5 px-3.5 pb-3.5 max-[720px]:gap-3 max-[720px]:px-2 max-[720px]:pb-2">
      {/* Short hero (about 240px) */}
      <section className={cx(CARD, "px-7 py-[22px] max-[640px]:px-4 max-[640px]:py-5")}>
        <div className="grid items-center gap-7 min-[1101px]:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
          <div className="flex min-w-0 flex-col items-start gap-2">
            <span className="rounded-full bg-[#FBECEB] px-3 py-1 text-[13.5px] font-bold text-primary">{designer ? t("browse.x.designerEyebrow") : t("browse.hero.eyebrow")}</span>
            <h1 className="lc-d m-0 text-[clamp(28px,2.9vw,40px)] font-semibold leading-[1.06] tracking-[-0.04em] text-ink">{designer ? t("browse.x.designerTitle") : t("browse.x.guestTitle")}</h1>
            <p className="m-0 max-w-[560px] text-[16.5px] text-muted">{designer ? t("browse.x.designerBody") : t("browse.x.guestBody")}</p>
            <div className="mt-1 flex flex-wrap gap-2 max-[640px]:w-full max-[640px]:flex-col">
              <Link href={designer ? "/dashboard" : "/start"} className={cx(BTN, RED)}>
                {designer ? t("browse.x.myDesigns") : t("browse.hero.cta")}
                <Arrow />
              </Link>
              <Link href="/how-it-works" className={cx(BTN, WHITE)}>
                {t("browse.hero.how")}
              </Link>
            </div>
          </div>
          {designer ? <RacePanel kind="gift_box" userId={designer.id} t={t} locale={locale} /> : <OfferCards t={t} />}
        </div>
      </section>

      {/* Featured contests and the gold bar */}
      {featured.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="featured-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
              <h2 id="featured-title" className="lc-d m-0 mr-1 text-[26px] font-semibold tracking-[-0.035em] text-ink">
                {t("browse.featured")}
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[linear-gradient(180deg,#F0C24F,#D9A52B)] px-3 py-1 text-[13.5px] font-bold text-[#3A2A00]">
                <Star />
                {t("browse.x.paid")}
              </span>
            </div>
            <span className="text-[14.5px] text-muted">{t("browse.x.paidLine")}</span>
          </div>
          <ul className="m-0 grid list-none gap-4 p-0 min-[641px]:grid-cols-2 min-[1101px]:grid-cols-3">
            {featured.map((c) => (
              <li key={c.id} className="flex">
                <div className="w-full">
                  <FeaturedContestCard c={c} t={t} locale={locale} now={now} designer={Boolean(designer)} />
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-[18px] gap-y-3.5 rounded-[22px] border border-[#F1E3A8] bg-[linear-gradient(135deg,#FFFBEA,#FFF1CF)] px-[22px] py-[18px] max-[640px]:px-4">
            <span aria-hidden className="flex size-[52px] flex-none items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#F0C24F,#D9A52B)] text-[#3A2A00]">
              <Star />
            </span>
            <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1">
              <strong className="lc-d text-xl leading-[1.15] tracking-[-0.025em] text-ink">{designer ? t("browse.x.firstTitle") : t("browse.x.wantTitle")}</strong>
              <span className="text-[15px] text-[#4A3700]">{designer ? t("browse.x.firstBody") : t("browse.x.wantBody")}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 max-[640px]:w-full max-[640px]:flex-col max-[640px]:items-stretch">
              {!designer && (
                <Link href="/start" className={cx(BTN, "min-h-[52px] border border-[#E2B13C] bg-white px-6 text-ink")}>
                  {t("browse.x.featureMine")}
                </Link>
              )}
              {list.featuredOpen > featured.length && (
                <Link href={browseHref(query, { quick: ["featured"] })} className={cx(BTN, RED, "min-h-[52px] px-7 shadow-[0_12px_24px_rgba(139,0,0,.22)]")}>
                  {t("browse.x.seeMore")}
                  <Arrow />
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* All contests */}
      <div className="-mb-1 mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <h2 className="lc-d m-0 mr-1 text-[26px] font-semibold tracking-[-0.035em] text-ink">{t("browse.all")}</h2>
        <span className="rounded-full bg-primary px-3 py-1 text-[13.5px] font-bold text-white">{t("browse.x.openNow", { n: fmt(list.openNow) })}</span>
      </div>
      <section className="flex flex-col gap-3.5" aria-label={t("browse.all")}>
        <div className="flex flex-wrap items-center gap-2.5 max-[640px]:flex-col max-[640px]:items-stretch">
          <nav aria-label={t("browse.all")} className="max-w-full overflow-x-auto [scrollbar-width:none]">
            <ul className="m-0 flex w-max list-none gap-1 rounded-full border border-[#E9EAEE] bg-white p-1">
              {tabs.map((tab) => {
                const active = tab === query.tab;
                return (
                  <li key={tab}>
                    <Link
                      href={browseHref(query, { tab })}
                      aria-current={active ? "page" : undefined}
                      className={cx("flex min-h-10 items-center gap-2 rounded-full px-4 text-[15px] font-bold max-[640px]:px-2.5 max-[640px]:text-[14.5px]", active ? "bg-[#111216] text-white" : "text-[#3A3C45] hover:text-ink")}
                    >
                      {tab === "joined" ? t("browse.x.joined") : t(`browse.tabs.${tab}`)}
                      <span className={cx("rounded-full px-2 text-[12.5px]", active ? "bg-white/20 text-white" : "bg-[#F0F1F4] text-[#3A3C45]")}>{fmt(list.counts[tab])}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div role="group" aria-label={t("browse.x.quick.label")} className="flex flex-wrap items-center gap-1.5">
            {quicks.map((f) => {
              const on = query.quick.includes(f);
              return (
                <Link
                  key={f}
                  href={browseHref(query, { quick: toggleQuick(query.quick, f) })}
                  aria-pressed={on}
                  className={cx(CHIP, on ? "border-[#111216] bg-[#111216] text-white" : "border-[#E3E4E8] bg-white text-[#3A3C45] hover:border-primary")}
                >
                  {f === "featured" && <Star />}
                  {f === "urgent" && <span aria-hidden className="size-[7px] rounded-full bg-[#C0161F]" />}
                  {t(`browse.x.quick.${f}`)}
                </Link>
              );
            })}
          </div>
          <form action="/contests" role="search" className="flex h-[46px] min-w-[120px] flex-[1_1_120px] items-center max-[640px]:flex-none gap-2.5 rounded-xl border border-[#DCDEE3] bg-white px-3.5 text-muted">
            {query.tab !== "open" && <input type="hidden" name="status" value={query.tab} />}
            {query.type && <input type="hidden" name="type" value={query.type} />}
            {query.quick.length > 0 && <input type="hidden" name="f" value={query.quick.join(",")} />}
            <svg viewBox="0 0 24 24" className="size-[18px] flex-none" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input type="search" name="q" defaultValue={query.q} maxLength={60} aria-label={t("browse.x.searchLabel")} placeholder={t("browse.x.search")} className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none" />
          </form>
          <BrowseFilters query={query} types={types} />
        </div>

        {query.tab === "open" && shown > 0 && (
          <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2 rounded-[14px] border border-[#E9EAEE] bg-white px-4 py-2.5">
            <strong className="text-sm text-ink">{t("browse.x.order.title")}</strong>
            {(
              [
                ["featured", "border-2 border-[#E2B13C] bg-white"],
                ["urgent", "bg-[#C0161F]"],
                ["highlighted", "border border-[#E8D48A] bg-[#FFF1B8]"],
                ["private", "bg-[#111216]"],
              ] as const
            ).map(([k, swatch]) => (
              <span key={k} className="inline-flex items-center gap-[7px] text-sm font-semibold text-[#3A3C45]">
                <i aria-hidden className={cx("size-3.5 rounded", swatch)} />
                {t(`browse.x.order.${k}`)}
              </span>
            ))}
            <span className="text-sm text-muted">{t("browse.x.order.rest")}</span>
          </div>
        )}

        {shown > 0 ? (
          <ul className="m-0 grid list-none gap-4 gap-y-[22px] p-0 pt-1 min-[641px]:grid-cols-2 min-[1101px]:grid-cols-3">
            {list.rows.map((c) => (
              <li key={c.id} className="flex">
                <div className="flex w-full">
                  <ContestCard c={c} t={t} locale={locale} now={now} designer={Boolean(designer)} facts={facts?.get(c.id)} saved={saved ? saved.has(c.id) : undefined} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className={cx(CARD, "mx-auto flex w-full max-w-xl flex-col items-center gap-3 px-6 py-10 text-center")}>
            <p className="lc-d m-0 text-xl font-semibold text-ink">{query.tab === "joined" && !filtered ? t("browse.x.joinedEmpty") : filtered ? t("browse.x.noMatchTitle") : t("browse.emptyTitle")}</p>
            {query.tab !== "joined" && <p className="m-0 text-muted">{filtered ? t("browse.x.noMatchBody") : t("browse.emptyBody")}</p>}
            {filtered ? (
              <Link href={browseHref(query, { q: "", type: null, quick: [] })} className={cx(BTN, WHITE)}>
                {t("browse.x.clear")}
              </Link>
            ) : (
              <Link href={query.tab === "joined" ? browseHref(query, { tab: "open" }) : "/start"} className={cx(BTN, RED)}>
                {query.tab === "joined" ? t("browse.tabs.open") : t("browse.hero.cta")}
                <Arrow />
              </Link>
            )}
          </div>
        )}

        {shown > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 text-[14.5px] text-muted max-[640px]:flex-col max-[640px]:items-stretch max-[640px]:text-center">
            <span>{t("browse.showing", { from: fmt(1), to: fmt(shown), total: fmt(list.total) })}</span>
            {shown < list.total && (
              <Link href={browseHref(query, { page: Math.ceil(shown / BROWSE_PAGE_SIZE) + 1 })} scroll={false} className={cx(BTN, RED, "min-h-14 px-9 text-[17px] shadow-[0_12px_24px_rgba(139,0,0,.22)]")}>
                {t("browse.x.loadMore")}
                <Arrow />
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
