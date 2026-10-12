/* eslint-disable @next/next/no-img-element -- signed, short-lived storage links */
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";
import type { StudioHero as HeroData, StudioStats } from "@/lib/studio/queries";
import { StudioTicker } from "./studio-ticker";

/** Splits the latest thumbnails over three columns, repeating them so each column is long enough to loop. */
function columns(thumbs: string[]): string[][] {
  if (thumbs.length === 0) return [];
  const pool = [...thumbs];
  while (pool.length < 15) pool.push(...thumbs);
  const cols: string[][] = [[], [], []];
  pool.slice(0, 15).forEach((url, i) => cols[i % 3].push(url));
  // Shift the start of each column so the same design isn't side by side.
  return cols.map((c, i) => [...c.slice(i), ...c.slice(0, i)]);
}

/**
 * Design Studio hero (owner, 2026-10-12; Design/design-studio): live pill, title, real stats and the hint on the left;
 * on wide screens three columns of the latest designs' first files scroll slowly (two up, one down), with a floating
 * card of the last real events. No activity: no card.
 */
export async function StudioHero({ stats, hero }: { stats: StudioStats; hero: HeroData }) {
  const { t, locale } = await getI18n();
  const n = (v: number) => formatNumber(v, locale);
  const cols = columns(hero.thumbs);
  const events = hero.events.map((e) => ({
    key: `${e.kind}-${e.at}`,
    username: e.username,
    avatarUrl: e.avatarUrl,
    text: t(e.kind === "won" ? "studio.events.won" : "studio.events.sent", { who: e.username ? `@${e.username}` : t("studio.events.someone"), brand: e.brand }),
  }));

  return (
    <section className="ds-hero" aria-labelledby="ds-title">
      <div className="ds-hl">
        <span className="ds-live">
          <span className="ds-ld" aria-hidden />
          {t("studio.live")}
        </span>
        <h1 id="ds-title" className="ds-ht lc-d">
          {t("studio.titleStart")}{" "}
          <span className="ds-hw">
            {t("studio.titleAccent")}
            <i aria-hidden />
          </span>
        </h1>
        <p className="m-0 max-w-[520px] text-[17px] text-[#5F626B]">{t("studio.lead")}</p>
        <div className="ds-hst">
          <p className="ds-hs m-0">
            <strong className="lc-d">{n(stats.designs)}</strong>
            <span>{t("studio.stats.designs")}</span>
          </p>
          <p className="ds-hs r m-0">
            <strong className="lc-d">{n(stats.today)}</strong>
            <span>{t("studio.stats.today")}</span>
          </p>
          <p className="ds-hs g m-0">
            <strong className="lc-d">{n(stats.winners)}</strong>
            <span>{t("studio.stats.winners")}</span>
          </p>
        </div>
        <p className="ds-hint m-0">
          <span className="ds-hm" aria-hidden>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="7" y="3" width="10" height="18" rx="5" />
              <path d="M12 7v3" />
            </svg>
          </span>
          <span>
            <b>{t("studio.hintTitle")}</b> {t("studio.hintBody")}
          </span>
        </p>
      </div>

      {cols.length > 0 && (
        <div className="ds-hr" aria-hidden>
          {cols.map((col, i) => (
            <div key={i} className={i === 1 ? "ds-mq dn" : i === 2 ? "ds-mq s" : "ds-mq"}>
              {/* Each column twice, so the loop is seamless. */}
              {[...col, ...col].map((url, j) => (
                <span key={j} className="ds-mt">
                  <img src={url} alt="" loading="lazy" decoding="async" />
                </span>
              ))}
            </div>
          ))}
          {events.length > 0 && <StudioTicker events={events} />}
        </div>
      )}
    </section>
  );
}
