import { cx } from "@/lib/cx";
import type { Badge, MatchLevel } from "@/lib/logo-check/entry-rules";
import type { Translate } from "@/lib/i18n/translate";

/**
 * Logo check inside contests (owner, 2026-10-14; Design/logo-check): the match badge and the score ring.
 * Low green, Medium amber, High red, Not checked grey. No animation, so reduced motion needs nothing more.
 */

export const LEVEL_TONE: Record<MatchLevel | "none", { pill: string; ring: string; soft: string; ink: string }> = {
  low: { pill: "bg-[#e3f3ea] text-[#14633c]", ring: "#1f8a50", soft: "bg-[#eef8f2]", ink: "text-[#14633c]" },
  medium: { pill: "bg-[#fff1d6] text-[#8a5a00]", ring: "#d08a1e", soft: "bg-[#fff8ea]", ink: "text-[#8a5a00]" },
  high: { pill: "bg-[#fde3e1] text-[#a3121b]", ring: "#b3201b", soft: "bg-[#fdf0ef]", ink: "text-[#a3121b]" },
  none: { pill: "bg-chip text-muted", ring: "#c9cbd2", soft: "bg-chip", ink: "text-muted" },
};

export function ShieldIcon({ className = "size-3.5", warn = false }: { className?: string; warn?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={cx("shrink-0", className)} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
      {warn ? <path d="M12 8v4M12 15.5v.5" /> : <path d="M9 12l2.2 2.2L15.5 10" />}
    </svg>
  );
}

/** "Low match · 4%" or "Not checked". */
export function MatchBadge({ badge, t, className }: { badge: Badge; t: Translate; className?: string }) {
  const key = badge.kind === "checked" ? badge.level : "none";
  const label = badge.kind === "checked" ? t("entryCheck.badge.pct", { level: t(`entryCheck.badge.${badge.level}`), n: badge.score }) : t("entryCheck.badge.none");
  return (
    <span className={cx("inline-flex min-h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12.5px] font-bold", LEVEL_TONE[key].pill, className)}>
      <ShieldIcon warn={key === "medium" || key === "high"} />
      {label}
    </span>
  );
}

/** A ring with the match % (the share of the ring is the similarity). */
export function ScoreRing({ score, level, size = 64 }: { score: number; level: MatchLevel; size?: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const tone = LEVEL_TONE[level];
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="#e7e8ec" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={tone.ring} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${Math.max(2, (score / 100) * c)} ${c}`} />
      </svg>
      <span className={cx("relative text-[15px] font-bold tabular-nums", tone.ink)}>{score}%</span>
    </span>
  );
}
