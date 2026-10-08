import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClientContestCard } from "@/components/dashboard/client-contest-card";
import { DesignerDashboard } from "@/components/dashboard/designer-dashboard";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { can } from "@/lib/auth/policies";
import { getCurrentUser } from "@/lib/auth/session";
import { countSaved } from "@/lib/contests/community";
import { DASHBOARD_TABS, getClientDashboard, type DashboardTab } from "@/lib/contests/dashboard";
import { designerById, designerContests } from "@/lib/designers/profile";
import { siteOrigin } from "@/lib/email";
import { qrSvg } from "@/lib/profile/qr";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber, formatTaka } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("dashboard.meta.title"), robots: { index: false } };
}

// C-13 Client dashboard
export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const [{ t, locale }, user, sp] = await Promise.all([getI18n(), getCurrentUser(), searchParams]);
  if (!user) redirect("/login?next=/dashboard");
  // Designers have their own dashboard (D-02).
  if (user.role === "designer") {
    const designer = await designerById(user.id);
    if (!designer) notFound();
    const profileUrl = `${await siteOrigin()}/d/${designer.username}`;
    const [contests, savedCount, qr] = await Promise.all([designerContests(user.id), countSaved(user.id), qrSvg(profileUrl)]);
    return <DesignerDashboard designer={designer} contests={contests} savedCount={savedCount} profileUrl={profileUrl} qrSvg={qr} />;
  }
  if (can(user, "admin.access")) redirect("/admin");
  if (user.role !== "client") notFound();

  const data = await getClientDashboard(user.id);
  const counts = Object.fromEntries(DASHBOARD_TABS.map((tab) => [tab, data.contests.filter((c) => c.tab === tab).length])) as Record<DashboardTab, number>;
  const asked = DASHBOARD_TABS.find((x) => x === sp.tab);
  // The first tab with contests opens by default.
  const tab: DashboardTab = asked ?? DASHBOARD_TABS.find((x) => counts[x] > 0) ?? "active";
  const shown = data.contests.filter((c) => c.tab === tab);
  const now = new Date();
  const name = data.profile.name || user.name;

  const stats = [
    { label: t("dashboard.stats.contestsRun"), value: formatNumber(data.stats.contestsRun, locale) },
    { label: t("dashboard.stats.totalSpent"), value: formatTaka(data.stats.totalSpent, locale), accent: true },
    { label: t("dashboard.stats.active"), value: formatNumber(data.stats.active, locale) },
    { label: t("dashboard.stats.completed"), value: formatNumber(data.stats.completed, locale) },
  ];

  return (
    <div className="mx-auto w-full max-w-page px-4 pb-16 pt-4">
      {/* Profile panel */}
      <section className="relative overflow-hidden bg-aurora rounded-[2rem] p-5 text-ink shadow-frame ring-1 ring-white sm:p-8">
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-cream text-xl font-bold text-ink sm:size-16 sm:text-2xl" aria-hidden>
              {name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-h2 font-bold leading-tight lg:text-h2-lg">{t("dashboard.hi", { name })}</h1>
              <p className="mt-0.5 flex flex-col text-sm text-muted sm:flex-row sm:gap-1.5">
                {data.profile.businessName && (
                  <span className="truncate">
                    {data.profile.businessName}
                    <span className="hidden sm:inline"> ·</span>
                  </span>
                )}
                <span>{t("dashboard.memberSince", { date: formatDate(data.profile.memberSince, locale, "month") })}</span>
              </p>
            </div>
          </div>
          <Link
            href="/start"
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-6 font-semibold text-white shadow-card transition-colors hover:bg-primary-dark"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            {t("dashboard.create")}
          </Link>
        </div>

        <dl className="relative mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col-reverse rounded-xl bg-white/70 px-4 py-3 ring-1 ring-white backdrop-blur">
              <dt className="mt-0.5 text-xs text-muted">{s.label}</dt>
              <dd className={cx("truncate text-xl font-bold tabular-nums sm:text-2xl", s.accent && "text-accent")}>{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {data.contests.length === 0 ? (
        <div className="mx-auto mt-10 max-w-xl">
          <EmptyState title={t("dashboard.emptyTitle")} body={t("dashboard.emptyBody")} action={<ButtonLink href="/start">{t("dashboard.create")}</ButtonLink>} />
        </div>
      ) : (
        <>
          <nav aria-label={t("dashboard.tabs.label")} className="-mx-4 mt-8 overflow-x-auto px-4 [scrollbar-width:none]">
            <ul className="flex w-max gap-1 rounded-full bg-surface p-1 ring-1 ring-line">
              {DASHBOARD_TABS.map((x) => (
                <li key={x}>
                  <Link
                    href={`/dashboard?tab=${x}`}
                    aria-current={x === tab ? "page" : undefined}
                    className={cx(
                      "flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors",
                      x === tab ? "bg-ink text-white" : "text-muted hover:text-ink",
                    )}
                  >
                    {t(`dashboard.tabs.${x}`)}
                    <span className={cx("rounded-full px-1.5 text-xs tabular-nums", x === tab ? "bg-white/15" : "bg-canvas")}>{formatNumber(counts[x], locale)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {shown.length > 0 ? (
            <ul className="mt-5 space-y-4">
              {shown.map((c) => (
                <li key={c.id}>
                  <ClientContestCard contest={c} now={now} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 rounded-lg border border-dashed border-line bg-surface px-4 py-10 text-center text-muted">{t("dashboard.emptyTab")}</p>
          )}
        </>
      )}
    </div>
  );
}
