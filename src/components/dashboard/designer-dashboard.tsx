import Link from "next/link";
import { ShareProfile } from "@/components/designers/share-profile";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { WinnerTrophy } from "@/components/ui/trophy";
import { StatusChip, type ChipStatus } from "@/components/ui/status-chip";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/dates";
import type { DesignerContest, DesignerProfile } from "@/lib/designers/profile";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber, formatTaka } from "@/lib/money";

function Panel({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line sm:p-6", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ text, cta }: { text: string; cta?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line bg-canvas/60 px-4 py-8 text-center">
      <p className="text-sm text-muted">{text}</p>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}

/** D-02 designer dashboard (UI-JOURNEY, owner 2026-10-08). */
export async function DesignerDashboard({
  designer,
  contests,
  savedCount,
  profileUrl,
  qrSvg,
  handovers,
  balance,
}: {
  designer: DesignerProfile;
  contests: DesignerContest[];
  savedCount: number;
  profileUrl: string;
  qrSvg: string;
  /** Wins whose files are still to be delivered or approved (owner, 2026-10-08). */
  handovers: { slug: string; brand: string; status: string; dueAt: Date; credit: number }[];
  balance: number;
}) {
  const { t, locale } = await getI18n();
  const wins = contests.filter((c) => c.won);
  const stats = [
    { label: t("designerDash.stats.contests"), value: formatNumber(designer.stats.contestsEntered, locale) },
    { label: t("designerDash.stats.designs"), value: formatNumber(designer.stats.designs, locale) },
    { label: t("designerDash.stats.wins"), value: formatNumber(designer.stats.wins, locale) },
    { label: t("designerDash.stats.earned"), value: formatTaka(designer.stats.totalEarned, locale), accent: true },
  ];

  return (
    <div className="mx-auto w-full max-w-page px-4 pb-16 pt-4">
      {/* Profile panel */}
      <section className="relative overflow-hidden bg-aurora rounded-[2rem] p-5 text-ink shadow-frame ring-1 ring-white sm:p-8">
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={designer.name} url={designer.avatarUrl} tone="cream" className="size-16 text-xl ring-4 ring-white sm:size-20 sm:text-2xl" />
            <div className="min-w-0">
              <h1 className="truncate text-h2 font-bold leading-tight lg:text-h2-lg">{t("dashboard.hi", { name: designer.name })}</h1>
              <p className="mt-0.5 flex flex-col text-sm text-muted sm:flex-row sm:gap-1.5">
                <span className="font-mono">@{designer.username}</span>
                <span className="hidden sm:inline">·</span>
                <span>{t("dashboard.memberSince", { date: formatDate(designer.memberSince, locale, "month") })}</span>
              </p>
              {designer.isTopDesigner && (
                <span className="mt-2 inline-flex rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-white">{t("designerProfile.topDesigner")}</span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Link
              href="/dashboard/profile"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 font-semibold text-white shadow-card transition-colors hover:bg-primary-dark"
            >
              {t("designerDash.editProfile")}
            </Link>
            <Link
              href={`/d/${designer.username}`}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-white/70 px-5 font-semibold text-ink ring-1 ring-inset ring-white backdrop-blur transition-colors hover:bg-white"
            >
              {t("designerDash.viewProfile")}
            </Link>
          </div>
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

      {/* You won: files to deliver (D-08), and the wallet (D-10) */}
      <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {handovers.length > 0 && (
          <div className="space-y-3">
            {handovers.map((h) => (
              <Link
                key={h.slug}
                href={`/dashboard/handover/${h.slug}`}
                className="group flex animate-rise items-center gap-4 rounded-2xl bg-gradient-to-br from-[#1f0a05] via-[#3a1208] to-primary-dark p-4 text-white shadow-raised transition-[translate] duration-300 hover:-translate-y-0.5"
              >
                <span className="text-3xl" aria-hidden>
                  🏆
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{t("designerDash.won.title", { brand: h.brand })}</span>
                  <span className="block text-sm text-white/75">
                    {h.status === "submitted" ? t("designerDash.won.waiting") : t("designerDash.won.due", { date: formatDate(h.dueAt, locale, "short") })}
                  </span>
                </span>
                <span className="prize-text shrink-0 text-xl font-extrabold tabular-nums">{formatTaka(h.credit, locale)}</span>
              </Link>
            ))}
          </div>
        )}
        <Link
          href="/dashboard/wallet"
          className={cx(
            "group flex items-center justify-between gap-3 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line transition-shadow hover:shadow-raised",
            handovers.length > 0 ? "lg:col-start-2" : "lg:col-span-2",
          )}
        >
          <span>
            <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted">{t("nav.wallet")}</span>
            <span className="block text-2xl font-extrabold tabular-nums text-[#7a4300]">{formatTaka(balance, locale)}</span>
          </span>
          <span className="text-sm font-semibold text-primary transition-transform group-hover:translate-x-1">→</span>
        </Link>
      </div>

      {/* Share */}
      <Panel title={t("designerDash.share.title")} className="mt-5">
        <p className="-mt-2 mb-4 text-sm text-muted">{t("designerDash.share.subtitle")}</p>
        <ShareProfile url={profileUrl} qrSvg={qrSvg} qrDownloadHref={`/d/${designer.username}/qr?download=1`} name={designer.name} />
        {/* Portfolio (owner, 2026-10-08): the public profile as a PDF, and where to edit it */}
        <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">{t("portfolio.subtitle")}</p>
          <div className="flex shrink-0 gap-2">
            <Link
              href="/dashboard/profile"
              className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-primary ring-1 ring-inset ring-line hover:ring-primary"
            >
              {t("portfolio.title")}
            </Link>
            <a
              href={`/d/${designer.username}/portfolio`}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
              </svg>
              {t("portfolio.downloadPdf")}
            </a>
          </div>
        </div>
      </Panel>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <Panel
          title={t("designerDash.myContests")}
          action={
            <Link href="/contests" className="text-sm font-semibold text-primary hover:underline">
              {t("designerDash.browse")}
            </Link>
          }
        >
          {contests.length > 0 ? (
            <ul className="divide-y divide-line">
              {contests.map((c) => (
                <li key={c.slug} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {/* The designer's newest design in this contest (its preview) */}
                    <Link
                      href={`/contest/${c.slug}?tab=entries`}
                      className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-canvas ring-1 ring-line"
                      aria-hidden
                      tabIndex={-1}
                    >
                      {c.latestCoverUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.winningLogoUrl ?? c.latestCoverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                      )}
                      {c.won && <WinnerTrophy size="sm" className="absolute -right-0.5 -top-0.5 scale-75" />}
                    </Link>
                    <div className="min-w-0">
                      <Link href={`/contest/${c.slug}?tab=entries`} className="block truncate font-semibold text-ink hover:text-primary">
                        {c.brandName}
                      </Link>
                      <p className="text-sm text-muted">{t("designerDash.myEntries", { count: formatNumber(c.myEntries, locale) })}</p>
                    </div>
                  </div>
                  <StatusChip status={c.status as ChipStatus} label={t(`status.${c.status as ChipStatus}`)} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty text={t("designerDash.noContests")} cta={<ButtonLink href="/contests">{t("designerDash.browse")}</ButtonLink>} />
          )}
        </Panel>

        <div className="space-y-5">
          <Panel title={t("designerDash.wins")}>
            {wins.length > 0 ? (
              <ul className="grid grid-cols-2 gap-3">
                {wins.map((w) => (
                  <li key={w.slug}>
                    <Link href={`/contest/${w.slug}`} className="relative block overflow-hidden rounded-lg ring-1 ring-line hover:ring-primary">
                      <WinnerTrophy size="sm" className="absolute right-1.5 top-1.5" />
                      {w.winningLogoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={w.winningLogoUrl} alt="" loading="lazy" className="aspect-square w-full bg-white object-contain p-2" />
                      )}
                      <span className="block truncate border-t border-line px-2 py-1.5 text-xs font-medium text-ink">{w.brandName}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty text={t("designerDash.noWins")} />
            )}
          </Panel>

          <Link href="/dashboard/saved" className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line hover:ring-primary">
            <span className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
                  <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
                </svg>
              </span>
              <span className="font-semibold text-ink">{t("nav.saved")}</span>
            </span>
            <span className="rounded-full bg-canvas px-2.5 py-0.5 text-sm font-semibold tabular-nums text-muted">{formatNumber(savedCount, locale)}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
