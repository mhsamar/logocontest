/* eslint-disable @next/next/no-img-element */
import Link from "@/components/ui/link";
import { MIN_HOME_WINNERS, type HomeWinner } from "@/lib/home/winners";
import { getI18n } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import "./winners.css";

/** The design's eight card colours (logo panel and avatar), repeated. */
const TONES = 8;

const Trophy = ({ size }: { size: number }) => (
  <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
    <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7" />
  </svg>
);

/**
 * One winner: the winning logo, the designer (photo or initials; the whole card opens their profile) and the prize.
 * `copy`: the marquee's second run, hidden from screen readers and the Tab key.
 */
function WinnerCard({ w, tone, copy, t, price }: { w: HomeWinner; tone: number; copy: boolean; t: Translate; price: (bdt: number) => string }) {
  const d = w.designer;
  return (
    <li className={`lc-wn-card lc-wn-t${tone}`}>
      <div className="lc-wn-logo">
        <img className="lc-wn-img" src={w.logoUrl} alt={t("winners.alt", { brand: w.brandName })} width={140} height={140} loading="lazy" decoding="async" />
        <span className="lc-wn-badge" aria-hidden>
          {t("home2.winners.badge")}
        </span>
      </div>
      <div className="lc-wn-foot">
        <span className="lc-wn-av lc-d" aria-hidden>
          {d?.avatarUrl ? <img src={d.avatarUrl} alt="" width={50} height={50} loading="lazy" decoding="async" /> : d ? d.initials : <Trophy size={24} />}
        </span>
        <span className="lc-wn-who">
          <strong className="lc-wn-name">
            {d?.username ? (
              <Link href={`/d/${d.username}`} tabIndex={copy ? -1 : undefined}>
                {d.name}
              </Link>
            ) : (
              (d?.name ?? t("home2.winners.blind"))
            )}
          </strong>
          <span className="lc-wn-won">{t("home2.winners.won", { brand: w.brandName })}</span>
        </span>
        <span className="lc-wn-prize">
          <span className="sr-only">{t("home2.winners.prize")} </span>
          {price(w.prize)}
        </span>
      </div>
    </li>
  );
}

/**
 * "Meet the designers who won" (owner, 2026-10-29; Design/logocontest-site/index.html #winners): a marquee of real
 * winners from homeWinners(), the prize in the visitor's currency. Pure CSS: the list runs twice (the second run
 * hidden from screen readers), pauses on hover or keyboard focus, and stands still for reduced motion. The design has
 * no "see all" link, only "Join as a designer". Hidden while there are fewer than four winners.
 */
export async function Winners({ winners }: { winners: HomeWinner[] }) {
  if (winners.length < MIN_HOME_WINNERS) return null;
  const { t, price } = await getI18n();
  const cards = (copy: boolean) => winners.map((w, i) => <WinnerCard key={w.entryId} w={w} tone={i % TONES} copy={copy} t={t} price={price} />);
  return (
    <section id="winners" aria-labelledby="lc-wn-title" className="lc-wn">
      <div className="lc-wn-in">
        <div className="lc-wn-head lc-rv">
          <div className="lc-wn-intro">
            <span className="lc-wn-pill">
              <Trophy size={16} />
              {t("home2.winners.pill")}
            </span>
            <h2 id="lc-wn-title" className="lc-wn-title">
              {t("home2.winners.titleLead")} <span>{t("home2.winners.titleAccent")}</span>
            </h2>
            <p className="lc-wn-sub">{t("home2.winners.sub")}</p>
          </div>
          <Link href="/designers/signup" className="lc-wn-join lc-g">
            {t("nav.becomeDesigner")}
            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F5CF6A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
        <div className="lc-wn-mq">
          <div className="lc-wn-track">
            <ul className="lc-wn-list">{cards(false)}</ul>
            <ul className="lc-wn-list" aria-hidden>
              {cards(true)}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
