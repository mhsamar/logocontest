import Link from "@/components/ui/link";
import { getI18n } from "@/lib/i18n/server";

function CardArrow() {
  return (
    <i>
      <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </i>
  );
}

/** The letter tiles on the contest card: decoration only, not real logos (owner, 2026-10-12). */
const TILES = [
  { l: "N", bg: "#FFFFFF", fg: "#1F6B3A" },
  { l: "S", bg: "#FFE27A", fg: "#8B0000" },
  { l: "M", bg: "#1F4E8C", fg: "#FFFFFF" },
  { l: "K", bg: "#111216", fg: "#FFE27A" },
];

/**
 * The two ways in (owner, 2026-10-12; Design/home-cta/home-two-cards.html): two short coloured cards, each one a
 * link. Run a contest (maroon, letter tiles that fan out on hover) and join as a designer (cream gold, a profile
 * card with a QR code and a trophy). The pictures hide under 720px.
 */
export async function Join() {
  const { t } = await getI18n();
  return (
    <section id="join" className="lc-j2">
      <div className="lc-rv">
        <Link href="/start" className="lc-jc lc-jc-l">
          <div className="lc-jtx">
            <span className="lc-jk">{t("home.ways.contest.label")}</span>
            <h2>{t("home.ways.contest.title")}</h2>
            <p>{t("home.ways.contest.body")}</p>
            <span className="lc-jbt">
              {t("home.ways.contest.cta")}
              <CardArrow />
            </span>
          </div>
          <div className="lc-jvz" aria-hidden>
            {TILES.map((x, i) => (
              <span key={x.l} className={`lc-jt lc-jt${i + 1}`} style={{ background: x.bg, color: x.fg }}>
                {x.l}
              </span>
            ))}
            <span className="lc-jcount">{t("home.ways.contest.ideas")}</span>
          </div>
        </Link>
      </div>
      <div className="lc-rv">
        <Link href="/designers/signup" className="lc-jc lc-jc-r">
          <div className="lc-jtx">
            <span className="lc-jk">{t("home.ways.designer.label")}</span>
            <h2>{t("nav.becomeDesigner")}</h2>
            <p>{t("home.ways.designer.body")}</p>
            <span className="lc-jbt">
              {t("home.ways.designer.cta")}
              <CardArrow />
            </span>
          </div>
          <div className="lc-jvz" aria-hidden>
            <span className="lc-jpc">
              <span className="lc-jav">D</span>
              <span className="lc-jl1" />
              <span className="lc-jl2" />
              <span className="lc-jqr">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="#111216">
                  <path d="M3 3h7v7H3zM5 5v3h3V5zM14 3h7v7h-7zM16 5v3h3V5zM3 14h7v7H3zM5 16v3h3v-3zM14 14h3v3h-3zM18 14h3v3h-3zM14 18h3v3h-3zM18 18h3v3h-3z" />
                </svg>
              </span>
            </span>
            <span className="lc-jtro">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#3A2A00" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4c0 3 1.5 4.5 3.5 4.5M17 6h3c0 3-1.5 4.5-3.5 4.5M12 14v4M8.5 20h7" />
              </svg>
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}
