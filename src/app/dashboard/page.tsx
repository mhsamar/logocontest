import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PRIZE_TEXT } from "@/components/contests/contest-bits";
import { ClientContestCard } from "@/components/dashboard/client-contest-card";
import { ACCENT_TEXT } from "@/components/home/sections";
import { Avatar } from "@/components/ui/avatar";
import { TrophyIcon } from "@/components/ui/trophy";
import { DesignerDashboard } from "@/components/dashboard/designer-dashboard";
import { ButtonLink } from "@/components/ui/button";
import { CountUp } from "@/components/ui/count-up";
import { EmptyState } from "@/components/ui/empty-state";
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
  const TONE = { gold: "from-[#fff7e0] to-[#ffe9b8]", blue: "from-[#eaf2ff] to-[#d9e7ff]", rose: "from-[#fff0f3] to-[#ffdce4]" };

  return (
    <div className="mx-auto w-full max-w-page px-4 pb-16 pt-4">
      {/* Welcome panel (owner, 2026-10-08: premium and personal) */}
      <section className="relative animate-rise overflow-hidden bg-aurora rounded-[2rem] p-5 text-ink shadow-frame ring-1 ring-white sm:p-8">
        <span className="pointer-events-none absolute -right-10 -top-12 size-48 animate-float-soft rounded-full bg-[#ffe2a0]/50 blur-2xl" aria-hidden />
        <span className="pointer-events-none absolute -bottom-16 left-1/3 size-56 animate-float rounded-full bg-[#ebc9ff]/40 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="rounded-full bg-gradient-to-br from-[#f4bd2f] via-[#fff1c2] to-[#c9860a] p-[3px] shadow-raised">
              <Avatar name={name} url={user.avatarUrl} tone="cream" className="size-16 text-2xl ring-2 ring-white sm:size-20 sm:text-3xl" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted">{t("dashboard.welcome")}</p>
              <h1 className="truncate font-display text-[2rem] italic leading-tight sm:text-[2.5rem]">
                <span className={ACCENT_TEXT}>{name}</span>
              </h1>
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
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-6 font-semibold text-white shadow-raised transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-primary-dark"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            {t("dashboard.create")}
          </Link>
        </div>

        <dl className="relative mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((st, i) => (
            <div
              key={st.label}
              className={cx(
                "flex animate-rise items-center gap-3 rounded-2xl px-4 py-3 ring-1 backdrop-blur",
                st.gold ? "bg-gradient-to-br from-[#fff9e8] to-[#ffe9b8] ring-[#f1c75c]/60" : "bg-white/75 ring-white",
              )}
              style={{ animationDelay: `${150 + i * 80}ms` }}
            >
              <span className={cx("hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex", st.gold ? "bg-white/70 text-[#8a5105]" : "bg-primary/10 text-primary")} aria-hidden>
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={st.icon} />
                </svg>
              </span>
              <div className="flex min-w-0 flex-col-reverse">
                <dt className="text-xs text-muted">{st.label}</dt>
                <dd className={cx("truncate text-xl font-bold tabular-nums sm:text-2xl", st.gold && PRIZE_TEXT)}>{st.value}</dd>
              </div>
            </div>
          ))}
        </dl>
        <p className="relative mt-5 flex items-center gap-2 text-sm font-medium text-[#8a5105]">
          <TrophyIcon className="size-5" />
          {t("dashboard.yours")}
        </p>
      </section>

      {attention.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted">{t("dashboard.attention.title")}</h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-3">
            {attention.map((a, i) => (
              <li key={a.id} className={cx("flex animate-rise items-center justify-between gap-3 rounded-2xl bg-gradient-to-br p-4 shadow-card ring-1 ring-white", TONE[a.tone])} style={{ animationDelay: `${300 + i * 80}ms` }}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{a.brand}</p>
                  <p className="text-sm text-ink/75">{a.text}</p>
                </div>
                <Link href={a.href} className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-dark">
                  {a.cta}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.contests.length === 0 ? (
        <div className="mx-auto mt-10 max-w-xl">
          <EmptyState title={t("dashboard.emptyTitle")} body={t("dashboard.emptyBody")} action={<ButtonLink href="/start">{t("dashboard.create")}</ButtonLink>} />
        </div>
      ) : (
        <>
          <nav aria-label={t("dashboard.tabs.label")} className="-mx-4 mt-8 overflow-x-auto px-4 [scrollbar-width:none]">
            <GlideTrack className="w-max">
              <ul className="flex w-max gap-1 rounded-full bg-surface p-1 ring-1 ring-line">
                {DASHBOARD_TABS.map((x) => (
                  <li key={x}>
                    <Link
                      href={`/dashboard?tab=${x}`}
                      aria-current={x === tab ? "page" : undefined}
                      className={cx(
                        "relative flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors",
                        x === tab ? "bg-ink text-white" : "text-muted hover:text-ink",
                      )}
                    >
                      {t(`dashboard.tabs.${x}`)}
                      <span className={cx("rounded-full px-1.5 text-xs tabular-nums", x === tab ? "bg-white/15" : "bg-canvas")}>{formatNumber(counts[x], locale)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </GlideTrack>
          </nav>

          {shown.length > 0 ? (
            <ul className="mt-5 space-y-4">
              {shown.map((c, i) => (
                <li key={c.id} className="reveal">
                  <ClientContestCard contest={c} now={now} index={i} addons={addons} />
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
