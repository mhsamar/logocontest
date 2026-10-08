import Link from "next/link";
import { ShareProfile } from "@/components/designers/share-profile";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
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
}: {
  designer: DesignerProfile;
  contests: DesignerContest[];
  savedCount: number;
  profileUrl: string;
  qrSvg: string;
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
      <section className="relative overflow-hidden rounded-2xl bg-ink p-5 text-white shadow-panel sm:p-8">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-[0.35] invert [mask-image:linear-gradient(to_right,transparent,black)]" aria-hidden />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={designer.name} url={designer.avatarUrl} tone="cream" className="size-16 text-xl ring-4 ring-white/10 sm:size-20 sm:text-2xl" />
            <div className="min-w-0">
              <h1 className="truncate text-h2 font-bold leading-tight lg:text-h2-lg">{t("dashboard.hi", { name: designer.name })}</h1>
              <p className="mt-0.5 flex flex-col text-sm text-cream/75 sm:flex-row sm:gap-1.5">
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
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-cream px-5 font-semibold text-ink transition-colors hover:bg-white"
            >
              {t("designerDash.editProfile")}
            </Link>
            <Link
              href={`/d/${designer.username}`}
              className="inline-flex min-h-11 items-center justify-center rounded-md px-5 font-semibold text-white ring-1 ring-inset ring-white/25 transition-colors hover:bg-white/10"
            >
              {t("designerDash.viewProfile")}
            </Link>
          </div>
        </div>

        <dl className="relative mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col-reverse rounded-xl bg-white/[0.07] px-4 py-3 ring-1 ring-white/10">
              <dt className="mt-0.5 text-xs text-cream/70">{s.label}</dt>
              <dd className={cx("truncate text-xl font-bold tabular-nums sm:text-2xl", s.accent && "text-cream")}>{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Share */}
      <Panel title={t("designerDash.share.title")} className="mt-5">
        <p className="-mt-2 mb-4 text-sm text-muted">{t("designerDash.share.subtitle")}</p>
        <ShareProfile url={profileUrl} qrSvg={qrSvg} qrDownloadHref={`/d/${designer.username}/qr?download=1`} name={designer.name} />
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
                  <div className="min-w-0">
                    <Link href={`/contest/${c.slug}`} className="block truncate font-semibold text-ink hover:text-primary">
                      {c.brandName}
                    </Link>
                    <p className="text-sm text-muted">{t("designerDash.myEntries", { count: formatNumber(c.myEntries, locale) })}</p>
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
                    <Link href={`/contest/${w.slug}`} className="block overflow-hidden rounded-lg ring-1 ring-line hover:ring-primary">
                      {w.winningLogoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={w.winningLogoUrl} alt="" className="aspect-square w-full bg-white object-contain p-2" />
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
