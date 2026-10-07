import Link from "next/link";
import { BrandTile, PackagePill, StatusLine, UpgradePills } from "@/components/contests/contest-bits";
import { ButtonLink } from "@/components/ui/button";
import { StatusChip, type ChipStatus } from "@/components/ui/status-chip";
import type { DashboardContest } from "@/lib/contests/dashboard";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber, formatTaka } from "@/lib/money";

/** The next thing the client should do (UI-JOURNEY C-13). */
function nextAction(c: DashboardContest): { href: string; label: MessageKey } | null {
  switch (c.status) {
    case "draft":
    case "pending_payment":
      return { href: `/start?draft=${c.id}`, label: "dashboard.actions.finish" };
    case "open":
      return { href: `/contest/${c.slug}?tab=entries`, label: "dashboard.actions.review" };
    case "judging":
      // TODO(milestone 5): C-16 Pick winner.
      return { href: `/contest/${c.slug}?tab=entries`, label: "dashboard.actions.pick" };
    case "winner_selected":
    case "handover":
      // TODO(milestone 6): C-17 Handover.
      return { href: `/contest/${c.slug}`, label: "dashboard.actions.approve" };
    default:
      return null;
  }
}

/** C-13 full-detail contest card, with the winning logo once there is one. */
export async function ClientContestCard({ contest: c, now }: { contest: DashboardContest; now: Date }) {
  const { t, locale } = await getI18n();
  const isDraft = c.tab === "drafts";
  const action = nextAction(c);
  const live = c.startsAt !== null;

  const facts: { label: string; value: string; className?: string }[] = [
    { label: t("dashboard.facts.prize"), value: formatTaka(c.prize, locale), className: "text-accent" },
    { label: t("dashboard.facts.paid"), value: formatTaka(c.paid, locale) },
    { label: t("dashboard.facts.designs"), value: formatNumber(c.entries, locale) },
    { label: t("dashboard.facts.designers"), value: formatNumber(c.designers, locale) },
    live
      ? { label: t("dashboard.facts.started"), value: formatDate(c.startsAt!, locale) }
      : { label: t("dashboard.facts.created"), value: formatDate(c.createdAt, locale) },
    c.endsAt
      ? {
          label: c.endsAt > now && c.tab === "active" && c.status === "open" ? t("dashboard.facts.ends") : t("dashboard.facts.ended"),
          value: formatDate(c.completedAt ?? c.endsAt, locale),
        }
      : null,
    !isDraft ? { label: t("dashboard.facts.winner"), value: c.winner ? `@${c.winner.designer}` : t("dashboard.facts.notPicked") } : null,
  ].filter(Boolean) as { label: string; value: string; className?: string }[];

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line sm:flex-row">
      {/* Winning logo (or the brand's letter until a winner is picked) */}
      <div className="relative flex h-40 shrink-0 sm:h-auto sm:w-48 lg:w-56">
        {c.winner ? (
          // Entry previews are watermarked images from storage.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.winner.logoUrl} alt={t("dashboard.winnerRibbon")} className="h-full w-full bg-white object-contain p-4" />
        ) : (
          <BrandTile name={c.brandName} isPrivate={false} flat className="h-full w-full text-[1.8rem]" />
        )}
        {c.winner && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-white">
            <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden>
              <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7Z" />
            </svg>
            {t("dashboard.winnerRibbon")}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={c.status as ChipStatus} label={t(`status.${c.status as ChipStatus}`)} />
          <PackagePill pkg={c.package} t={t} />
          <UpgradePills contest={c} t={t} />
        </div>
        <h3 className="mt-2 truncate text-lg font-semibold text-ink sm:text-xl">
          {isDraft ? c.brandName : (
            <Link href={`/contest/${c.slug}`} className="hover:text-primary">
              {c.brandName}
            </Link>
          )}
        </h3>
        <p className="text-sm text-muted">{t(`wizard.businessTypes.${c.businessType}`)}</p>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label} className="flex min-w-0 flex-col-reverse">
              <dt className="text-xs text-muted">{f.label}</dt>
              <dd className={cx("truncate font-semibold tabular-nums text-ink", f.className)}>{f.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 sm:max-w-xs sm:flex-1">
            {isDraft ? (
              <p className="text-sm font-medium text-warning">{t("dashboard.draftNote")}</p>
            ) : (
              <StatusLine contest={c} now={now} t={t} locale={locale} />
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {!isDraft && (
              <ButtonLink href={`/contest/${c.slug}`} variant={action ? "secondary" : "primary"}>
                {t("dashboard.actions.view")}
              </ButtonLink>
            )}
            {action && <ButtonLink href={action.href}>{t(action.label)}</ButtonLink>}
          </div>
        </div>
      </div>
    </article>
  );
}
