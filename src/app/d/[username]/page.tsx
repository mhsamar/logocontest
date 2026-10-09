import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
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
    <div className="mx-auto w-full max-w-page px-4 pb-16 pt-4">
      <section className="relative overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line">
        <div className="bg-aurora h-24 sm:h-32" aria-hidden />
        <div className="px-5 pb-6 sm:px-8">
          {/* Only the photo rises over the banner; the name sits fully below it. */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <Avatar name={designer.name} url={designer.avatarUrl} tone="cream" className="-mt-12 size-24 text-3xl ring-4 ring-surface sm:-mt-14 sm:size-28" />
              <div className="min-w-0 pt-3">
                <h1 className="truncate text-h2 font-bold leading-tight text-ink lg:text-h2-lg">{designer.name}</h1>
                <p className="font-mono text-sm text-muted">@{designer.username}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:pt-3">
              <a
                href={`/d/${designer.username}/portfolio`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-surface px-5 font-semibold text-ink ring-1 ring-inset ring-line transition-colors hover:ring-primary"
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
                <div key={s.label} className="flex flex-col-reverse rounded-xl bg-canvas px-3 py-3 text-center sm:px-4">
                  <dt className="mt-0.5 text-xs text-muted">{s.label}</dt>
                  <dd className={`truncate text-lg font-bold tabular-nums sm:text-2xl ${s.accent ? "text-accent" : "text-ink"}`}>{s.value}</dd>
                </div>
              ))}
            </dl>
            </div>

            {/* Portfolio (owner, 2026-10-08): experience, skills and tools */}
            {(designer.experienceYears !== null || designer.skills.length > 0 || designer.tools.length > 0) && (
              <div className="space-y-4 rounded-2xl bg-gradient-to-br from-white to-canvas p-4 ring-1 ring-line sm:p-5 lg:mt-0">
                {designer.experienceYears !== null && (
                  <div>
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted">{t("portfolio.experienceLabel")}</p>
                    <p className="mt-1 text-2xl font-bold text-ink">
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
                        <li key={k} className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary-dark">
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
                        <li key={k} className="rounded-full bg-surface px-3 py-1 text-sm font-medium text-ink ring-1 ring-line">
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

      <nav aria-label={t("designerProfile.tabsLabel")} className="mt-8 border-b border-line">
        <ul className="flex gap-6">
          {(["wins", "all"] as const).map((key) => (
            <li key={key}>
              <a
                href={`/d/${designer.username}?tab=${key}`}
                aria-current={tab === key ? "page" : undefined}
                className={`-mb-px flex min-h-11 items-center border-b-2 text-sm font-semibold ${tab === key ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"}`}
              >
                {t(key === "wins" ? "designerProfile.tabWins" : "designerProfile.tabAll")}
                <span className="ml-2 rounded-full bg-canvas px-1.5 text-xs tabular-nums text-muted">{formatNumber(key === "wins" ? wins.length : designs.length, locale)}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {shown.length > 0 ? (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {shown.map((d) => (
            <li key={`${d.contestSlug}-${d.number}`}>
              <Link
                href={`/contest/${d.contestSlug}?tab=entries&entry=${d.number}`}
                className={cx("group relative block overflow-hidden rounded-xl bg-surface shadow-card ring-1 transition-shadow hover:shadow-raised", d.isWinner ? "ring-2 ring-primary" : "ring-line hover:ring-primary")}
              >
                <div className="relative aspect-square bg-canvas">
                  {d.coverUrl && (
                    // Preview from storage
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.coverUrl} alt={t("entry.title", { n: formatNumber(d.number, locale) })} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                  )}
                  {d.isWinner && (
                    <>
                      <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-white">{t("entry.winner")}</span>
                      <WinnerTrophy size="sm" className="absolute right-2 top-2" />
                    </>
                  )}
                </div>
                <div className="px-3 py-2.5">
                  <p className="truncate text-sm font-semibold text-ink group-hover:text-primary">{d.brandName}</p>
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
        <p className="mx-auto mt-8 max-w-xl rounded-lg border border-dashed border-line bg-surface px-4 py-10 text-center text-muted">
          {t(tab === "wins" ? "designerProfile.noWins" : "designerProfile.noDesigns")}
        </p>
      )}
    </div>
  );
}
