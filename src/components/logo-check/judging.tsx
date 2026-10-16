/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { cx } from "@/lib/cx";
import type { Locale } from "@/lib/i18n/config";
import type { Translate } from "@/lib/i18n/translate";
import type { EntryReport } from "@/lib/logo-check/entry-check";
import { JUDGING_SORTS, type JudgingSort, type LevelRanges } from "@/lib/logo-check/entry-rules";
import { formatNumber } from "@/lib/money";
import { FullReportButton } from "./full-report";
import { LEVEL_TONE, MatchBadge, ScoreRing, ShieldIcon } from "./match";

/**
 * The client's judging page with the logo check (owner, 2026-10-14; Design/logo-check/client-entries-with-check.html):
 * the sort bar (Pro first is the default), "n of m entries checked", the legend and the report panel.
 */

export function JudgingSortBar({ current, href, t, checker }: { current: JudgingSort; href: (s: JudgingSort) => string; t: Translate; checker: boolean }) {
  const sorts = JUDGING_SORTS.filter((s) => checker || s !== "lowest");
  return (
    <div>
      <nav aria-label={t("entryCheck.judge.sort")} className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]">
        <span className="shrink-0 text-[12px] font-bold uppercase tracking-[0.12em] text-muted">{t("entryCheck.judge.sort")}</span>
        <ul className="m-0 flex w-max list-none gap-1 rounded-[14px] bg-surface p-1 ring-1 ring-line">
          {sorts.map((s) => (
            <li key={s}>
              <Link
                href={href(s)}
                scroll={false}
                aria-current={s === current ? "true" : undefined}
                className={cx(
                  "flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-[11px] px-3.5 text-[14px] font-bold transition-colors",
                  s === current ? "bg-ink text-white" : "text-muted hover:text-ink",
                )}
              >
                {t(`entryCheck.judge.sorts.${s}`)}
                {(s === "pro" || s === "lowest") && (
                  <span className={cx("rounded-full px-1.5 py-px text-[10.5px] font-bold", s === current ? "bg-white/20 text-white" : s === "pro" ? "bg-chip text-muted" : "bg-tint text-primary")}>
                    {s === "pro" ? t("entryCheck.judge.defaultTag") : t("entryCheck.judge.checkerTag")}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <p className="m-0 mt-2 text-[13px] text-muted">{t(`entryCheck.judge.hints.${current}`)}</p>
    </div>
  );
}

export function CheckedSummary({ checked, total, t, locale }: { checked: number; total: number; t: Translate; locale: Locale }) {
  const n = (v: number) => formatNumber(v, locale);
  return (
    <div className="flex items-center gap-3 rounded-[18px] bg-[#eef8f2] px-4 py-3 ring-1 ring-[#cfe9da]">
      <ShieldIcon className="size-5 text-[#14633c]" />
      <div>
        <p className="m-0 font-bold text-ink">{checked === 1 ? t("entryCheck.judge.checkedOne", { m: n(total) }) : t("entryCheck.judge.checked", { n: n(checked), m: n(total) })}</p>
        <p className="m-0 text-[13px] text-[#14633c]">{t("entryCheck.judge.checkedLead")}</p>
      </div>
    </div>
  );
}

export function CheckLegend({ ranges, t }: { ranges: LevelRanges; t: Translate }) {
  const rows: [Parameters<typeof MatchBadge>[0]["badge"], string][] = [
    [{ kind: "checked", level: "low", score: -1, reportId: "" }, t("entryCheck.legend.low", { from: 0, to: ranges.lowMax })],
    [{ kind: "checked", level: "medium", score: -1, reportId: "" }, t("entryCheck.legend.medium", { from: ranges.lowMax + 1, to: ranges.mediumMax })],
    [{ kind: "checked", level: "high", score: -1, reportId: "" }, t("entryCheck.legend.high", { from: ranges.mediumMax + 1 })],
    [{ kind: "none" }, t("entryCheck.legend.none")],
  ];
  return (
    <ul className="m-0 mt-6 flex list-none flex-wrap gap-x-6 gap-y-2.5 rounded-[18px] bg-surface p-4 ring-1 ring-line">
      {rows.map(([b, line]) => (
        <li key={b.kind === "checked" ? b.level : "none"} className="flex flex-wrap items-center gap-2 text-[13.5px] text-muted">
          <span className={cx("inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-bold", LEVEL_TONE[b.kind === "checked" ? b.level : "none"].pill)}>
            <ShieldIcon warn={b.kind === "checked" && b.level !== "low"} />
            {b.kind === "checked" ? t(`entryCheck.badge.${b.level}`) : t("entryCheck.badge.none")}
          </span>
          {line}
        </li>
      ))}
    </ul>
  );
}

const when = (iso: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));

/** Click an entry's badge: the originality report next to the entries (source links only, never copies). */
export function ReportPanel({ report, closeHref, t, locale }: { report: EntryReport; closeHref: string; t: Translate; locale: Locale }) {
  const n = (v: number) => formatNumber(v, locale);
  const tone = LEVEL_TONE[report.level];
  const row = (k: string, v: React.ReactNode) => (
    <div className="flex items-start justify-between gap-4 border-t border-line px-3 py-2.5 text-[13.5px] first:border-t-0">
      <span className="shrink-0 text-muted">{k}</span>
      <span className="text-right font-bold text-ink">{v}</span>
    </div>
  );
  return (
    <section id="report" aria-labelledby="report-title" className="lc-card scroll-mt-32 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[#14633c]">
            <ShieldIcon className="size-3.5" />
            {t("entryCheck.report.kicker")}
          </p>
          <h2 id="report-title" className="m-0 mt-1 text-[22px] font-semibold tracking-[-0.02em] text-ink">{t("entryCheck.report.title", { n: n(report.entry.number) })}</h2>
          <p className="m-0 text-[13.5px] text-muted">{t("entryCheck.report.by", { name: report.designer.username ? `@${report.designer.username}` : report.designer.name, plan: report.designer.pro ? "Pro" : t("entryCheck.judge.basic") })}</p>
        </div>
        <Link href={closeHref} scroll={false} aria-label={t("entryCheck.report.close")} className="flex size-11 shrink-0 items-center justify-center rounded-[12px] text-muted ring-1 ring-line hover:text-ink">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
        </Link>
      </div>
      {report.entry.coverUrl && <img src={report.entry.coverUrl} alt="" className="mt-4 aspect-[4/3] max-h-56 w-full rounded-[16px] bg-white object-contain ring-1 ring-line" />}
      <div className={cx("mt-3 flex items-center gap-3 rounded-[16px] p-3", tone.soft)}>
        <ScoreRing score={report.score} level={report.level} size={60} />
        <div className="min-w-0">
          <MatchBadge badge={{ kind: "checked", level: report.level, score: report.score, reportId: report.reportId }} t={t} />
          <p className="m-0 mt-1 text-[13.5px] text-ink">{t(`entryCheck.report.lines.${report.level}`)}</p>
        </div>
      </div>
      {/* Owner, 2026-10-16: everything the designer's check found, no new check needed. */}
      <FullReportButton checkId={report.checkId} label={t("checker.full.openLong")} variant="solid" className="mt-3 w-full" />
      <div className="mt-3 rounded-[14px] ring-1 ring-line">
        {row(t("entryCheck.report.checked"), t("entryCheck.report.checkedValue", { date: when(report.checkedAt, locale) }))}
        {row(t("entryCheck.report.searched"), t("entryCheck.report.searchedValue", { n: n(report.sourcesCount) }))}
        {row(t("entryCheck.report.file"), report.sameFile ? t("entryCheck.report.sameFile") : t("entryCheck.report.fileChanged"))}
        {row(t("entryCheck.report.reportId"), <span className="font-mono tracking-wide">{report.reportId}</span>)}
      </div>
      <h3 className="m-0 mt-4 text-[15px] font-bold text-ink">{t("entryCheck.report.closest")}</h3>
      {report.results.length === 0 ? (
        <p className="m-0 mt-1 text-[13.5px] text-muted">{t("entryCheck.report.none")}</p>
      ) : (
        <ul className="m-0 mt-2 list-none space-y-2 p-0">
          {report.results.map((r, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-chip text-muted" aria-hidden>
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
              </span>
              <div className="min-w-0 flex-1">
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="block truncate text-[14px] font-bold text-ink hover:text-primary">
                    {r.name}
                  </a>
                ) : (
                  <span className="block truncate text-[14px] font-bold text-ink">{r.name}</span>
                )}
                <span className="text-[12.5px] text-muted">{t("entryCheck.report.similar", { n: n(r.similarity) })}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="m-0 mt-2 text-[12.5px] text-muted">{t("entryCheck.report.sourcesNote")}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <a href={`/verify/${report.reportId}`} target="_blank" rel="noopener" className="lc-g flex min-h-11 items-center justify-center gap-1.5 rounded-[14px] bg-[image:var(--gradient-red)] px-4 text-[14px] font-bold text-white hover:brightness-110">
          {t("entryCheck.report.openVerify")}
        </a>
        <a href={`/api/entries/report/${report.reportId}`} className="flex min-h-11 items-center justify-center rounded-[14px] border border-line bg-surface px-4 text-[14px] font-bold text-ink hover:bg-chip">
          {t("entryCheck.report.download")}
        </a>
      </div>
      <p className="m-0 mt-3 flex items-center gap-1.5 text-[12.5px] font-bold text-[#8a5a00]">
        <ShieldIcon className="size-3.5" warn />
        {t("entryCheck.report.note")}
      </p>
    </section>
  );
}
