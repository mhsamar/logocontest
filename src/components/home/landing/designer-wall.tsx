/* eslint-disable @next/next/no-img-element -- avatars come from /api/avatar (a small WebP the CDN keeps) */
import Link from "@/components/ui/link";
import { cx } from "@/lib/cx";
import { copiesFor, designerWall, type WallCard } from "@/lib/home/designer-wall";
import { getI18n } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import "./wall.css";

function Arrow() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** One designer: photo (or initials on a tint), "Just joined" on the newest three, the name and when they joined. */
function Card({ d, t, copy }: { d: WallCard; t: Translate; copy: boolean }) {
  return (
    <li className="lc-dw-item">
      <Link href={`/d/${d.username}`} className="lc-dw-card" tabIndex={copy ? -1 : undefined}>
        <span className={`lc-dw-ph lc-dw-t${d.tone}`}>
          {d.photo ? (
            <img src={d.photo} alt="" width={180} height={150} loading="lazy" decoding="async" className="lc-dw-img" />
          ) : (
            <span className="lc-dw-ini" aria-hidden>
              {d.initials}
            </span>
          )}
          {d.fresh && <span className="lc-dw-new">{t("home2.wall.justJoined")}</span>}
        </span>
        <span className="lc-dw-body">
          <strong className="lc-dw-name">{d.name}</strong>
          <span className="lc-dw-when">{t(d.ago.key, { n: d.ago.n })}</span>
        </span>
      </Link>
    </li>
  );
}

/**
 * One moving row: the list drawn enough times to fill a wide screen, then all of that again, so moving the track by
 * half loops without a jump. Only the first list is read out and reachable with Tab; the copies are hidden from both.
 */
function Row({ row, t, reverse }: { row: WallCard[]; t: Translate; reverse: boolean }) {
  const lists = copiesFor(row.length) * 2;
  return (
    <div className="lc-dw-mq">
      <div className={cx("lc-dw-tr", reverse && "lc-dw-rev")}>
        {Array.from({ length: lists }, (_, i) => (
          <ul key={i} className={cx("lc-dw-list", i > 0 && "lc-dw-dup")} aria-hidden={i > 0 || undefined}>
            {row.map((d) => (
              <Card key={d.username} d={d} t={t} copy={i > 0} />
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

/**
 * "Bangladesh's best designers are joining every day" (owner, 2026-10-29; Design/logocontest-site/index.html,
 * #live-designers): the newest designers in two rows moving in opposite directions, pure CSS (they stop under the
 * mouse or keyboard focus, and stand still for people who turn motion off). Each card opens the designer's public
 * profile. The design's second line is a city; the site stores none, so it says when they joined. Hidden while
 * fewer than WALL_MIN designers have joined (src/lib/home/designer-wall.ts).
 */
export async function DesignerWall() {
  const [{ t }, rows] = await Promise.all([getI18n(), designerWall()]);
  if (!rows) return null;
  return (
    <section id="live-designers" className="lc-dw" aria-labelledby="lc-dw-title">
      <div className="lc-dw-head">
        <div className="lc-dw-intro">
          <span className="lc-dw-live">
            <span className="lc-dw-dot" aria-hidden />
            {t("home2.wall.live")}
          </span>
          <h2 id="lc-dw-title" className="lc-dw-title">
            {t("home2.wall.titleLead")} <span className="lc-dw-accent">{t("home2.wall.titleAccent")}</span>
          </h2>
          <p className="lc-dw-lead">{t("home2.wall.lead")}</p>
        </div>
        <Link href="/designers/signup" className="lc-dw-join">
          {t("nav.becomeDesigner")}
          <Arrow />
        </Link>
      </div>
      <div className="lc-dw-rows">
        {rows.map((row, r) => (
          <Row key={r} row={row} t={t} reverse={r === 1} />
        ))}
      </div>
    </section>
  );
}
