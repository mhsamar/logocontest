import Link from "@/components/ui/link";
import { ButtonLink } from "@/components/ui/button";
import { LockIcon, tilePastel } from "@/components/contests/contest-bits";
import type { PackageKey } from "@/lib/contests/brief";
import { categoryLabel } from "@/lib/contests/browse-query";
import { cx } from "@/lib/cx";
import { tileInitials, type CarouselContest } from "@/lib/home/carousel";
import { timeLeft } from "@/lib/home/logo-pick";
import type { Locale } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";
import { ContestCarousel } from "./contest-carousel";
import "./carousel.css";

/** Package chip colours from the design: Economy grey, Standard dark, Premium gold, Custom red (owner, 2026-10-29). */
const PACKAGE_CHIP: Record<PackageKey, string> = {
  economy: "lcc-pk-grey",
  standard: "lcc-pk-dark",
  pro: "lcc-pk-dark",
  premium: "lcc-pk-gold",
  elite: "lcc-pk-gold",
  custom: "lcc-pk-red",
};

/**
 * The package as the new home page names it (owner, 2026-10-29: Economy, Standard, Premium and Custom, as on the
 * pricing cards below); Pro and Elite, which have no card there, keep the wizard's names.
 */
function packageName(key: PackageKey, t: Translate): string {
  return key === "economy" || key === "standard" || key === "premium" || key === "custom" ? t(`home2.pricing.names.${key}`) : t(`wizard.packages.${key}.name`);
}

/** The 112px tile: the name's initials on the contest's pastel (the same one as on the browse page), or a lock. */
function Tile({ c }: { c: CarouselContest }) {
  if (c.name === null) {
    return (
      <div className="lcc-tile lcc-lock" aria-hidden>
        <LockIcon className="lcc-lock-ic" />
      </div>
    );
  }
  const letters = tileInitials(c.name);
  return (
    <div className={cx("lcc-tile", tilePastel(c.id))} aria-hidden>
      <span className={cx("lc-d lcc-ini", letters.length === 1 && "lcc-ini-one")}>{letters.join("")}</span>
    </div>
  );
}

/** One card's inside, as in the design: tile, name, category, package, add-on badges, prize, designs and days left. */
function CardBody({ c, now, t, locale, price }: { c: CarouselContest; now: Date; t: Translate; locale: Locale; price: (bdt: number) => string }) {
  const left = timeLeft(c.endsAt ? new Date(c.endsAt) : null, now);
  const n = (v: number) => formatNumber(v, locale);
  const leftText = !left
    ? null
    : left.kind === "days"
      ? left.n === 1
        ? t("home2.carousel.oneDay")
        : t("home2.carousel.days", { days: n(left.n) })
      : left.n === 1
        ? t("home2.carousel.oneHour")
        : t("home2.carousel.hours", { hours: n(left.n) });
  return (
    <>
      <Tile c={c} />
      <div className="lcc-body">
        <div className="lcc-top">
          <div className="lcc-who">
            <h3 className="lcc-name">{c.name ?? t("home.card.privateTitle")}</h3>
            <span className="lcc-cat">{categoryLabel(c, t, locale)}</span>
          </div>
          <span className={cx("lcc-pk", PACKAGE_CHIP[c.package])}>{packageName(c.package, t)}</span>
        </div>
        {(c.urgent || c.highlighted) && (
          <div className="lcc-badges">
            {c.urgent && <span className="lcc-urgent">{t("home.card.urgent")}</span>}
            {c.highlighted && <span className="lcc-hl">{t("home.card.highlighted")}</span>}
          </div>
        )}
        <div className="lcc-foot">
          <span className="lc-d lcc-prize">{price(c.prize)}</span>
          <span className="lcc-meta">
            <span className="lcc-count">{c.designs === 1 ? t("browse.oneDesign") : t("browse.designs", { count: n(c.designs) })}</span>
            {left && (
              <span className={cx("lcc-left", left.soon && "lcc-soon")}>
                <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="8.5" />
                  <path d="M12 7.5V12l3 2" />
                </svg>
                {leftText}
              </span>
            )}
          </span>
        </div>
      </div>
    </>
  );
}

/**
 * "Contests live right now" (owner, 2026-10-29; Design/logocontest-site/index.html): up to 12 open contests in a
 * looping carousel, from carouselContests() (lib/home/carousel.ts); a friendly empty state until there are any.
 * A private or NDA card opens the contest list, as its own address would show its name.
 */
export async function LiveContests({ contests }: { contests: CarouselContest[] }) {
  const { t, locale, price } = await getI18n();
  const now = new Date();
  return (
    <section id="contests" aria-labelledby="lcc-title" className="lcc">
      <div className="lcc-in">
        <div className="lcc-head">
          <div className="lcc-intro">
            <span className="lcc-live">
              <span className="lcc-pulse" aria-hidden />
              {t("home2.carousel.live")}
            </span>
            <h2 id="lcc-title" className="lcc-title">
              {t("home.showcase.liveLead")} <span className="lcc-accent">{t("home.showcase.liveAccent")}</span>
            </h2>
            <p className="lcc-sub">{t("home.showcase.subtitle")}</p>
          </div>
          <Link href="/contests" className="lc-g lcc-browse">
            {t("home2.carousel.browseAll")}
            <svg aria-hidden width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
        {contests.length ? (
          <ContestCarousel
            // A new list (another minute's, or the page drawn again in the other language) starts from card 1.
            key={contests.map((c) => c.id).join()}
            slides={contests.map((c) => ({ href: c.slug ? `/contest/${c.slug}` : "/contests", body: <CardBody c={c} now={now} t={t} locale={locale} price={price} /> }))}
            prevLabel={t("home2.carousel.prev")}
            nextLabel={t("home2.carousel.next")}
          />
        ) : (
          <div className="lcc-empty">
            <h3 className="lcc-empty-title">{t("home.showcase.emptyTitle")}</h3>
            <p className="lcc-empty-body">{t("home.showcase.emptyBody")}</p>
            <ButtonLink href="/start" size="lg">
              {t("home.ways.contest.cta")}
            </ButtonLink>
          </div>
        )}
      </div>
    </section>
  );
}
