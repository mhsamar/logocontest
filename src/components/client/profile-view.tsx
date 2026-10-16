/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { ClientProfileData } from "@/lib/client/workspace";
import { formatDate } from "@/lib/dates";
import type { Locale } from "@/lib/i18n/config";
import type { Translate } from "@/lib/i18n/translate";
import { formatNumber, formatTaka } from "@/lib/money";
import { CwIcon } from "./icons";
import { Empty, Picture } from "./parts";
import { PrivacySwitch, ShareProfileButton } from "./profile-bits";

export const PROFILE_TABS = ["winners", "contests"] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];
export const profileTab = (v: unknown): ProfileTab => (PROFILE_TABS as readonly unknown[]).includes(v) ? (v as ProfileTab) : "winners";

/**
 * The premium client profile (owner, 2026-10-16; Design/client-premium/client-profile.html, CLIENT-HANDOFF §6): a cover
 * made from the client's winning logos, "Verified client" only when the email was confirmed, counts, winning logos and
 * contests. Designers see business name, logo, contests and winning logos only: never phone, email or payment details.
 * The owner also gets Start a contest and the privacy switch. ("What designers say" and "Rating from designers" are
 * left out: the site has no designer reviews of clients.)
 */
export function ClientProfileView({ p, owner, tab, base, publicUrl, t, locale }: { p: ClientProfileData; owner: boolean; tab: ProfileTab; base: string; publicUrl: string; t: Translate; locale: Locale }) {
  const num = (n: number) => formatNumber(n, locale);
  const wall = p.winners.length ? p.winners.map((w) => w.url) : p.contests.map((c) => c.cover).filter((x): x is string => !!x);
  const tiles = wall.length ? Array.from({ length: 6 }, (_, i) => wall[i % wall.length]) : [];
  const stats = [
    { icon: "trophy" as const, value: num(p.stats.contests), label: t("cw.profile.statContests") },
    { icon: "card" as const, value: formatTaka(p.stats.prizes, locale), label: t("cw.profile.statPrizes") },
    { icon: "user" as const, value: num(p.stats.designers), label: t("cw.profile.statDesigners") },
    { icon: "clock" as const, value: p.stats.avgPickDays === null ? "—" : p.stats.avgPickDays < 1 ? t("cw.profile.underDay") : t("cw.profile.days", { n: num(p.stats.avgPickDays) }), label: t("cw.profile.statPick") },
  ];
  return (
    <>
      <section className={`cpc${tiles.length ? "" : " plain"}`} data-profile-cover>
        {tiles.length > 0 && (
          <div className="cpw" aria-hidden>
            {tiles.map((src, i) => (
              <span key={i} className={`cpt t${i}`}>
                <img src={src} alt="" loading="lazy" />
              </span>
            ))}
          </div>
        )}
        <span className="cpsh" />
        <div className="cpid">
          <span className="cplg">
            <span className="dring" />
            {p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : <b>{p.business.trim().slice(0, 1).toUpperCase()}</b>}
            {p.verified && (
              <i>
                <CwIcon name="check" size={12} strokeWidth={3} />
              </i>
            )}
          </span>
          <div>
            <div className="dnl">
              <h1>{p.business}</h1>
              {p.verified && (
                <span className="cvf" data-verified>
                  <CwIcon name="shield" size={13} />
                  {t("cw.profile.verified")}
                </span>
              )}
            </div>
            <p>
              {p.businessType ? `${t(`wizard.businessTypes.${p.businessType}` as Parameters<Translate>[0])} · ` : ""}
              {t("cw.profile.since", { date: formatDate(p.memberSince, locale, "month") })}
            </p>
          </div>
          <div className="cpbt">
            {owner && (
              <Link href="/start" className="dbtn">
                <CwIcon name="plus" />
                {t("cw.menu.start")}
              </Link>
            )}
            <ShareProfileButton url={publicUrl} title={p.business} />
          </div>
        </div>
      </section>

      <div className="cps four" data-profile-stats>
        {stats.map((s) => (
          <div key={s.label} className="cpk">
            <span>
              <CwIcon name={s.icon} size={18} />
            </span>
            <b>{s.value}</b>
            <em>{s.label}</em>
          </div>
        ))}
      </div>

      <nav className="dtabs cpn" aria-label={t("cw.profile.tabsLabel")}>
        {PROFILE_TABS.map((k) => (
          <Link key={k} href={k === "winners" ? base : `${base}?tab=${k}`} className={k === tab ? "on" : undefined} aria-current={k === tab ? "page" : undefined} scroll={false}>
            {t(`cw.profile.tabs.${k}`)} <em>{num(k === "winners" ? p.winners.length : p.contests.length)}</em>
          </Link>
        ))}
      </nav>

      {tab === "winners" && (
        <section className="cpp on">
          {p.winners.length === 0 ? (
            <Empty title={t("cw.profile.noWinners")} lead={owner ? t("cw.profile.noWinnersOwner") : undefined} />
          ) : (
            <div className="cwg">
              {p.winners.map((w) => (
                <figure key={w.slug} className="cwl">
                  <div>
                    <img src={w.url} alt={w.brand} loading="lazy" />
                    <span className="dwin">
                      <CwIcon name="trophy" size={12} />
                      {t("entry.winner")}
                    </span>
                  </div>
                  <figcaption>
                    <b>{w.brand}</b>
                    <em>{t("cw.profile.byDesigner", { name: w.designer, date: formatDate(w.at, locale, "month") })}</em>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "contests" && (
        <section className="cpp on">
          {p.contests.length === 0 ? (
            <Empty title={t("cw.profile.noContests")} />
          ) : (
            <div className="ctl">
              {p.contests.map((c) => (
                <Link key={c.slug} href={`/contest/${c.slug}`} className="ctr2">
                  <span className="psvi sm2">
                    <Picture url={c.cover} name={c.brand} />
                  </span>
                  <div>
                    <b>{c.brand}</b>
                    <em>
                      {t(`wizard.businessTypes.${c.businessType}` as Parameters<Translate>[0])} · {formatTaka(c.prize, locale)} · {t("cw.home.designsN", { n: num(c.entries) })}
                    </em>
                  </div>
                  <span className={`pss ${c.status === "open" ? "op" : "win"}`}>{t(`cw.status.${c.status}` as Parameters<Translate>[0])}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {owner && (
        <section className="cpv" data-privacy-card>
          <div>
            <b>
              <CwIcon name="lock" size={16} /> {t("cw.profile.privacy")}
            </b>
            <em>{t("cw.profile.privacyLead")}</em>
          </div>
          <PrivacySwitch shown={!p.hidden} />
        </section>
      )}
    </>
  );
}
