import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell } from "@/components/ui/panel";
import { ShareProfileButton } from "@/components/designers/share-profile-button";
import { Avatar } from "@/components/ui/avatar";
import { WinnerTrophy } from "@/components/ui/trophy";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/dates";
import { isSkillKey, isToolKey } from "@/lib/designers/portfolio-options";
import { designerByUsername, publicDesigns } from "@/lib/designers/profile";
import { siteOrigin } from "@/lib/email";
import { DesignerBadges } from "@/components/designers/badges";
import { getI18n } from "@/lib/i18n/server";
import { championMonths } from "@/lib/rewards/queries";
import { openGraphFor } from "@/lib/seo";
import { formatNumber, formatTaka } from "@/lib/money";
import { qrSvg } from "@/lib/profile/qr";

export async function generateMetadata({ params }: PageProps<"/d/[username]">): Promise<Metadata> {
  const { username } = await params;
  const [{ t, locale }, designer] = await Promise.all([getI18n(), designerByUsername(username)]);
  if (!designer) return { title: t("notFound.title"), robots: { index: false } };
  const title = t("designerProfile.metaTitle", { name: designer.name });
  const path = `/d/${username.toLowerCase()}`;
  return {
    title,
    description: designer.bio ?? undefined,
    alternates: { canonical: path },
    openGraph: openGraphFor({ title, description: designer.bio ?? undefined, path, locale, images: designer.avatarUrl ? [designer.avatarUrl] : undefined }),
  };
}

// P-06 Designer public profile. No contact details anywhere (BLUEPRINT §8.3).
export default async function DesignerProfilePage({ params, searchParams }: PageProps<"/d/[username]">) {
  const [{ username }, sp] = await Promise.all([params, searchParams]);
  const [{ t, locale }, designer] = await Promise.all([getI18n(), designerByUsername(username)]);
  const champion = designer ? await championMonths(designer.id) : [];
  if (!designer) notFound();
  const url = `${await siteOrigin()}/d/${designer.username}`;
  const qr = await qrSvg(url);
  const designs = await publicDesigns(designer.id);
  const wins = designs.filter((d) => d.isWinner);
  // With no wins yet, open on all designs so the profile isn't empty.
  const tab = sp.tab === "all" || (sp.tab !== "wins" && wins.length === 0) ? "all" : "wins";
  const shown = tab === "wins" ? wins : designs;

  const stats = [
    { value: formatNumber(designer.stats.wins, locale), label: t("designerProfile.wins") },
    { value: formatNumber(designer.stats.designs, locale), label: t("designerProfile.designs") },
    { value: formatTaka(designer.stats.totalEarned, locale), label: t("designerProfile.earned"), accent: true },
  ];

  return (
    <PageShell>
      <section className="relative overflow-hidden rounded-[32px] bg-surface max-[720px]:rounded-[24px]">
        <div className="h-24 bg-[image:var(--gradient-red-dark)] sm:h-32" aria-hidden />
        <div className="px-5 pb-8 sm:px-10">
          {/* Only the photo rises over the banner; the name sits fully below it. */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <Avatar name={designer.name} url={designer.avatarUrl} tone="cream" className="-mt-12 size-24 text-3xl ring-4 ring-surface sm:-mt-14 sm:size-28" />
              <div className="min-w-0 pt-3">
                <h1 className="m-0 truncate text-[clamp(28px,3.4vw,42px)] font-semibold leading-tight tracking-[-0.04em] text-ink">{designer.name}</h1>
                <p className="m-0 text-[15px] font-semibold text-muted">@{designer.username}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:pt-3">
              <a
                href={`/d/${designer.username}/portfolio`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] border border-line bg-surface px-[18px] text-[15px] font-bold text-ink transition-colors hover:bg-chip"
              >
                <svg viewBox="0 0 24 24" className="size-4 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
                </svg>
                {t("portfolio.downloadPdf")}
              </a>
              <ShareProfileButton url={url} qrSvg={qr} qrDownloadHref={`/d/${designer.username}/qr?download=1`} name={designer.name} />
            </div>
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-2 lg:gap-10">
            <div className="min-w-0">
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <DesignerBadges top={designer.isTopDesigner} months={champion} t={t} locale={locale} />
              <span className="text-sm text-muted">{t("dashboard.memberSince", { date: formatDate(designer.memberSince, locale, "month") })}</span>
            </div>
            {designer.bio && <p className="mt-3 max-w-2xl whitespace-pre-line leading-relaxed text-ink">{designer.bio}</p>}

            <dl className="mt-5 grid max-w-xl grid-cols-3 gap-3">
              {stats.map((s) => (
                <div key={s.label} className="flex flex-col-reverse rounded-[20px] bg-frame px-3 py-3.5 text-center sm:px-4">
                  <dt className="mt-0.5 text-sm text-muted">{s.label}</dt>
                  <dd className={`lc-d m-0 truncate text-xl font-semibold tabular-nums tracking-[-0.03em] sm:text-3xl ${s.accent ? "text-primary" : "text-ink"}`}>{s.value}</dd>
                </div>
              ))}
            </dl>
            </div>

            {/* Portfolio (owner, 2026-10-08): experience, skills and tools */}
            {(designer.experienceYears !== null || designer.skills.length > 0 || designer.tools.length > 0) && (
              <div className="space-y-4 rounded-[24px] bg-frame p-5 sm:p-6 lg:mt-0">
                {designer.experienceYears !== null && (
                  <div>
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">{t("portfolio.experienceLabel")}</p>
                    <p className="lc-d m-0 mt-1 text-2xl font-semibold tracking-[-0.03em] text-ink">
                      {designer.experienceYears === 0
                        ? t("portfolio.newcomer")
                        : designer.experienceYears === 1
                          ? t("portfolio.oneYear")
                          : t("portfolio.years", { n: formatNumber(designer.experienceYears, locale) })}
                    </p>
                  </div>
                )}
                {designer.skills.length > 0 && (
                  <div>
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">{t("portfolio.skillsTitle")}</p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {designer.skills.map((k) => (
                        <li key={k} className="rounded-full bg-tint px-3 py-1 text-sm font-semibold text-primary">
                          {isSkillKey(k) ? t(`portfolio.skills.${k}`) : k}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {designer.tools.length > 0 && (
                  <div>
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">{t("portfolio.toolsTitle")}</p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {designer.tools.map((k) => (
                        <li key={k} className="rounded-full bg-surface px-3 py-1 text-sm font-semibold text-ink">
                          {isToolKey(k) ? t(`portfolio.tools.${k}`) : k}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[32px] bg-surface p-5 sm:p-8 lg:p-10 max-[720px]:rounded-[24px]">
      <nav aria-label={t("designerProfile.tabsLabel")}>
        <ul className="m-0 flex w-max list-none gap-1 rounded-[18px] bg-chip p-1">
          {(["wins", "all"] as const).map((key) => (
            <li key={key}>
              <a
                href={`/d/${designer.username}?tab=${key}`}
                aria-current={tab === key ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-[14px] px-4 text-[15px] font-semibold transition-colors ${tab === key ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
              >
                {t(key === "wins" ? "designerProfile.tabWins" : "designerProfile.tabAll")}
                <span className={`ml-2 rounded-full px-1.5 text-xs tabular-nums ${tab === key ? "bg-white/15" : "bg-white"}`}>{formatNumber(key === "wins" ? wins.length : designs.length, locale)}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {shown.length > 0 ? (
        <ul className="m-0 mt-7 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 sm:gap-3.5 lg:grid-cols-4">
          {shown.map((d) => (
            <li key={`${d.contestSlug}-${d.number}`} className="lc-rv">
              <Link
                href={`/contest/${d.contestSlug}?tab=entries&entry=${d.number}`}
                className={cx("lc-card group relative block p-2 transition-shadow hover:shadow-card", d.isWinner && "!border-2 !border-primary")}
              >
                <div className="relative aspect-square overflow-hidden rounded-[20px] bg-tile">
                  {d.coverUrl && (
                    // Preview from storage
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.coverUrl} alt={t("entry.title", { n: formatNumber(d.number, locale) })} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                  )}
                  {d.isWinner && (
                    <>
                      <span className="absolute left-2 top-2 rounded-full bg-gold px-2.5 py-1 text-[13px] font-bold text-gold-ink">{t("entry.winner")}</span>
                      <WinnerTrophy size="sm" className="absolute right-2 top-2" />
                    </>
                  )}
                </div>
                <div className="px-2 pb-1.5 pt-3">
                  <p className="m-0 truncate font-semibold text-ink group-hover:text-primary">{d.brandName}</p>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted">
                    <span>#{formatNumber(d.number, locale)} · {d.imageCount === 1 ? t("entry.oneMockup") : t("entry.mockups", { n: formatNumber(d.imageCount, locale) })}</span>
                    {d.rating ? (
                      <span className="flex gap-0.5" aria-label={`${d.rating}/5`}>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <svg key={i} viewBox="0 0 20 20" className={cx("size-3", i <= d.rating! ? "text-accent" : "text-line")} fill="currentColor" aria-hidden>
                            <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.8l-5.2 2.8 1-5.8L1.5 7.7l5.9-.9Z" />
                          </svg>
                        ))}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mx-auto mt-8 max-w-xl">
          <EmptyState title={t(tab === "wins" ? "designerProfile.noWins" : "designerProfile.noDesigns")} />
        </div>
      )}
      </section>
    </PageShell>
  );
}
