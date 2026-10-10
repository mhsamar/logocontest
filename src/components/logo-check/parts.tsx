"use client";

import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import type { Verdict } from "@/lib/logo-check/rules";
import type { Sources } from "@/lib/logo-check/run";

/** Small pieces of the AI copyright checker screens (owner, 2026-10-10). */

export function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
      <path d="M9 12l2.2 2.2L15.5 10" />
    </svg>
  );
}

/** Verdict colours: green no match, orange similar, red high risk (handoff). */
export const VERDICT_TONE: Record<Verdict, { pill: string; banner: string }> = {
  no_match: { pill: "bg-[#e3f3ea] text-[#14633c]", banner: "bg-[#e3f3ea] ring-[#14633c]/20" },
  similar: { pill: "bg-[#ffedd5] text-[#9a3412]", banner: "bg-[#fff7ed] ring-[#d08a1e]/40" },
  high_risk: { pill: "bg-[#fde3e1] text-[#a3121b]", banner: "bg-[#fde3e1]/60 ring-[#a3121b]/30" },
};

export function VerdictPill({ verdict, className }: { verdict: Verdict; className?: string }) {
  const { t } = useI18n();
  return <span className={cx("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-bold", VERDICT_TONE[verdict].pill, className)}>{t(`checker.verdicts.${verdict}`)}</span>;
}

export function VerdictBanner({ verdict, close, closest, name }: { verdict: Verdict; close: number; closest: number; name: string }) {
  const { t } = useI18n();
  const title = verdict === "high_risk" ? t("checker.result.highTitle") : verdict === "similar" ? (close === 1 ? t("checker.result.similarOne") : t("checker.result.similarMany", { n: String(close) })) : t("checker.result.noneTitle");
  return (
    <div className={cx("rounded-[16px] p-4 ring-1", VERDICT_TONE[verdict].banner)}>
      <VerdictPill verdict={verdict} />
      <p className="m-0 mt-2 text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">{title}</p>
      <p className="m-0 mt-1 text-[15px] text-ink/80">{closest > 0 ? t("checker.result.closestLine", { pct: String(closest), name }) : t("checker.result.noneLine")}</p>
    </div>
  );
}

/** A score as a ring, 0-100. */
export function ScoreRing({ value }: { value: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const tone = value >= 70 ? "#14633c" : value >= 45 ? "#d08a1e" : "#a3121b";
  return (
    <svg viewBox="0 0 56 56" className="size-14" role="img" aria-label={`${value} / 100`}>
      <circle cx="28" cy="28" r={r} fill="none" stroke="#eeeff2" strokeWidth="5" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={tone} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(c * value) / 100} ${c}`} transform="rotate(-90 28 28)" />
      <text x="28" y="33" textAnchor="middle" className="fill-ink text-[15px] font-bold">
        {value}
      </text>
    </svg>
  );
}

/** "How we checked": only the searches that really ran are named (owner, 2026-10-10). */
export function SourceList({ sources: s }: { sources: Sources }) {
  const { t } = useI18n();
  const found = (n: number) => (n ? t("checker.how.found", { n: String(n) }) : t("checker.how.nothingFound"));
  const rows: { title: string; line: string; value: string; good: boolean }[] = [];
  if (s.lens.ran) rows.push({ title: t("checker.search.lensTitle"), line: t("checker.run.webLine"), value: found(s.lens.found), good: false });
  if (s.vision.ran) rows.push({ title: t("checker.search.visionTitle"), line: t("checker.how.visionLine"), value: found(s.vision.found), good: false });
  if (s.site.ran) rows.push({ title: t("checker.run.site"), line: t("checker.run.siteLine"), value: s.site.close ? t("checker.how.similarDesigns", { n: String(s.site.close) }) : t("checker.how.nothingSimilar"), good: !s.site.close });
  rows.push({
    title: t("checker.run.shape"),
    line: t("checker.run.shapeLine"),
    value: s.shape.close ? t("checker.how.close", { close: String(s.shape.close), not: String(Math.max(0, s.shape.compared - s.shape.close)) }) : s.shape.compared ? t("checker.how.noneClose", { n: String(s.shape.compared) }) : t("checker.how.nothingToCompare"),
    good: !s.shape.close,
  });
  rows.push({ title: t("checker.run.font"), line: t("checker.run.fontLine"), value: !s.font.hasText ? t("checker.how.noText") : s.font.guess ? t("checker.how.looksLike", { font: s.font.guess }) : t("checker.how.checked"), good: true });
  return (
    <ul className="m-0 mt-2 list-none divide-y divide-line p-0">
      {rows.map((r) => (
        <li key={r.title} className="flex items-center gap-3 py-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-ink">{r.title}</span>
            <span className="block text-[13.5px] text-muted">{r.line}</span>
          </span>
          <span className={cx("shrink-0 rounded-full px-2.5 py-0.5 text-[12.5px] font-bold", r.good ? "bg-[#e3f3ea] text-[#14633c]" : "bg-[#ffedd5] text-[#9a3412]")}>{r.value}</span>
        </li>
      ))}
    </ul>
  );
}
