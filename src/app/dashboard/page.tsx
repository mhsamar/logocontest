import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClientContestCard } from "@/components/dashboard/client-contest-card";
import { Avatar } from "@/components/ui/avatar";
import { TrophyIcon } from "@/components/ui/trophy";
import { DesignerDashboard } from "@/components/dashboard/designer-dashboard";
import { ButtonLink } from "@/components/ui/button";
import { CountUp } from "@/components/ui/count-up";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell, Panel } from "@/components/ui/panel";
import { GlideTrack } from "@/components/ui/glide-track";
import { can } from "@/lib/auth/policies";
import { getCurrentUser } from "@/lib/auth/session";
import { addonPrices } from "@/lib/contests/addon-payments";
import { countSaved } from "@/lib/contests/community";
import { DASHBOARD_TABS, getClientDashboard, type DashboardTab } from "@/lib/contests/dashboard";
import { designerById, designerContests } from "@/lib/designers/profile";
import { openHandovers } from "@/lib/handover/queries";
import { getWallet } from "@/lib/wallet/queries";
import { siteOrigin } from "@/lib/email";
import { qrSvg } from "@/lib/profile/qr";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";

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
    const [contests, savedCount, qr, handovers, wallet] = await Promise.all([designerContests(user.id), countSaved(user.id), qrSvg(profileUrl), openHandovers(user.id), getWallet(user.id)]);
    return <DesignerDashboard designer={designer} contests={contests} savedCount={savedCount} profileUrl={profileUrl} qrSvg={qr} handovers={handovers} balance={wallet.balance} />;
  }
  if (can(user, "admin.access")) redirect("/admin");
  if (user.role !== "client") notFound();

  const [data, addons] = await Promise.all([getClientDashboard(user.id), addonPrices()]);
  const counts = Object.fromEntries(DASHBOARD_TABS.map((tab) => [tab, data.contests.filter((c) => c.tab === tab).length])) as Record<DashboardTab, number>;
  const asked = DASHBOARD_TABS.find((x) => x === sp.tab);
  // The first tab with contests opens by default.
  const tab: DashboardTab = asked ?? DASHBOARD_TABS.find((x) => counts[x] > 0) ?? "active";
  const shown = data.contests.filter((c) => c.tab === tab);
  const now = new Date();
  const name = data.profile.name || user.name;

  const stats = [
    { label: t("dashboard.stats.contestsRun"), value: <CountUp value={data.stats.contestsRun} locale={locale} />, icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
    { label: t("dashboard.stats.totalSpent"), value: <CountUp value={data.stats.totalSpent} locale={locale} taka />, gold: true, icon: "M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.6 7 6.6c0 4.9 10 2.4 10 7.6 0 2-2.2 3.3-5 3.3s-5-1.2-5-3.2" },
    { label: t("dashboard.stats.active"), value: <CountUp value={data.stats.active} locale={locale} />, icon: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
    { label: t("dashboard.stats.completed"), value: <CountUp value={data.stats.completed} locale={locale} />, icon: "M5 12.5l4.5 4.5L19 7.5" },
  ];

  // Things to do now (owner, 2026-10-08): ratings waiting, ending soon, time to pick.
  const day = 86_400_000;
  const attention = [
    ...data.contests
      .filter((c) => c.status === "judging")
      .map((c) => ({ id: `${c.id}-pick`, brand: c.brandName, text: t("dashboard.attention.judging"), cta: t("dashboard.attention.pick"), href: `/dashboard/contests/${c.slug}`, tone: "gold" as const })),
    ...data.contests
      .filter((c) => c.status === "open" && c.endsAt && c.endsAt.getTime() - now.getTime() < day && c.endsAt > now)
      .map((c) => ({ id: `${c.id}-end`, brand: c.brandName, text: t("dashboard.attention.ending"), cta: t("dashboard.attention.extend"), href: `/dashboard/contests/${c.slug}`, tone: "blue" as const })),
    ...data.contests
      .filter((c) => c.status === "open" && c.unrated > 0)
      .map((c) => ({
        id: `${c.id}-rate`,
        brand: c.brandName,
        text: c.unrated === 1 ? t("dashboard.attention.rateOne") : t("dashboard.attention.rate", { n: formatNumber(c.unrated, locale) }),
        cta: t("dashboard.attention.go"),
        href: `/dashboard/contests/${c.slug}?filter=unrated`,
        tone: "rose" as const,
      })),
  ].slice(0, 3);
  const TONE = { gold: "bg-gold", blue: "bg-[#5b8def]", rose: "bg-primary" };

  return (
    <PageShell>
      {/* Welcome panel (owner, 2026-10-08: premium and personal; site design 2026-10-10) */}
      <Panel as="header" className="max-[720px]:py-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="rounded-full bg-[image:var(--gradient-red)] p-[3px]">
              <Avatar name={name} url={user.avatarUrl} tone="cream" className="size-16 text-2xl ring-2 ring-white sm:size-20 sm:text-3xl" />
            </span>
            <div className="min-w-0">
              <p className="m-0 text-[15px] font-semibold text-muted">{t("dashboard.welcome")}</p>
              <h1 className="m-0 truncate text-[clamp(30px,4vw,44px)] font-semibold leading-[1.1] tracking-[-0.04em] text-primary">{name}</h1>
              <p className="m-0 mt-0.5 flex flex-col text-[15px] text-muted sm:flex-row sm:gap-1.5">
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
          <ButtonLink href="/start" size="lg" className="shrink-0">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            {t("dashboard.create")}
          </ButtonLink>
        </div>

        <dl className="m-0 mt-7 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {stats.map((st) => (
            <div key={st.label} className={cx("flex items-center gap-3 rounded-[20px] px-4 py-3.5", st.gold ? "bg-[#fff6d6]" : "bg-chip")}>
              <span className={cx("hidden size-11 shrink-0 items-center justify-center rounded-[14px] bg-surface sm:flex", st.gold ? "text-gold-ink" : "text-primary")} aria-hidden>
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={st.icon} />
                </svg>
              </span>
              <div className="flex min-w-0 flex-col-reverse">
                <dt className="text-[13px] font-medium text-muted">{st.label}</dt>
                <dd className={cx("lc-d m-0 truncate text-[22px] font-semibold tabular-nums tracking-[-0.03em] text-ink sm:text-[26px]", st.gold && "text-gold-ink")}>{st.value}</dd>
              </div>
            </div>
          ))}
        </dl>
        <p className="m-0 mt-5 flex items-center gap-2 text-[15px] font-semibold text-gold-ink">
          <TrophyIcon className="size-5" />
          {t("dashboard.yours")}
        </p>
      </Panel>

      <Panel tone="grey" className="flex-1 max-[720px]:py-6">
        {attention.length > 0 && (
          <section className="mb-8">
            <h2 className="m-0 text-sm font-bold uppercase tracking-[0.12em] text-muted">{t("dashboard.attention.title")}</h2>
            <ul className="m-0 mt-3 grid list-none gap-2.5 p-0 md:grid-cols-3">
              {attention.map((a) => (
                <li key={a.id} className="lc-card lc-rv flex items-center justify-between gap-3 rounded-[22px] p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={cx("mt-1.5 size-2.5 shrink-0 rounded-full", TONE[a.tone])} aria-hidden />
                    <div className="min-w-0">
                      <p className="m-0 truncate font-bold text-ink">{a.brand}</p>
                      <p className="m-0 text-sm text-muted">{a.text}</p>
                    </div>
                  </div>
                  <ButtonLink href={a.href} variant="dark" className="shrink-0">
                    {a.cta}
                  </ButtonLink>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.contests.length === 0 ? (
          <div className="mx-auto max-w-xl">
            <EmptyState title={t("dashboard.emptyTitle")} body={t("dashboard.emptyBody")} action={<ButtonLink href="/start">{t("dashboard.create")}</ButtonLink>} />
          </div>
        ) : (
          <>
            <nav aria-label={t("dashboard.tabs.label")} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-0 sm:px-0">
              <GlideTrack className="w-max">
                <ul className="m-0 flex w-max list-none gap-1 rounded-[18px] bg-surface p-1 ring-1 ring-line">
                  {DASHBOARD_TABS.map((x) => (
                    <li key={x}>
                      <Link
                        href={`/dashboard?tab=${x}`}
                        aria-current={x === tab ? "page" : undefined}
                        className={cx(
                          "relative flex min-h-11 items-center gap-2 rounded-[14px] px-4 text-[15px] font-bold transition-colors",
                          x === tab ? "bg-ink text-white" : "text-muted hover:text-ink",
                        )}
                      >
                        {t(`dashboard.tabs.${x}`)}
                        <span className={cx("rounded-full px-1.5 text-xs tabular-nums", x === tab ? "bg-white/15" : "bg-chip")}>{formatNumber(counts[x], locale)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </GlideTrack>
            </nav>

            {shown.length > 0 ? (
              <ul className="m-0 mt-5 list-none space-y-3.5 p-0">
                {shown.map((c) => (
                  <li key={c.id} className="lc-rv-soft">
                    <ClientContestCard contest={c} now={now} addons={addons} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-6">
                <EmptyState title={t("dashboard.emptyTab")} />
              </div>
            )}
          </>
        )}
      </Panel>
    </PageShell>
  );
}
