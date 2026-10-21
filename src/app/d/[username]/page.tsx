/* eslint-disable @next/next/no-img-element -- avatars and signed, short-lived storage links */
import { currentUsernameFor } from "@/lib/profile/usernames";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import "@/components/studio/studio.css";
import "@/components/designers/profile.css";
import { DesignerBadges } from "@/components/designers/badges";
import { ProfileEmailBar } from "@/components/designers/profile-email-bar";
import { ProfilePortfolio, type PortfolioTab } from "@/components/designers/profile-portfolio";
import { ProfileShareMenu } from "@/components/designers/profile-share-menu";
import { PageShell } from "@/components/ui/panel";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDate, timeAgo } from "@/lib/dates";
import { isLanguageKey, isSkillKey, isToolKey, levelPercent, SKILL_BARS_MAX, SKILL_LEVELS, toolTile } from "@/lib/designers/portfolio-options";
import { designerByUsername } from "@/lib/designers/profile";
import { designerProfileData } from "@/lib/designers/public-profile";
import { linkOrigin } from "@/lib/site-origin";
import { getI18n, pageAlternates } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";
import { championMonths } from "@/lib/rewards/queries";
import { openGraphFor } from "@/lib/seo";
import { getSetting } from "@/lib/settings";

export async function generateMetadata({ params }: PageProps<"/d/[username]">): Promise<Metadata> {
  const { username } = await params;
  const [{ t, locale }, designer] = await Promise.all([getI18n(), designerByUsername(username)]);
  if (!designer) return { title: t("notFound.title"), robots: { index: false } };
  const title = t("designerProfile.metaTitle", { name: designer.name });
  const path = `/d/${username.toLowerCase()}`;
  // Without a bio the page still has a description (QA, 2026-10-18).
  const description = designer.bio || t("designerProfile.metaDescription", { name: designer.name });
  return {
    title,
    description,
    alternates: await pageAlternates(path),
    openGraph: openGraphFor({ title, description, path, locale, images: designer.avatarUrl ? [designer.avatarUrl] : undefined }),
    ...(designer.isTest ? { robots: { index: false } } : {}),
  };
}

const ICON = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
/** Colours for the "Works most with" rows and the activity dots, in order. */
const PALETTE = [
  { bg: "#FBECEB", ink: "#8B0000", bar: "linear-gradient(90deg,#B3201B,#8B0000)" },
  { bg: "#E1EEFF", ink: "#1F4E8C", bar: "linear-gradient(90deg,#5B8FD8,#1F4E8C)" },
  { bg: "#FFF1DC", ink: "#9A5B00", bar: "linear-gradient(90deg,#F0C24F,#C98A0A)" },
  { bg: "#E3F5EF", ink: "#0F6B5E", bar: "linear-gradient(90deg,#4FC1A9,#0F7A73)" },
];
const EVENT_DOT = { sent: "#8B0000", won: "#D9A52B", rated: "#1F9D57" } as const;

/**
 * P-06 Designer profile (redesign owner 2026-10-12; Design/designer-profile). No contact details (BLUEPRINT §8.3) and
 * no money anywhere on this page. The owner sees Edit profile, the email bar and "View public profile" (?view=public
 * shows the page exactly as clients see it). Designs follow the same public rule as before: never a private or NDA
 * contest; in a blind contest only its public winner.
 */
export default async function DesignerProfilePage({ params, searchParams }: PageProps<"/d/[username]">) {
  const [{ username }, sp] = await Promise.all([params, searchParams]);
  const [{ t, locale }, designer, user] = await Promise.all([getI18n(), designerByUsername(username), getCurrentUser()]);
  if (!designer) {
    // An old username (a Pro designer changed theirs, or a client's was renewed): on to the new one (owner, 2026-10-15).
    const moved = await currentUsernameFor(username);
    if (moved) permanentRedirect(`/d/${moved}`);
    notFound();
  }
  const isOwnerUser = user?.id === designer.id;
  const owner = isOwnerUser && sp.view !== "public";
  const [data, champion, origin, codeLength] = await Promise.all([
    designerProfileData({ id: designer.id, username: designer.username, avatarUrl: designer.avatarUrl, winsCount: designer.stats.wins, skills: designer.skills, tools: designer.tools }),
    championMonths(designer.id),
    linkOrigin(),
    getSetting("auth.email_code_length"),
  ]);
  const url = `${origin}/d/${designer.username}`;
  const n = (v: number) => formatNumber(v, locale);
  const now = new Date();
  const { stats, extras } = data;

  const skillName = (k: string) => (isSkillKey(k) ? t(`portfolio.skills.${k}`) : k);
  const toolName = (k: string) => (isToolKey(k) ? t(`portfolio.tools.${k}`) : k);
  const langName = (k: string) => (isLanguageKey(k) ? t(`portfolio.languages.${k}`) : k);
  // Skills with a level become bars (highest first, at most 5); the rest are chips.
  const leveled = designer.skills
    .filter((k) => extras.skillLevels[k])
    .sort((a, b) => SKILL_LEVELS.indexOf(extras.skillLevels[b]) - SKILL_LEVELS.indexOf(extras.skillLevels[a]))
    .slice(0, SKILL_BARS_MAX);
  const chips = designer.skills.filter((k) => !leveled.includes(k));
  const topSkills = leveled.length > 0 ? [...leveled, ...chips] : designer.skills;

  const highlights = [
    data.latestWin ? "win" : null,
    topSkills.length > 0 ? "best" : null,
    extras.languages.length > 0 ? "speaks" : null,
  ].filter(Boolean);
  const tab: PortfolioTab = sp.tab === "wins" || sp.tab === "rated" ? sp.tab : "all";
  const ringDash = 2 * Math.PI * 16;

  const statCards = [
    { key: "wins", tone: "c1", value: n(stats.wins), icon: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" /> },
    { key: "designs", tone: "c2", value: n(stats.designs), icon: <path d="M8 8h11v11H8zM5 16V5h11" /> },
    { key: "contests", tone: "c3", value: n(stats.contests), icon: <path d="M4 5h16v11H8l-4 4z" /> },
    { key: "winRate", tone: "c4", value: `${n(stats.winRate)}%`, icon: null },
    { key: "rating", tone: "c5", value: stats.rating ? stats.rating.toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { maximumFractionDigits: 1 }) : "–", icon: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /> },
  ] as const;

  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-[1384px] flex-col gap-5">
        {isOwnerUser && !owner && (
          <p className="m-0 flex flex-wrap items-center justify-between gap-2 rounded-[18px] border border-[#F3D2CF] bg-[#FDF6F5] px-4 py-3 text-[15px] font-semibold text-[#7A1010]">
            {t("designerProfile.x.publicView")}
            <Link href={`/d/${designer.username}`} className="font-bold text-primary underline-offset-2 hover:underline">
              {t("designerProfile.x.backToOwn")}
            </Link>
          </p>
        )}
        {owner && user?.email && !user.emailVerifiedAt && <ProfileEmailBar email={user.email} length={codeLength} />}

        {/* ---------- Header ---------- */}
        <section className="dp-card dp-head" aria-labelledby="dp-name">
          <div className="dp-cov">
            <div className="dp-wmc" aria-hidden>
              <span className="dp-ws">✦</span>
              <span className="dp-wtx">logocontest.bd</span>
              <span className="dp-ws">✦</span>
            </div>
            <span className="dp-covt">
              <img src="/brand/logo-icon-tile.png" alt="" width={18} height={18} className="rounded-[5px]" />
              {t("designerProfile.x.coverTag")}
            </span>
          </div>

          <div className="dp-pin">
            <div className="dp-avw">
              <span className="dp-avr" aria-hidden />
              <span className="dp-avb">{designer.avatarUrl ? <img src={designer.avatarUrl} alt="" /> : designer.name.trim().slice(0, 1).toUpperCase()}</span>
            </div>
            <div className="dp-pnm">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
                <h1 id="dp-name" className="lc-d">
                  {designer.name}
                </h1>
                {data.verified && (
                  <span className="dp-vt" tabIndex={0} aria-label={t("designerProfile.x.verified")}>
                    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
                      <path fill="currentColor" d="M12 2l2.4 1.8 3-.2 1 2.8 2.6 1.6-.8 2.9.8 2.9-2.6 1.6-1 2.8-3-.2L12 22l-2.4-1.8-3 .2-1-2.8L3 16l.8-2.9L3 10.2l2.6-1.6 1-2.8 3 .2z" />
                      <path d="M8 12.2l2.6 2.6L16 9.4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{t("designerProfile.x.verified")}</span>
                  </span>
                )}
                <DesignerBadges top={designer.isTopDesigner} months={champion} t={t} locale={locale} />
                {designer.suspendedUntil && (
                  <span className="inline-flex min-h-8 items-center rounded-full bg-[#FFEDD5] px-3 text-sm font-bold text-[#9A3412]">
                    {t("designerProfile.suspended", { date: designer.suspendedUntil.toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }) })}
                  </span>
                )}
              </div>
              <div className="dp-pmeta">
                <span>@{designer.username}</span>
                <span>{t("designerProfile.x.memberSince", { date: formatDate(designer.memberSince, locale, "month") })}</span>
                {designer.experienceYears !== null && designer.experienceYears > 0 && (
                  <span>{designer.experienceYears === 1 ? t("designerProfile.x.experienceOne") : t("designerProfile.x.experience", { n: n(designer.experienceYears) })}</span>
                )}
                {data.activeToday && (
                  <span className="dp-onl">
                    <i aria-hidden />
                    {t("designerProfile.x.activeToday")}
                  </span>
                )}
              </div>
              {designer.bio && <p className="m-0 mt-1 max-w-[460px] whitespace-pre-line text-[16.5px] text-[#3A3C45]">{designer.bio}</p>}
            </div>

            <div className="dp-prt">
              <div className="dp-pac">
                {owner && (
                  <Link href="/dashboard/profile" className="dp-b2">
                    <svg {...ICON} width="18" height="18">
                      <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />
                    </svg>
                    {t("designerProfile.x.editProfile")}
                  </Link>
                )}
                <ProfileShareMenu url={url} name={designer.name} pdfHref={`/d/${designer.username}/portfolio`} publicHref={owner ? `/d/${designer.username}?view=public` : null} />
              </div>
              {highlights.length > 0 && (
                <div className="dp-phl" style={{ "--n": highlights.length } as React.CSSProperties}>
                  {data.latestWin && (
                    <Link href={`/d/${designer.username}?design=${data.latestWin.id}&file=1${sp.view === "public" ? "&view=public" : ""}`} scroll={false} className="dp-hlc lw">
                      <span className="dp-hlt">{data.latestWin.thumb && <img src={data.latestWin.thumb} alt="" loading="lazy" decoding="async" />}</span>
                      <span className="dp-hlx">
                        <em>{t("designerProfile.x.latestWin")}</em>
                        <b>{data.latestWin.brandName}</b>
                        <small>
                          {data.latestWin.entries > 0
                            ? t("designerProfile.x.winLine", { n: n(data.latestWin.entries), when: timeAgo(new Date(data.latestWin.at), now, locale) })
                            : timeAgo(new Date(data.latestWin.at), now, locale)}
                        </small>
                      </span>
                    </Link>
                  )}
                  {topSkills.length > 0 && (
                    <div className="dp-hlc">
                      <span className="dp-hli" aria-hidden>
                        <svg {...ICON} width="20" height="20">
                          <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
                        </svg>
                      </span>
                      <span className="dp-hlx">
                        <em>{t("designerProfile.x.bestAt")}</em>
                        <b>{skillName(topSkills[0])}</b>
                        <small>{topSkills[1] ? t("designerProfile.x.alsoGood", { skill: skillName(topSkills[1]) }) : t("designerProfile.x.setByDesigner")}</small>
                      </span>
                    </div>
                  )}
                  {extras.languages.length > 0 && (
                    <div className="dp-hlc sp">
                      <span className="dp-hli bg-[#CFF2EA] text-[#0F7A73]" aria-hidden>
                        <svg {...ICON} width="20" height="20">
                          <circle cx="12" cy="12" r="9" />
                          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                        </svg>
                      </span>
                      <span className="dp-hlx">
                        <em>{t("designerProfile.x.speaks")}</em>
                        <b>{extras.languages.map(langName).join(", ")}</b>
                        <small>{t("designerProfile.x.setByDesigner")}</small>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Five colourful stat cards. No money (owner, 2026-10-12). */}
          <div className="dp-sts">
            {statCards.map((s) => (
              <div key={s.key} className={`dp-stc ${s.tone}`}>
                {s.key === "winRate" ? (
                  <svg className="dp-ring" width="40" height="40" viewBox="0 0 40 40" aria-hidden>
                    <circle cx="20" cy="20" r="16" fill="none" stroke="rgb(255 255 255 / .25)" strokeWidth="5" />
                    <circle cx="20" cy="20" r="16" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeDasharray={ringDash} strokeDashoffset={ringDash * (1 - stats.winRate / 100)} transform="rotate(-90 20 20)" />
                  </svg>
                ) : (
                  <span className="dp-si" aria-hidden>
                    <svg {...ICON} width="20" height="20">
                      {s.icon}
                    </svg>
                  </span>
                )}
                <strong className="lc-d">{s.value}</strong>
                <span>{t(`designerProfile.x.stats.${s.key}` as MessageKey)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Portfolio and the right column ---------- */}
        <div className="dp-grid">
          <ProfilePortfolio designs={data.designs} username={designer.username} initialTab={tab} nowIso={now.toISOString()} />

          {(designer.skills.length > 0 || designer.tools.length > 0 || data.works.length > 0) && (
            <aside className="dp-sdw">
              {designer.skills.length > 0 && (
                <section className="dp-side" aria-labelledby="dp-skills">
                  <div className="dp-shd">
                    <h2 id="dp-skills" className="lc-d">
                      {t("designerProfile.x.skills")}
                    </h2>
                    <span>{t("designerProfile.x.setByDesigner")}</span>
                  </div>
                  {leveled.map((k) => (
                    <div key={k} className="dp-skl" tabIndex={0}>
                      <div>
                        {skillName(k)}
                        <em>{t(`portfolio.levels.${extras.skillLevels[k]}`)}</em>
                      </div>
                      <span className="dp-sbar" aria-hidden>
                        <i style={{ "--v": `${levelPercent(extras.skillLevels[k])}%` } as React.CSSProperties} />
                      </span>
                    </div>
                  ))}
                  {chips.length > 0 && (
                    <ul className="dp-chips">
                      {chips.map((k) => (
                        <li key={k} className="dp-chip">
                          {skillName(k)}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {designer.tools.length > 0 && (
                <section className="dp-side" aria-labelledby="dp-tools">
                  <div className="dp-shd">
                    <h2 id="dp-tools" className="lc-d">
                      {t("designerProfile.x.tools")}
                    </h2>
                    {Object.keys(extras.toolYears).length > 0 && <span>{t("designerProfile.x.toolsHint")}</span>}
                  </div>
                  <ul className="dp-tools">
                    {designer.tools.map((k) => {
                      const tile = toolTile(k);
                      const years = extras.toolYears[k];
                      return (
                        <li key={k} className="dp-tool" tabIndex={years !== undefined ? 0 : undefined}>
                          <b style={{ background: tile.bg, color: tile.ink }} aria-hidden>
                            {tile.code}
                          </b>
                          <span>{toolName(k)}</span>
                          {years !== undefined && years > 0 && <em>{years === 1 ? t("designerProfile.x.toolYear") : t("designerProfile.x.toolYears", { n: n(years) })}</em>}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {data.works.length > 0 && (
                <section className="dp-side" aria-labelledby="dp-works">
                  <div className="dp-shd">
                    <h2 id="dp-works" className="lc-d">
                      {t("designerProfile.x.worksWith")}
                    </h2>
                    <span>{t("designerProfile.x.worksWithSub")}</span>
                  </div>
                  {data.works.map((w, i) => {
                    const c = PALETTE[i % PALETTE.length];
                    const label = t(`wizard.businessTypes.${w.type}` as MessageKey);
                    return (
                      <div key={w.type} className="dp-ind" tabIndex={0}>
                        <span className="dp-indi" style={{ background: c.bg, color: c.ink }} aria-hidden>
                          {label.slice(0, 1)}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <div className="flex justify-between gap-2 text-[14.5px] font-bold">
                            <span className="truncate">{label}</span>
                            <span className="flex-none text-[12.5px] font-semibold text-[#5F626B]">{w.count === 1 ? t("designerProfile.x.contestOne") : t("designerProfile.x.contestsN", { n: n(w.count) })}</span>
                          </div>
                          <span className="dp-ibar" aria-hidden>
                            <i style={{ width: `${Math.max(8, Math.round((w.count / data.works[0].count) * 100))}%`, background: c.bar }} />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </section>
              )}
            </aside>
          )}
        </div>

        {/* ---------- Recent activity (real events) ---------- */}
        {data.activity.length > 0 && (
          <section className="dp-card px-6 py-5" aria-labelledby="dp-activity">
            <h2 id="dp-activity" className="lc-d m-0 mb-4 text-[19px] font-semibold tracking-[-0.02em]">
              {t("designerProfile.x.activity")}
            </h2>
            <ol className="dp-tl">
              {data.activity.map((e, i) => (
                <li key={`${e.kind}-${e.at}-${i}`}>
                  <span className="dp-evd" style={{ background: EVENT_DOT[e.kind] }} aria-hidden />
                  <span>
                    {e.kind === "rated" ? t("designerProfile.x.events.rated", { n: n(e.stars ?? 0), brand: e.brand }) : t(`designerProfile.x.events.${e.kind}`, { brand: e.brand })}
                    <span className="block text-[13px] text-[#5F626B]">{timeAgo(new Date(e.at), now, locale)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </PageShell>
  );
}
