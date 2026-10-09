import type { Locale } from "@/lib/i18n/config";
import type { Translate } from "@/lib/i18n/translate";
import { monthLabel } from "@/lib/notifications/render";

const shortMonth = (month: string, locale: Locale) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
};

const TROPHY = (
  <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0ZM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Designer badges (BLUEPRINT §11): Top Designer and Monthly Champion with the month, newest first. */
/** `compact` is for tight rows (leaderboard): a trophy and the short month, on one line. */
export function DesignerBadges({ top, months, t, locale, max = 3, compact = false }: { top: boolean; months: string[]; t: Translate; locale: Locale; max?: number; compact?: boolean }) {
  if (!top && months.length === 0) return null;
  const shown = months.slice(0, max);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {shown.map((m) => (
        <span
          key={m}
          title={t("badges.champion", { month: monthLabel(m, locale) })}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-gradient-to-r from-[#f6d98b] to-[#f4bd2f] px-2.5 py-0.5 text-xs font-semibold text-[#5b3a00] ring-1 ring-[#e0a614]/40"
        >
          {TROPHY}
          {compact ? shortMonth(m, locale) : t("badges.champion", { month: monthLabel(m, locale) })}
        </span>
      ))}
      {months.length > max && <span className="text-xs text-muted">{t("badges.more", { n: String(months.length - max) })}</span>}
      {top && <span className="whitespace-nowrap rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-white">{t("designerProfile.topDesigner")}</span>}
    </span>
  );
}
