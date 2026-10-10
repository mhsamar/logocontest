import Link from "next/link";
import { ContestCard } from "@/components/contests/contest-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell, Panel } from "@/components/ui/panel";
import { Arrow, IconBadge, Pill } from "@/components/ui/section-heading";
import { liveContests } from "@/lib/contests/browse";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber, formatTaka } from "@/lib/money";
import { getSettings } from "@/lib/settings";

const TIP_ICONS = [
  <path key="1" d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5ZM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />,
  <path key="2" d="M4 5h16v11H4ZM8 21h8M12 16v5" />,
  <path key="3" d="M12 3v18M3 12h18M7 7l10 10M17 7 7 17" />,
  <path key="4" d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z" />,
  <path key="5" d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12Z" />,
  <path key="6" d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
];

const H2 = "m-0 text-[clamp(28px,3.4vw,42px)] font-semibold leading-[1.08] tracking-[-0.035em] text-ink";

/** P-01d Designer home (owner, 2026-10-08): open contests, tips, how to upload, rules and fees. */
export async function DesignerHome({ user }: { user: { name: string } }) {
  const { t, locale } = await getI18n();
  const [open, s] = await Promise.all([
    liveContests(3),
    getSettings([
      "limits.entry_min_images",
      "limits.entry_max_images",
      "limits.entry_image_max_mb",
      "limits.entry_image_min_px",
      "limits.max_entries_per_designer",
      "timers.designer_file_upload_days",
      "limits.strikes_for_suspension",
      "limits.strikes_for_ban",
      "fees.designer_tiers",
      "limits.withdrawal_min",
    ]),
  ]);
  const fmt = (n: number) => formatNumber(n, locale);
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;
  const now = new Date();
  const perContest = s["limits.max_entries_per_designer"];
  const tiers = [...s["fees.designer_tiers"]].sort((a, b) => a.min_wins - b.min_wins);

  return (
    <PageShell>
      <Panel as="header">
        <div className="max-w-2xl">
          <Pill>{t("designerHome.hi", { name: firstName })}</Pill>
          <h1 className="m-0 mt-4 text-[clamp(32px,4.4vw,54px)] font-semibold leading-[1.05] tracking-[-0.04em] text-ink">{t("designerHome.title")}</h1>
          <p className="m-0 mt-3 text-lg text-muted">{t("designerHome.lead")}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/contests" size="lg">
              {t("designerHome.browse")} <Arrow />
            </ButtonLink>
            <ButtonLink href="/dashboard" variant="secondary" size="lg">
              {t("designerHome.dashboard")}
            </ButtonLink>
          </div>
        </div>
      </Panel>

      {/* Open now */}
      <Panel tone="grey">
        <div className="flex items-end justify-between gap-3">
          <h2 className={cx(H2, "lc-rv")}>{t("designerHome.openNow")}</h2>
          <Link href="/contests" className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-bold text-primary hover:underline">
            {t("designerHome.seeAll")} <Arrow />
          </Link>
        </div>
        {open.length > 0 ? (
          <ul className="m-0 mt-8 grid list-none gap-3.5 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {open.map((c) => (
              <li key={c.id} className="lc-rv">
                <ContestCard contest={c} now={now} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-8">
            <EmptyState title={t("designerHome.none")} />
          </div>
        )}
      </Panel>

      {/* Tips */}
      <Panel>
        <h2 className={cx(H2, "lc-rv")}>{t("designerHome.tips.title")}</h2>
        <ul className="m-0 mt-8 grid list-none gap-3.5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {(["t1", "t2", "t3", "t4", "t5", "t6"] as const).map((k, i) => (
            <li key={k} className="lc-card lc-rv p-6">
              <IconBadge dark={i % 2 === 1}>
                <svg viewBox="0 0 24 24" className="size-6 text-white" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {TIP_ICONS[i]}
                </svg>
              </IconBadge>
              <h3 className="mt-5 text-xl font-semibold tracking-[-0.02em] text-ink">{t(`designerHome.tips.${k}.title`)}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
                {t(`designerHome.tips.${k}.body`, {
                  max: fmt(s["limits.entry_max_images"]),
                  limit: perContest > 0 ? t("designerHome.tips.limited", { n: fmt(perContest) }) : t("designerHome.tips.unlimited"),
                })}
              </p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel tone="grey" className="grid gap-3.5 lg:grid-cols-2">
        {/* How to upload */}
        <div className="lc-card lc-rv p-6 sm:p-8">
          <h2 className="m-0 text-2xl font-semibold tracking-[-0.03em] text-ink">{t("designerHome.upload.title")}</h2>
          <ol className="m-0 mt-5 list-none space-y-4 p-0">
            {(["s1", "s2", "s3", "s4", "s5"] as const).map((k, i) => (
              <li key={k} className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[image:var(--gradient-red)] text-sm font-bold text-white">{fmt(i + 1)}</span>
                <p className="m-0 pt-1 text-ink">
                  {t(`designerHome.upload.${k}`, {
                    min: fmt(s["limits.entry_min_images"]),
                    max: fmt(s["limits.entry_max_images"]),
                    mb: fmt(s["limits.entry_image_max_mb"]),
                    px: fmt(s["limits.entry_image_min_px"]),
                  })}
                </p>
              </li>
            ))}
          </ol>
        </div>

        {/* Rules */}
        <div className="lc-rv rounded-[28px] bg-tint p-6 sm:p-8">
          <h2 className="m-0 text-2xl font-semibold tracking-[-0.03em] text-ink">{t("designerHome.rules.title")}</h2>
          <ul className="m-0 mt-5 list-none space-y-3 p-0">
            {(["r1", "r2", "r3", "r4", "r5"] as const).map((k) => (
              <li key={k} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-primary" aria-hidden>
                  <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
                <span className="text-ink">
                  {t(`designerHome.rules.${k}`, {
                    days: fmt(s["timers.designer_file_upload_days"]),
                    suspend: fmt(s["limits.strikes_for_suspension"]),
                    ban: fmt(s["limits.strikes_for_ban"]),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Panel>

      {/* Fees */}
      <Panel>
        <h2 className={cx(H2, "lc-rv")}>{t("designerHome.fees.title")}</h2>
        <p className="m-0 mt-3 max-w-2xl text-muted">{t("designerHome.fees.body", { min: formatTaka(s["limits.withdrawal_min"], locale) })}</p>
        <ul className="m-0 mt-8 grid list-none gap-3 p-0 sm:grid-cols-3">
          {tiers.map((tier) => (
            <li key={tier.min_wins} className="lc-rv rounded-[22px] bg-chip p-5">
              <p className="lc-d m-0 text-3xl font-semibold tabular-nums tracking-[-0.03em] text-primary">{t("designerHome.fees.tier", { rate: fmt(tier.rate_percent) })}</p>
              <p className="m-0 mt-1 text-sm text-muted">{tier.min_wins === 0 ? t("designerHome.fees.first") : t("designerHome.fees.from", { n: fmt(tier.min_wins + 1) })}</p>
            </li>
          ))}
        </ul>
      </Panel>
    </PageShell>
  );
}
