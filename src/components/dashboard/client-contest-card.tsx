import Link from "@/components/ui/link";
import { BrandTile, ContestNumber, PackagePill, PRIZE_TEXT, StatusLine, UpgradePills } from "@/components/contests/contest-bits";
import { AddonsButton } from "@/components/manage/addons-button";
import { ButtonLink } from "@/components/ui/button";
import { Arrow } from "@/components/ui/section-heading";
import type { AddonPrices } from "@/lib/contests/addon-payments";
import { StatusChip, type ChipStatus } from "@/components/ui/status-chip";
import type { DashboardContest } from "@/lib/contests/dashboard";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";
import { openMethods } from "@/lib/payments/methods";

/** The one next step for this contest (UI-JOURNEY C-13, owner 2026-10-08: no two buttons to the same place). */
function nextAction(c: DashboardContest): { href: string; label: MessageKey } | null {
  switch (c.status) {
    case "draft":
    case "pending_payment":
      return { href: `/start?draft=${c.id}`, label: "dashboard.actions.finish" };
    case "open":
    case "judging":
    case "winner_selected":
    case "handover":
      return { href: `/dashboard/contests/${c.slug}`, label: "dashboard.manage" };
    default:
      return null;
  }
}

/**
 * C-13 contest card: the leading or winning design, the key facts and one clear button. `awaitingPayment` is the
 * payment id when the client sent a bKash transaction ID that waits for approval (owner, 2026-10-14).
 */
export async function ClientContestCard({ contest: c, now, addons, awaitingPayment }: { contest: DashboardContest; now: Date; addons?: AddonPrices; awaitingPayment?: string | null }) {
  const { t, locale, currency, price } = await getI18n();
  const isDraft = c.tab === "drafts";
  const action = awaitingPayment ? { href: `/pay/contest/${awaitingPayment}`, label: "pay.viewPayment" as MessageKey } : nextAction(c);
  const methods = addons && c.status === "open" ? await openMethods(locale, currency.code) : [];
  const live = c.startsAt !== null;

  const facts: { label: string; value: string; className?: string }[] = [
    { label: t("dashboard.facts.prize"), value: price(c.prize), className: cx("text-lg font-extrabold", PRIZE_TEXT) },
    { label: t("dashboard.facts.paid"), value: price(c.paid) },
    { label: t("dashboard.facts.designs"), value: formatNumber(c.entries, locale) },
    { label: t("dashboard.facts.designers"), value: formatNumber(c.designers, locale) },
  ];
  const dates = [
    live ? t("dashboard.facts.started") + " " + formatDate(c.startsAt!, locale, "short") : t("dashboard.facts.created") + " " + formatDate(c.createdAt, locale, "short"),
    c.endsAt
      ? (c.endsAt > now && c.status === "open" ? t("dashboard.facts.ends") : t("dashboard.facts.ended")) + " " + formatDate(c.completedAt ?? c.endsAt, locale, "short")
      : null,
  ].filter(Boolean) as string[];

  // C-13 (owner, 2026-10-08): "Add-ons" opens this contest's add-ons in a pop-up, not the manage page.
  const addonsButton =
    !isDraft && c.status === "open" && addons ? (
      <AddonsButton
        contestId={c.id}
        brand={c.brandName}
        active={{ promote: c.isPromoted, private: c.isPrivate, blind: c.isBlind, logo_scan: c.logoScan }}
        prices={addons}
        extensionDays={addons.extensionDays}
        endsAt={c.endsAt ? c.endsAt.toISOString() : null}
        prize={c.prize}
        methods={methods}
      />
    ) : null;

  return (
    <article
      className="lc-card group flex flex-col overflow-hidden transition-shadow duration-300 hover:shadow-card sm:flex-row"
    >
      <Link href={action?.href ?? `/contest/${c.slug}`} className="relative m-2 block h-44 shrink-0 overflow-hidden rounded-[22px] sm:h-auto sm:w-52 lg:w-60" tabIndex={-1} aria-hidden>
        <BrandTile name={c.brandName} isPrivate={false} cover={c.cover} flat className="h-full w-full text-[1.8rem] transition-transform duration-500 group-hover:scale-105" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col p-4 pt-2 sm:p-6 sm:pl-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={c.status as ChipStatus} label={t(`status.${c.status as ChipStatus}`)} />
          <PackagePill pkg={c.package} t={t} />
          <ContestNumber n={c.number} t={t} locale={locale} />
          <UpgradePills contest={c} t={t} />
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="m-0 truncate text-[22px] font-semibold tracking-[-0.02em] text-ink">{c.brandName}</h3>
            <p className="text-sm text-muted">
              {t(`wizard.businessTypes.${c.businessType}`)} · {dates.join(" · ")}
            </p>
          </div>
          {!isDraft && (
            <div className="hidden shrink-0 items-center gap-4 sm:flex">
              {addonsButton}
              <a href={`/contest/${c.slug}`} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-muted hover:text-primary">
                {t("dashboard.publicPage")} ↗
              </a>
            </div>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label} className="flex min-w-0 flex-col-reverse rounded-[16px] bg-chip px-3.5 py-2.5">
              <dt className="text-xs text-muted">{f.label}</dt>
              <dd className={cx("truncate font-bold tabular-nums text-ink", f.className)}>{f.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 sm:max-w-sm sm:flex-1">
            {awaitingPayment ? (
              <p className="m-0 flex flex-col gap-1 text-sm" data-awaiting-approval>
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#fff4dc] px-2.5 py-1 text-[13px] font-bold text-[#9a6200]">
                  <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                    <path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  {t("pay.waiting")}
                </span>
                <span className="text-muted">{t("pay.waitingLead")}</span>
              </p>
            ) : isDraft ? (
              <p className="text-sm font-medium text-warning">{t("dashboard.draftNote")}</p>
            ) : (
              <StatusLine contest={c} now={now} t={t} locale={locale} />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {addonsButton && <span className="sm:hidden">{addonsButton}</span>}
            {c.unrated > 0 && c.status === "open" && (
              <span className="rounded-full bg-tint px-2.5 py-1 text-xs font-bold text-primary">
                {c.unrated === 1 ? t("dashboard.attention.rateOne") : t("dashboard.attention.rate", { n: formatNumber(c.unrated, locale) })}
              </span>
            )}
            {action && (
              <ButtonLink href={action.href} className="shrink-0">
                {t(action.label)} <Arrow />
              </ButtonLink>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
