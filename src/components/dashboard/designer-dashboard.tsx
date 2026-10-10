import Link from "next/link";
import { ShareProfile } from "@/components/designers/share-profile";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses, ButtonLink } from "@/components/ui/button";
import { PageShell, Panel } from "@/components/ui/panel";
import { Arrow } from "@/components/ui/section-heading";
import { WinnerTrophy } from "@/components/ui/trophy";
import { StatusChip, type ChipStatus } from "@/components/ui/status-chip";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/dates";
import type { DesignerContest, DesignerProfile } from "@/lib/designers/profile";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber, formatTaka } from "@/lib/money";

function Block({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx("lc-card p-5 sm:p-7", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-[22px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ text, cta }: { text: string; cta?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[20px] border border-dashed border-line bg-chip/60 px-4 py-8 text-center">
      <p className="m-0 text-[15px] text-muted">{text}</p>
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
    <PageShell>
      {/* Profile panel */}
      <Panel as="header" className="max-[720px]:py-6">
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="shrink-0 rounded-full bg-[image:var(--gradient-red)] p-[3px]">
              <Avatar name={designer.name} url={designer.avatarUrl} tone="cream" className="size-16 text-xl ring-2 ring-white sm:size-20 sm:text-2xl" />
            </span>
            <div className="min-w-0">
              <h1 className="m-0 truncate text-[clamp(28px,3.6vw,42px)] font-semibold leading-[1.1] tracking-[-0.035em] text-ink">{t("dashboard.hi", { name: designer.name })}</h1>
              <p className="m-0 mt-1 flex flex-col text-[15px] text-muted sm:flex-row sm:gap-1.5">
                <span className="font-mono">@{designer.username}</span>
                <span className="hidden sm:inline">·</span>
                <span>{t("dashboard.memberSince", { date: formatDate(designer.memberSince, locale, "month") })}</span>
              </p>
              {designer.isTopDesigner && (
                <span className="mt-2 inline-flex rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-gold-ink">{t("designerProfile.topDesigner")}</span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <ButtonLink href="/dashboard/profile">{t("designerDash.editProfile")}</ButtonLink>
            <ButtonLink href={`/d/${designer.username}`} variant="secondary">
              {t("designerDash.viewProfile")}
            </ButtonLink>
          </div>
        </div>

        <dl className="relative m-0 mt-7 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className={cx("flex flex-col-reverse rounded-[20px] px-4 py-3.5", s.accent ? "bg-[#fff6d6]" : "bg-chip")}>
              <dt className="mt-0.5 text-[13px] font-medium text-muted">{s.label}</dt>
              <dd className={cx("lc-d m-0 truncate text-[22px] font-semibold tabular-nums tracking-[-0.03em] text-ink sm:text-[26px]", s.accent && "text-gold-ink")}>{s.value}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel tone="grey" className="space-y-3.5 max-[720px]:py-4">

        {/* You won: files to deliver (D-08), and the wallet (D-10) */}
        <div className="grid gap-3.5 lg:grid-cols-[1.4fr_1fr]">
          {handovers.length > 0 && (
            <div className="space-y-3">
              {handovers.map((h) => (
                <Link
                  key={h.slug}
                  href={`/dashboard/handover/${h.slug}`}
                  className="lc-g group flex items-center gap-4 rounded-[22px] bg-[image:var(--gradient-red-dark)] p-4 text-white transition-[filter] duration-300 hover:brightness-110"
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
                  <span className="lc-d shrink-0 text-xl font-semibold tabular-nums text-gold">{formatTaka(h.credit, locale)}</span>
                </Link>
              ))}
            </div>
          )}
          <Link
            href="/dashboard/wallet"
            className={cx(
              "lc-card group flex items-center justify-between gap-3 rounded-[22px] p-5 transition-shadow hover:shadow-card",
              handovers.length > 0 ? "lg:col-start-2" : "lg:col-span-2",
            )}
          >
            <span>
              <span className="block text-xs font-bold uppercase tracking-[0.12em] text-muted">{t("nav.wallet")}</span>
              <span className="lc-d block text-[28px] font-semibold tabular-nums tracking-[-0.03em] text-primary">{formatTaka(balance, locale)}</span>
            </span>
            <span className="flex size-10 items-center justify-center rounded-full bg-tint text-primary transition-transform group-hover:translate-x-1">
              <Arrow />
            </span>
          </Link>
        </div>

        {/* Share */}
        <Block title={t("designerDash.share.title")}>
          <p className="m-0 -mt-2 mb-4 text-[15px] text-muted">{t("designerDash.share.subtitle")}</p>
          <ShareProfile url={profileUrl} qrSvg={qrSvg} qrDownloadHref={`/d/${designer.username}/qr?download=1`} name={designer.name} />
          {/* Portfolio (owner, 2026-10-08): the public profile as a PDF, and where to edit it */}
          <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">{t("portfolio.subtitle")}</p>
            <div className="flex shrink-0 gap-2">
              <ButtonLink href="/dashboard/profile" variant="secondary">
                {t("portfolio.title")}
              </ButtonLink>
              <a href={`/d/${designer.username}/portfolio`} className={buttonClasses({ variant: "dark" })}>
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
                </svg>
                {t("portfolio.downloadPdf")}
              </a>
            </div>
          </div>
        </Block>

        <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <Block
            title={t("designerDash.myContests")}
            action={
              <Link href="/contests" className="inline-flex min-h-11 items-center text-sm font-bold text-primary hover:underline">
                {t("designerDash.browse")}
              </Link>
            }
          >
            {contests.length > 0 ? (
              <ul className="m-0 list-none divide-y divide-line p-0">
                {contests.map((c) => (
                  <li key={c.slug} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {/* The designer's newest design in this contest (its preview) */}
                      <Link
                        href={`/contest/${c.slug}?tab=entries`}
                        className="relative size-14 shrink-0 overflow-hidden rounded-[14px] bg-chip ring-1 ring-line"
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
                        <p className="m-0 text-sm text-muted">{t("designerDash.myEntries", { count: formatNumber(c.myEntries, locale) })}</p>
                      </div>
                    </div>
                    <StatusChip status={c.status as ChipStatus} label={t(`status.${c.status as ChipStatus}`)} />
                  </li>
                ))}
              </ul>
            ) : (
              <Empty text={t("designerDash.noContests")} cta={<ButtonLink href="/contests">{t("designerDash.browse")}</ButtonLink>} />
            )}
          </Block>

          <div className="space-y-3.5">
            <Block title={t("designerDash.wins")}>
              {wins.length > 0 ? (
                <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0">
                  {wins.map((w) => (
                    <li key={w.slug}>
                      <Link href={`/contest/${w.slug}`} className="relative block overflow-hidden rounded-[18px] ring-1 ring-line hover:ring-primary">
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
            </Block>

            <Link href="/dashboard/saved" className="lc-card flex items-center justify-between gap-3 rounded-[22px] p-5 transition-colors hover:border-primary">
              <span className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-[14px] bg-tint text-primary">
                  <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
                    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
                  </svg>
                </span>
                <span className="font-bold text-ink">{t("nav.saved")}</span>
              </span>
              <span className="rounded-full bg-chip px-2.5 py-0.5 text-sm font-bold tabular-nums text-muted">{formatNumber(savedCount, locale)}</span>
            </Link>
          </div>
        </div>
      </Panel>
    </PageShell>
  );
}
