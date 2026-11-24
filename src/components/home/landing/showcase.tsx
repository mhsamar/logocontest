/* eslint-disable @next/next/no-img-element */
import Link from "@/components/ui/link";
import { categoryLabel } from "@/lib/contests/browse-query";
import { cx } from "@/lib/cx";
import { timeLeft } from "@/lib/home/logo-pick";
import { homeShowcase, type ShowFeatured, type ShowLive, type ShowLogo, type ShowSmall } from "@/lib/home/showcase";
import { roundedCount } from "@/lib/home/showcase-rules";
import type { Locale } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";
import { ShowcaseClicks, ShowcaseTabs } from "./showcase-client";
import "./showcase.css";

/** A wall row with fewer logos than this stands still, centred (a short row can't loop without a gap). */
const WALL_MOVE_FROM = 6;

type Ctx = { t: Translate; locale: Locale; price: (bdt: number) => string; n: (v: number) => string };

/** One logo picture: lazy, async, with its size set so nothing moves when it arrives. */
const Pic = ({ src, alt, size = 240, className }: { src: string; alt: string; size?: number; className?: string }) => (
  // The site's picture fade (motion-fx) marks images as they stream in, before React takes over: not a real mismatch.
  <img className={className} src={src} alt={alt} width={size} height={size} loading="lazy" decoding="async" suppressHydrationWarning />
);

/** "New logo 2 hours ago": minutes under an hour, hours under two days, then days. */
function freshText(latestAt: string, now: Date, { t, n }: Ctx): string {
  const mins = Math.max(1, Math.floor((now.getTime() - new Date(latestAt).getTime()) / 60_000));
  if (mins < 60) return t("home2.showcase.fresh.minutes", { n: n(mins) });
  const hours = Math.floor(mins / 60);
  if (hours < 48) return t("home2.showcase.fresh.hours", { n: n(hours) });
  return t("home2.showcase.fresh.days", { n: n(Math.floor(hours / 24)) });
}

/** One wall card: the logo, the brand under it; it opens that design. `copy`: the loop's second run. */
function WallCard({ l, copy }: { l: ShowLogo; copy: boolean }) {
  return (
    <li className="lcs-wc">
      <Link href={l.href} className="lcs-wl" title={l.brand} tabIndex={copy ? -1 : undefined} data-lcs-ev="showcase_logo_click" data-lcs-place="wall">
        <Pic src={l.img} alt={copy ? "" : l.brand} className="lcs-wimg" />
        <span className="lcs-wname">{l.brand}</span>
      </Link>
    </li>
  );
}

/** The logo wall: rows 1 and 3 run left, row 2 right; each row twice so the loop has no seam. */
function Wall({ rows }: { rows: ShowLogo[][] }) {
  return (
    <div className="lcs-wall">
      {rows.map((row, i) => {
        const moves = row.length >= WALL_MOVE_FROM;
        return (
          <div key={i} className={cx("lcs-wr", !moves && "lcs-still")}>
            <div className={cx("lcs-wtrack", moves && `lcs-run lcs-run${(i % 3) + 1}`)}>
              <ul className="lcs-wlist">
                {row.map((l) => (
                  <WallCard key={l.id} l={l} copy={false} />
                ))}
              </ul>
              {moves && (
                <ul className="lcs-wlist lcs-copy" aria-hidden>
                  {row.map((l) => (
                    <WallCard key={l.id} l={l} copy />
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A grid of thumbnails and, when the contest has more, a dark "+N" tile to it. */
function Grid({ logos, total, href, place, className, c, mobileShown }: { logos: (ShowLogo & { winner?: boolean })[]; total: number; href: string; place: string; className: string; c: Ctx; mobileShown?: number }) {
  const more = total - logos.length;
  // The featured grid shows fewer pictures on phones (showcase.css), so its tile counts the hidden ones there too.
  const moreMobile = mobileShown !== undefined ? total - Math.min(logos.length, mobileShown) : more;
  const label = (n: number) => c.t("home2.showcase.more", { n: c.n(n) });
  return (
    <div className={className}>
      {logos.map((l) => (
        <Link key={l.id} href={l.href} className={cx("lcs-lt", l.winner && "lcs-w")} data-lcs-ev="showcase_logo_click" data-lcs-place={place}>
          <Pic src={l.img} alt={l.brand} />
        </Link>
      ))}
      {(more > 0 || moreMobile > 0) && (
        <Link href={href} className={cx("lcs-lt lcs-more", more <= 0 && "lcs-m-only")} aria-label={c.t("home2.showcase.moreLabel", { n: c.n(Math.max(more, moreMobile)) })} data-lcs-ev="showcase_contest_click" data-lcs-place={place}>
          {more === moreMobile ? (
            label(more)
          ) : (
            <>
              <span className="lcs-d-only">{label(more)}</span>
              <span className="lcs-m-only">{label(moreMobile)}</span>
            </>
          )}
        </Link>
      )}
    </div>
  );
}

function LiveCard({ x, now, c }: { x: ShowLive; now: Date; c: Ctx }) {
  const { t, n, price } = c;
  const left = timeLeft(x.endsAt ? new Date(x.endsAt) : null, now);
  const leftText = !left ? null : left.kind === "hours" ? t("home2.showcase.hoursLeft", { n: n(left.n) }) : left.n === 1 ? t("home2.showcase.oneDayLeft") : t("home2.showcase.daysLeft", { n: n(left.n) });
  return (
    <article className="lcs-lc">
      <div className="lcs-lch">
        <div>
          <span className="lcs-cat">{categoryLabel({ kind: null, businessType: x.businessType }, t, c.locale)}</span>
          <h3 className="lcs-h3">{x.brand}</h3>
        </div>
        <span className="lcs-live">
          <i aria-hidden />
          {t("home2.showcase.live")}
        </span>
      </div>
      <div className="lcs-meta">
        <span>
          <b>{price(x.prize)}</b> {t("home2.showcase.prize")}
        </span>
        {leftText && <span>{leftText}</span>}
        <span>
          <b>{t("home2.showcase.logosN", { n: n(x.designs) })}</b> {t("home2.showcase.logos")}
        </span>
      </div>
      <Grid logos={x.logos} total={x.designs} href={x.href} place="live" className="lcs-grid" c={c} />
      {x.latestAt && (
        <div className="lcs-fresh">
          <i aria-hidden />
          {freshText(x.latestAt, now, c)}
        </div>
      )}
      <Link href={x.href} className="lcs-lk" data-lcs-ev="showcase_contest_click" data-lcs-place="live">
        {t("home2.showcase.seeAll")}
      </Link>
    </article>
  );
}

function Featured({ f, c }: { f: ShowFeatured; c: Ctx }) {
  const { t, n, price, locale } = c;
  const d = f.winner.designer;
  const date = f.finishedAt ? new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "long", timeZone: "Asia/Dhaka" }).format(new Date(f.finishedAt)) : null;
  const cat = categoryLabel({ kind: null, businessType: f.businessType }, t, locale);
  return (
    <div className="lcs-fin">
      <div className="lcs-win">
        <span className="lcs-crown">{t("home2.showcase.winnerBadge")}</span>
        <Link href={f.winner.href} className="lcs-wbig" data-lcs-ev="showcase_logo_click" data-lcs-place="winner">
          <Pic src={f.winner.img} alt={t("home2.showcase.winnerAlt", { brand: f.brand })} size={480} />
        </Link>
        <div className="lcs-dz">
          <span className="lcs-av" aria-hidden>
            {d?.avatarUrl && <img src={d.avatarUrl} alt="" width={40} height={40} loading="lazy" decoding="async" suppressHydrationWarning />}
          </span>
          <div>
            {d && <b>{d.name}</b>}
            <span>{d ? t("home2.showcase.designerWon", { prize: price(f.prize) }) : t("home2.showcase.designer")}</span>
          </div>
        </div>
        <div className="lcs-facts">
          <span>
            {t("home2.showcase.facts.prize")}
            <b>{price(f.prize)}</b>
          </span>
          {f.days > 0 && (
            <span>
              {t("home2.showcase.facts.time")}
              <b>{t("home2.showcase.facts.days", { n: n(f.days) })}</b>
            </span>
          )}
          <span>
            {t("home2.showcase.facts.logos")}
            <b>{t("home2.showcase.facts.logosN", { n: n(f.designs) })}</b>
          </span>
        </div>
        <Link href={f.href} className="lcs-wlk" data-lcs-ev="showcase_contest_click" data-lcs-place="featured">
          {t("home2.showcase.fullContest")}
        </Link>
      </div>
      <div className="lcs-fr">
        <div className="lcs-fh">
          <div>
            <span className="lcs-cat">{date ? t("home2.showcase.finishedOn", { category: cat, date }) : cat}</span>
            <h3 className="lcs-h3 lcs-h3-big">{f.brand}</h3>
          </div>
          <span className="lcs-done">{t("home2.showcase.done", { n: n(f.designs), m: n(f.designers) })}</span>
        </div>
        <Grid logos={f.logos} total={f.designs} href={f.href} place="featured" className="lcs-eg" c={c} mobileShown={15} />
        <div className="lcs-note">{t("home2.showcase.note", { n: n(f.designs) })}</div>
      </div>
    </div>
  );
}

function Small({ s, c }: { s: ShowSmall; c: Ctx }) {
  return (
    <Link href={s.href} className="lcs-mc" data-lcs-ev="showcase_contest_click" data-lcs-place="more">
      <span className="lcs-mimg">
        <Pic src={s.img} alt={s.brand} />
      </span>
      <span>
        <b>{s.brand}</b>
        <span>{c.t("home2.showcase.smallWon", { n: c.n(s.designs) })}</span>
      </span>
    </Link>
  );
}

/**
 * "What does a logo contest look like? See for yourself" (owner, 2026-11-20; Design/logocontest-home-showcase): the
 * logo wall, live and finished contests and a call to start, all real, from homeShowcase() (lib/home/showcase.ts).
 * Hidden when the showcase is off, the database can't answer, or there is nothing to show.
 */
export async function HomeShowcase() {
  const data = await homeShowcase();
  if (!data || (!data.wall.length && !data.live.length && !data.featured && !data.more.length)) return null;
  const { t, locale, price } = await getI18n();
  const c: Ctx = { t, locale, price, n: (v: number) => formatNumber(v, locale) };
  const now = new Date();
  const count = roundedCount(data.total);

  const live = data.live.length ? (
    <div className="lcs-row">
      {data.live.map((x) => (
        <LiveCard key={x.id} x={x} now={now} c={c} />
      ))}
    </div>
  ) : null;
  const finished =
    data.featured || data.more.length ? (
      <>
        {data.featured && <Featured f={data.featured} c={c} />}
        {data.more.length > 0 && (
          <div className="lcs-mrow">
            {data.more.map((s) => (
              <Small key={s.id} s={s} c={c} />
            ))}
          </div>
        )}
      </>
    ) : null;

  return (
    <ShowcaseClicks id="showcase" labelledBy="lcs-title" className="lcs">
      <div className="lcs-in">
        <div className="lcs-hd">
          <div>
            <span className="lcs-badge">
              <i aria-hidden />
              {t("home2.showcase.badge")}
            </span>
            <h2 id="lcs-title" className="lcs-title">
              {t("home2.showcase.titleLead")} <em>{t("home2.showcase.titleAccent")}</em>
            </h2>
            <p className="lcs-sub">{t("home2.showcase.sub")}</p>
          </div>
          <ol className="lcs-how">
            {(["one", "two", "three"] as const).map((k, i) => (
              <li key={k}>
                <b>{c.n(i + 1)}</b>
                {t(`home2.showcase.steps.${k}`)}
              </li>
            ))}
          </ol>
        </div>

        {data.wall.length > 0 && (
          <>
            <Wall rows={data.wall} />
            <div className="lcs-stat">
              {data.total > 0 && (
                <>
                  <span>
                    <b>
                      {c.n(count.n)}
                      {count.plus ? "+" : ""}
                    </b>{" "}
                    {t("home2.showcase.count")}
                  </span>
                  <span className="lcs-dot" aria-hidden />
                </>
              )}
              <span>{t("home2.showcase.real")}</span>
              <span className="lcs-dot" aria-hidden />
              <Link href="/contests" data-lcs-ev="showcase_contest_click" data-lcs-place="wall">
                {t("home2.showcase.seeAll")}
              </Link>
            </div>
          </>
        )}

        <ShowcaseTabs
          label={t("home2.showcase.tabsLabel")}
          liveLabel={t("home2.showcase.tabLive", { n: c.n(data.liveCount) })}
          finishedLabel={t("home2.showcase.tabFinished", { n: c.n(data.finishedCount) })}
          live={live}
          finished={finished}
        />

        <div className="lcs-cta">
          <div>
            <h3 className="lcs-cta-h">{t("home2.showcase.ctaTitle")}</h3>
            <p>{t("home2.showcase.ctaSub")}</p>
          </div>
          <div className="lcs-cta-b">
            <Link href="/contests" className="lcs-btn2" data-lcs-ev="showcase_contest_click" data-lcs-place="cta">
              {t("home2.showcase.ctaBrowse")}
            </Link>
            <Link href="/start" className="lcs-btn" data-lcs-ev="showcase_cta_start_contest" data-lcs-place="cta">
              {t("home2.showcase.ctaStart")}
            </Link>
          </div>
        </div>
      </div>
    </ShowcaseClicks>
  );
}
