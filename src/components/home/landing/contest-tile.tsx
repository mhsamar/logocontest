/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { contestTitle } from "@/components/contests/contest-bits";
import type { ContestRow } from "@/lib/contests/browse";
import type { PackageKey } from "@/lib/contests/brief";
import { cx } from "@/lib/cx";
import { timeLeft } from "@/lib/home/logo-pick";
import type { Locale } from "@/lib/i18n/config";
import type { Translate } from "@/lib/i18n/translate";
import { formatNumber, formatTaka } from "@/lib/money";

const PACKAGE_CHIP: Record<PackageKey, string> = {
  economy: "bg-[var(--lc-chip)] text-[var(--lc-ink)]",
  standard: "bg-[var(--lc-ink)] text-white",
  pro: "bg-[var(--lc-ink)] text-white",
  premium: "bg-[var(--lc-tint)] text-[var(--lc-red)]",
  elite: "bg-[var(--lc-tint)] text-[var(--lc-red)]",
  custom: "bg-[var(--lc-tint)] text-[var(--lc-red)]",
};

/** The picture area: the real design where the contest allows it, else a lettering tile; a lock when private. */
function Cover({ c }: { c: ContestRow }) {
  if (c.isPrivate || c.isNda) {
    return (
      <span className="lc-g flex h-[72px] w-[72px] items-center justify-center rounded-[22px] bg-[image:var(--lc-grad-dark)]">
        <svg aria-hidden width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
          <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
        </svg>
      </span>
    );
  }
  if (c.cover) return <img src={c.cover.url} alt="" loading="lazy" className="absolute inset-0 h-full w-full rounded-[20px] object-cover" />;
  const name = c.brandName.trim();
  return name.length <= 8 ? (
    <span className="lc-d text-[40px] font-semibold uppercase tracking-[0.16em] text-white">{name}</span>
  ) : (
    <span className="text-[78px] text-[#7A1E12]" style={{ fontFamily: "Georgia, serif", fontWeight: 500 }}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

const coverBg = (c: ContestRow) => (c.isPrivate || c.isNda || c.cover ? "bg-[var(--lc-tile)]" : c.brandName.trim().length <= 8 ? "bg-[#0B0B0C]" : "bg-[#F4EFE4]");

/** One live contest (design file), from real data: badges, package, prize, designs so far and time left. */
export function ContestTile({ c, now, t, locale }: { c: ContestRow; now: Date; t: Translate; locale: Locale }) {
  const left = timeLeft(c.endsAt, now);
  const badges = [
    c.isPromoted && { label: t("contest.featured"), cls: "bg-white border border-[var(--lc-line)]" },
    c.isUrgent && { label: t("home.card.urgent"), cls: "bg-[var(--lc-red)] text-white" },
    c.isHighlighted && { label: t("home.card.highlighted"), cls: "bg-[var(--lc-gold)] text-[var(--lc-gold-ink)]" },
  ].filter(Boolean) as { label: string; cls: string }[];

  return (
    <Link href={`/contest/${c.slug}`} className="lc-card lc-rv flex flex-col p-2.5">
      <div className={cx("relative flex aspect-[16/10] items-center justify-center rounded-[20px]", coverBg(c))}>
        <Cover c={c} />
        {badges.length > 0 && (
          <div className="absolute inset-x-3 top-3 flex flex-wrap gap-1.5 text-[13px] font-bold">
            {badges.map((b) => (
              <span key={b.label} className={cx("rounded-full px-2.5 py-1", b.cls)}>
                {b.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-4 px-3.5 pb-3.5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <h3 className="m-0 truncate text-[23px] font-semibold tracking-[-0.03em]">{contestTitle(c, t)}</h3>
            <span className="text-base text-[var(--lc-muted)]">{t(`wizard.businessTypes.${c.businessType}`)}</span>
          </div>
          <span className={cx("shrink-0 rounded-lg px-2.5 py-1 text-[13px] font-bold", PACKAGE_CHIP[c.package])}>{t(`wizard.packages.${c.package}.name`)}</span>
        </div>
        <div className="flex items-end justify-between gap-3 border-t border-[var(--lc-line-soft)] pt-4">
          <span className="lc-d text-[40px] font-semibold leading-none tracking-[-0.04em] text-[var(--lc-red)]">{formatTaka(c.prize, locale)}</span>
          <span className="flex flex-col items-end gap-1.5">
            <span className="text-[15px] font-semibold text-[var(--lc-muted)]">{c.entries === 1 ? t("browse.oneDesign") : t("browse.designs", { count: formatNumber(c.entries, locale) })}</span>
            {left && (
              <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-[11px] py-[5px] text-sm font-bold", left.soon ? "bg-[#FDE3E1] text-[#A3121B]" : "bg-[#FFEDD5] text-[#9A3412]")}>
                <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                {left.kind === "days" ? t("home.card.daysLeft", { days: formatNumber(left.n, locale) }) : t("home.card.hoursLeft", { hours: formatNumber(left.n, locale) })}
              </span>
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}
