/* eslint-disable @next/next/no-img-element -- signed, short-lived storage links */
import { currentUsernameFor } from "@/lib/profile/usernames";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ProfileShareMenu } from "@/components/designers/profile-share-menu";
import { Icon, ProBadge, SmallAvatar } from "@/components/pro/parts";
import { ProWorkspace } from "@/components/pro/workspace";
import { PageShell } from "@/components/ui/panel";
import "@/components/designers/profile.css";
import "@/components/pro/pro.css";
import "@/components/pro/pro-profile.css";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { isLanguageKey, isSkillKey, isToolKey } from "@/lib/designers/portfolio-options";
import { designerByUsername } from "@/lib/designers/profile";
import { designerProfileData } from "@/lib/designers/public-profile";
import { linkOrigin } from "@/lib/site-origin";
import { getI18n, pageAlternates } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";
import { proProfileExtras } from "@/lib/pro/profile";
import { isPro } from "@/lib/pro/status";
import { openGraphFor } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/designer/[username]">): Promise<Metadata> {
  const { username } = await params;
  const [{ t, locale }, designer] = await Promise.all([getI18n(), designerByUsername(username)]);
  if (!designer || !(await isPro(designer.id))) return { title: t("pro.profile.notPublicTitle"), robots: { index: false } };
  const title = t("designerProfile.metaTitle", { name: designer.name });
  const path = `/designer/${designer.username}`;
  // Without a bio the page still has a description (QA, 2026-10-18).
  const description = designer.bio || t("designerProfile.metaDescription", { name: designer.name });
  return { title, description, alternates: await pageAlternates(path), openGraph: openGraphFor({ title, description, path, locale, images: designer.avatarUrl ? [designer.avatarUrl] : undefined }) };
}

const TABS = ["work", "winners", "reviews", "about"] as const;
type Tab = (typeof TABS)[number];

// Pro public profile (owner, 2026-10-13; Design/pro/pro-public-profile.html): only for Pro designers; everyone else's
// link shows "This profile is not public". Real data only; no hiring: See winning designs and Share are the only
// actions, and the bottom card asks clients to start a contest.
export default async function ProProfilePage({ params, searchParams }: PageProps<"/designer/[username]">) {
  const [{ username }, sp] = await Promise.all([params, searchParams]);
  const [{ t, locale }, designer, viewer] = await Promise.all([getI18n(), designerByUsername(username), getCurrentUser()]);
  if (!designer) {
    // An old username (a Pro designer changed theirs, or a client's was renewed): on to the new one (owner, 2026-10-15).
    const moved = await currentUsernameFor(username);
    if (moved) permanentRedirect(`/designer/${moved}`);
    notFound();
  }
  if (!(await isPro(designer.id)))
    return (
      <PageShell>
        <div className="pr pp-np">
          <span className="pr-ic m" style={{ width: 64, height: 64, borderRadius: 20 }}>
            <Icon name="lock" size={28} />
          </span>
          <h1>{t("pro.profile.notPublicTitle")}</h1>
          <p>{t("pro.profile.notPublicLead")}</p>
          <Link href="/contests" className="pr-out">
            {t("pro.profile.back")}
          </Link>
        </div>
      </PageShell>
    );

  const data = await designerProfileData({ id: designer.id, username: designer.username, avatarUrl: designer.avatarUrl, winsCount: designer.stats.wins, skills: designer.skills, tools: designer.tools });
  const firstUrls = new Map(data.designs.filter((d) => d.files[0]).map((d) => [d.id, d.files[0].url]));
  const [extra, origin] = await Promise.all([proProfileExtras(designer.id, data.designs.map((d) => d.id), firstUrls), linkOrigin()]);
  const { stats } = data;
  const n = (v: number) => formatNumber(v, locale);
  const tab: Tab = TABS.find((x) => x === sp.tab) ?? "work";
  const skillName = (k: string) => (isSkillKey(k) ? t(`portfolio.skills.${k}`) : k);
  const toolName = (k: string) => (isToolKey(k) ? t(`portfolio.tools.${k}`) : k);
  const langName = (k: string) => (isLanguageKey(k) ? t(`portfolio.languages.${k}`) : k);
  const featured = new Set(extra.prefs.featuredEntryIds);
  const shown = data.designs.filter((d) => d.files[0]);
  const work = [...shown.filter((d) => featured.has(d.id)), ...shown.filter((d) => !featured.has(d.id))];
  const winners = shown.filter((d) => d.isWinner);
  const url = `${origin}/designer/${designer.username}`;
  const rows = [0, 1, 2, 3].map((r) => {
    const list = extra.cover.length ? extra.cover : [];
    const row = list.filter((_, i) => i % 4 === r);
    const base = row.length ? row : list;
    return base.length ? [...base, ...base, ...base, ...base].slice(0, 12) : [];
  });
  const stars = (v: number) => "★".repeat(Math.round(v)) + "☆".repeat(5 - Math.round(v));
  const tabLink = (x: Tab) => `/designer/${designer.username}${x === "work" ? "" : `?tab=${x}`}`;
  const count: Record<Tab, number | null> = { work: work.length + extra.portfolio.length, winners: stats.wins, reviews: extra.reviews.length, about: null };

  const designCard = (d: (typeof shown)[number]) => (
    <Link key={d.id} href={`/contest/${d.contestSlug}?tab=entries&entry=${d.number}`} className={`pp-sh${featured.has(d.id) ? " feat" : ""}`}>
      <div className="img">
        <img src={d.files[0].url} alt={d.brandName} loading="lazy" />
      </div>
      {d.isWinner && <span className="tag">{t("pro.profile.winner")}</span>}
      <div className="f">
        <span>{d.brandName}</span>
        {d.rating ? <span className="pp-stars">{"★".repeat(d.rating)}</span> : null}
      </div>
    </Link>
  );

  // Owner, 2026-10-16: a Pro designer opening their own profile keeps the workspace's left menu.
  const page = (
      <div className="pr pp">
        <section className="pp-cov" aria-label={t("pro.profile.coverNote")}>
          <div className="pp-wall" aria-hidden>
            {rows.map((row, i) => (
              <div key={i} className="pp-row">
                {row.map((src, j) => (
                  <span key={j}>
                    <img src={src} alt="" loading="lazy" />
                  </span>
                ))}
              </div>
            ))}
          </div>
          <span className="pp-tint" aria-hidden />
          <span className="pp-glass tl">{t("pro.profile.coverTag")}</span>
          <div className="pp-float">
            <span>
              <b>{n(stats.wins)}</b> {t(stats.wins === 1 ? "pro.profile.fWin" : "pro.profile.fWins")}
            </span>
            {stats.rating !== null && (
              <span>
                <b>{n(stats.rating)}</b> {t("pro.profile.fRating")}
              </span>
            )}
            <span>
              <b>{n(stats.contests)}</b> {t(stats.contests === 1 ? "pro.profile.fContest" : "pro.profile.fContests")}
            </span>
          </div>
          {extra.cover.length > 0 && <span className="pp-glass br">{t("pro.profile.coverNote")}</span>}
        </section>

        <section className="pp-id">
          <div className="pp-av">
            <span className="ring" aria-hidden />
            <span className="in">{designer.avatarUrl ? <img src={designer.avatarUrl} alt="" /> : designer.name.trim()[0]?.toUpperCase()}</span>
            <span className="rib">{extra.prefs.showBadge && <ProBadge size="sm" label={extra.trial ? t("pro.trial.badge") : undefined} />}</span>
          </div>
          <div className="pp-nm">
            <h1>{designer.name}</h1>
            <div className="pp-meta">
              <span>@{designer.username}</span>
              {extra.prefs.title && <span>{extra.prefs.title}</span>}
              {extra.proSince && <span>{t("pro.profile.since", { date: formatDate(extra.proSince, locale, "month") })}</span>}
              {data.activeToday && <span className="on">● {t("pro.profile.activeToday")}</span>}
            </div>
            {designer.bio && <p style={{ color: "#3A3C45", maxWidth: 640 }}>{designer.bio}</p>}
            {designer.skills.length > 0 && (
              <div className="pp-best">
                <span>{t("pro.profile.bestAt")}</span>
                {designer.skills.slice(0, 4).map((k) => (
                  <em key={k}>{skillName(k)}</em>
                ))}
              </div>
            )}
          </div>
          <div className="pp-act">
            <Link href={tabLink("winners")} className="pr-btn">
              <Icon name="trophy" />
              {t("pro.profile.seeWinners")}
            </Link>
            <ProfileShareMenu url={url} name={designer.name} pdfHref={`/d/${designer.username}/portfolio`} publicHref={null} />
          </div>
        </section>

        <div className="pp-st">
          <div className="pp-sx">
            <span className="pr-ic g">
              <Icon name="trophy" />
            </span>
            <div>
              <b>{n(stats.wins)}</b>
              <span>{t("pro.profile.sWins")}</span>
              <em>{t("pro.profile.sWinsSub", { n: n(stats.contests) })}</em>
            </div>
          </div>
          <div className="pp-sx">
            <span className="pr-ic m">
              <Icon name="chart" />
            </span>
            <div>
              <b>{n(stats.winRate)}%</b>
              <span>{t("pro.profile.sRate")}</span>
              <em>{t("pro.profile.sRateSub")}</em>
            </div>
          </div>
          <div className="pp-sx">
            <span className="pr-ic w">
              <Icon name="star" />
            </span>
            <div>
              <b>{stats.rating === null ? "—" : n(stats.rating)}</b>
              <span>{t("pro.profile.sRating")}</span>
              <em>{stats.rating === null ? t("pro.profile.sRatingNone") : stats.rated === 1 ? t("pro.profile.sRatingSubOne") : t("pro.profile.sRatingSub", { n: n(stats.rated) })}</em>
            </div>
          </div>
          <div className="pp-sx">
            <span className="pr-ic b">
              <Icon name="image" />
            </span>
            <div>
              <b>{n(stats.designs)}</b>
              <span>{t("pro.profile.sDesigns")}</span>
              <em>{stats.contests === 1 ? t("pro.profile.sDesignsSubOne") : t("pro.profile.sDesignsSub", { n: n(stats.contests) })}</em>
            </div>
          </div>
        </div>

        <nav className="pp-tabs" aria-label={t("pro.profile.about")}>
          {TABS.map((x) => (
            <Link key={x} href={tabLink(x)} className={tab === x ? "on" : undefined} aria-current={tab === x ? "page" : undefined} scroll={false}>
              {t(`pro.profile.tabs.${x}`)}
              {count[x] !== null && <em>{n(count[x]!)}</em>}
            </Link>
          ))}
        </nav>

        {tab === "work" &&
          (work.length + extra.portfolio.length === 0 ? (
            <p className="pr-empty">{t("pro.profile.noWork")}</p>
          ) : (
            <section className="pp-grid">
              {work.map(designCard)}
              {extra.portfolio.map((it) => (
                <div key={it.id} className="pp-sh">
                  <div className="img">{it.url && <img src={it.url} alt={it.title} loading="lazy" />}</div>
                  <span className="tag own">{t("pro.profile.own")}</span>
                  <div className="f">
                    <span>{it.title || t("pro.profile.own")}</span>
                  </div>
                </div>
              ))}
            </section>
          ))}
        {tab === "winners" && (winners.length === 0 ? <p className="pr-empty">{t("pro.profile.noWinners")}</p> : <section className="pp-grid">{winners.map(designCard)}</section>)}
        {tab === "reviews" && (
          <section className="pr-card">
            <h2>{t("pro.profile.reviews")}</h2>
            {extra.reviews.length === 0 && <p className="pr-empty" style={{ marginTop: 12 }}>{t("pro.profile.noReviews")}</p>}
            {extra.reviews.map((r, i) => (
              <div key={i} className="pp-rv" style={{ marginTop: i === 0 ? 12 : 0 }}>
                <div className="h">
                  <SmallAvatar name={r.client} url={null} />
                  <div>
                    <b>{r.client}</b>
                    <em>
                      {r.brand ? `${r.brand} · ` : ""}
                      {r.at ? formatDate(new Date(r.at), locale, "short") : ""}
                    </em>
                  </div>
                  <span className="pp-stars" aria-label={t("pro.profile.stars", { n: n(r.stars) })}>
                    {stars(r.stars)}
                  </span>
                </div>
                {r.text && <p>{r.text}</p>}
              </div>
            ))}
          </section>
        )}

        {(tab === "about" || tab === "work") && (
          <div className="pp-low">
            <section className="pr-card">
              <h2>{t("pro.profile.about")}</h2>
              <div className="pp-kv">
                {designer.bio && <p>{designer.bio}</p>}
                {designer.skills.length > 0 && (
                  <div>
                    <span>{t("pro.profile.skills")}</span>
                    <div className="pp-chips">
                      {designer.skills.map((k) => (
                        <em key={k}>{skillName(k)}</em>
                      ))}
                    </div>
                  </div>
                )}
                {designer.tools.length > 0 && (
                  <div>
                    <span>{t("pro.profile.tools")}</span>
                    <p>{designer.tools.map(toolName).join(" · ")}</p>
                  </div>
                )}
                {data.works.length > 0 && (
                  <div>
                    <span>{t("pro.profile.works")}</span>
                    <div className="pp-chips">
                      {data.works.map((w) => (
                        <em key={w.type}>{t(`wizard.businessTypes.${w.type}` as MessageKey)}</em>
                      ))}
                    </div>
                  </div>
                )}
                {data.extras.languages.length > 0 && (
                  <div>
                    <span>{t("pro.profile.speaks")}</span>
                    <p>{data.extras.languages.map(langName).join(", ")}</p>
                  </div>
                )}
                {extra.contact && (extra.contact.email || extra.contact.mobile) && (
                  <div>
                    <span>{t("pro.profile.contact")}</span>
                    <p>{[extra.contact.mobile, extra.contact.email].filter(Boolean).join(" · ")}</p>
                  </div>
                )}
              </div>
            </section>
            <section className="pp-hire">
              <ProBadge light />
              <h2 style={{ fontSize: 24 }}>{t("pro.profile.hireTitle")}</h2>
              <p>{t("pro.profile.hireLead")}</p>
              <Link href="/start" className="pr-white">
                {t("pro.profile.start")}
              </Link>
              <div className="s">
                <span>{stats.contests === 1 ? t("pro.profile.joinedOne") : t("pro.profile.joined", { n: n(stats.contests) })}</span>
                <span>{stats.wins === 1 ? t("pro.profile.winsLineOne") : t("pro.profile.winsLine", { n: n(stats.wins) })}</span>
              </div>
            </section>
          </div>
        )}
      </div>
  );
  if (viewer && viewer.id === designer.id)
    return (
      <ProWorkspace user={viewer} active="profile">
        {page}
      </ProWorkspace>
    );
  return <PageShell>{page}</PageShell>;
}
