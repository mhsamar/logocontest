/* eslint-disable @next/next/no-img-element */
import { PageShell, Panel } from "@/components/ui/panel";
import { cx } from "@/lib/cx";
import type { Locale } from "@/lib/i18n/config";
import type { Translate } from "@/lib/i18n/translate";
import type { PublicReport } from "@/lib/logo-check/entry-check";
import { formatNumber } from "@/lib/money";
import { LEVEL_TONE, MatchBadge, ScoreRing, ShieldIcon } from "./match";

const when = (iso: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));

/**
 * The public verify page of an entry's originality report (owner, 2026-10-14; Design/logo-check): anyone with the
 * link sees that the report is real and whether the entry still uses the checked file. Summary only: no closest
 * results, no contact details; private contests show neither the design nor the contest name.
 */
export function ReportVerify({ report, reportId, t, locale }: { report: PublicReport | null; reportId: string; t: Translate; locale: Locale }) {
  if (!report)
    return (
      <PageShell>
        <Panel className="flex flex-1 flex-col items-center py-14 text-center">
          <p className="m-0 text-[13px] font-bold uppercase tracking-[0.16em] text-muted">{t("entryCheck.verify.kicker")}</p>
          <h1 className="m-0 mt-4 text-[clamp(26px,3.4vw,40px)] font-semibold tracking-[-0.035em] text-ink">{t("entryCheck.verify.notFound")}</h1>
          <p className="m-0 mt-2 max-w-md text-lg text-muted">{t("entryCheck.verify.notFoundBody")}</p>
        </Panel>
      </PageShell>
    );
  const valid = report.state === "valid";
  const n = (v: number) => formatNumber(v, locale);
  const row = (k: string, v: string) => (
    <div className="flex flex-col gap-0.5 border-t border-line px-4 py-3 text-[14.5px] first:border-t-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-muted">{k}</span>
      <span className="font-bold text-ink sm:text-right">{v}</span>
    </div>
  );
  return (
    <PageShell>
      <Panel className="flex-1 max-[720px]:py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex min-h-10 max-w-full items-center gap-2 truncate rounded-[12px] bg-chip px-3 text-[14px] font-bold text-ink">
            <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
            <span className="truncate">logocontest.bd/verify/{reportId}</span>
          </span>
          <span className={cx("inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-[15px] font-bold", valid ? "bg-[#e3f3ea] text-[#14633c]" : "bg-[#fff1d6] text-[#8a5a00]")}>
            <ShieldIcon className="size-4" warn={!valid} />
            {valid ? t("entryCheck.verify.valid") : t("entryCheck.verify.changed")}
          </span>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
          <div className="mx-auto flex aspect-square w-full max-w-sm items-center justify-center overflow-hidden rounded-[20px] bg-white ring-1 ring-line lg:max-w-none">
            {report.coverUrl ? (
              <img src={report.coverUrl} alt={t("entryCheck.verify.title", { n: n(report.entryNumber), contest: report.contest ?? "" })} className="size-full object-contain" />
            ) : (
              <p className="m-0 max-w-xs px-6 text-center text-muted">{t("entryCheck.verify.privateImage")}</p>
            )}
          </div>
          <div className="min-w-0">
            <p className="m-0 flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-[0.12em] text-[#14633c]">
              <ShieldIcon className="size-3.5" />
              {t("entryCheck.verify.kicker")}
            </p>
            <h1 className="m-0 mt-2 text-[clamp(24px,3vw,34px)] font-semibold tracking-[-0.03em] text-ink">
              {report.contest ? t("entryCheck.verify.title", { n: n(report.entryNumber), contest: report.contest }) : t("entryCheck.verify.titlePrivate", { n: n(report.entryNumber) })}
            </h1>
            <div className={cx("mt-4 flex items-center gap-4 rounded-[18px] p-4", LEVEL_TONE[report.level].soft)}>
              <ScoreRing score={report.score} level={report.level} />
              <div className="min-w-0">
                <MatchBadge badge={{ kind: "checked", level: report.level, score: report.score, reportId: report.reportId }} t={t} />
                <p className="m-0 mt-1 text-[14.5px] text-ink">{t(`entryCheck.report.lines.${report.level}`)}</p>
              </div>
            </div>
            <div className="mt-3 rounded-[16px] ring-1 ring-line">
              {row(t("entryCheck.verify.designer"), report.designer.username ? `${report.designer.name} (@${report.designer.username})` : report.designer.name)}
              {row(t("entryCheck.verify.checkedOn"), when(report.checkedAt, locale))}
              {row(t("entryCheck.verify.fingerprint"), valid ? t("entryCheck.verify.fingerprintValid", { sha: report.shortSha }) : t("entryCheck.verify.fingerprintChanged", { sha: report.shortSha }))}
              {row(t("entryCheck.verify.status"), valid ? t("entryCheck.verify.statusValid") : t("entryCheck.verify.statusChanged"))}
            </div>
            <p className="m-0 mt-3 flex items-center gap-1.5 text-[13px] font-bold text-[#8a5a00]">
              <ShieldIcon className="size-3.5" warn />
              {t("entryCheck.report.note")}
            </p>
          </div>
        </div>
        <p className="m-0 mt-6 rounded-[16px] bg-chip px-4 py-3 text-[14px] text-muted">{t("entryCheck.verify.foot")}</p>
      </Panel>
    </PageShell>
  );
}
