import Link from "@/components/ui/link";
import { AdmCard, CardTitle } from "@/components/admin/ui";
import { cx } from "@/lib/cx";
import type { Translate } from "@/lib/i18n/translate";
import { conversionPercent, POPUP_RANGES, type PopupRange, type PopupStats } from "@/lib/visitor-popup/stats";

/**
 * "Visitor pop-up" on Admin → Analytics (owner, 2026-10-13): how often it opened, the clicks on each button, the
 * closes (and "Don't show this again"), the sign-ups that started from it, the conversion and a bar per day.
 * Anonymous counts only: no names, emails or IPs.
 */
export function PopupCard({ s, range, t, num, dayLabel, hrefFor }: { s: PopupStats; range: PopupRange; t: Translate; num: (n: number) => string; dayLabel: (day: string) => string; hrefFor: (r: PopupRange) => string }) {
  const signups = s.signupClients + s.signupDesigners;
  const top = Math.max(1, ...s.days.map((d) => Math.max(d.shown, d.signups)));
  const tiles = [
    { label: t("admin.analytics.popup.shown"), value: num(s.shown) },
    { label: t("admin.analytics.popup.clickClient"), value: num(s.clickClient) },
    { label: t("admin.analytics.popup.clickDesigner"), value: num(s.clickDesigner) },
    { label: t("admin.analytics.popup.closed"), value: num(s.closed), hint: t("admin.analytics.popup.never", { n: num(s.never) }) },
    { label: t("admin.analytics.popup.signups"), value: num(signups), hint: t("admin.analytics.popup.signupsHint", { clients: num(s.signupClients), designers: num(s.signupDesigners) }) },
    { label: t("admin.analytics.popup.conversion"), value: `${num(conversionPercent(signups, s.shown))}%`, hint: t("admin.analytics.popup.conversionHint") },
  ];
  return (
    <AdmCard className="flex flex-col gap-4 p-5 sm:p-6" aria-labelledby="popup-card">
      <CardTitle
        title={<span id="popup-card">{t("admin.analytics.popup.title")}</span>}
        sub={t("admin.analytics.popup.lead", { n: num(range) })}
        action={
          <nav aria-label={t("admin.analytics.popup.range")} className="flex gap-1 rounded-full bg-adm-bg p-1">
            {POPUP_RANGES.map((r) => (
              <Link
                key={r}
                href={hrefFor(r)}
                scroll={false}
                aria-current={r === range ? "page" : undefined}
                className={cx("inline-flex min-h-9 items-center rounded-full px-3.5 text-[14px] font-bold", r === range ? "bg-ink text-white" : "text-muted hover:text-ink")}
              >
                {t("admin.analytics.popup.days", { n: num(r) })}
              </Link>
            ))}
          </nav>
        }
      />
      {!s.ready && <p className="m-0 rounded-[12px] bg-[#fff7e8] px-3.5 py-2.5 text-sm text-[#6b4e00]">{t("admin.analytics.popup.notReady")}</p>}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {tiles.map((k) => (
          <div key={k.label} className="flex flex-col gap-1 rounded-[14px] bg-adm-bg p-3.5">
            <span className="text-[13.5px] font-semibold text-muted">{k.label}</span>
            <span className="lc-d text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{k.value}</span>
            {k.hint && <span className="text-[13px] text-muted">{k.hint}</span>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4 text-[13.5px] font-semibold text-muted">
        <span className="inline-flex items-center gap-1.5">
          <i className="size-3 rounded-[3px] bg-[#c9ccd3]" />
          {t("admin.analytics.popup.shown")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="size-3 rounded-[3px] bg-primary" />
          {t("admin.analytics.popup.signups")}
        </span>
      </div>
      <div className="overflow-x-auto">
        <div role="img" aria-label={t("admin.analytics.popup.chart", { shown: num(s.shown), signups: num(signups) })} className="flex h-36 items-end gap-[3px]" style={{ minWidth: s.days.length * 12 }}>
          {s.days.map((d) => (
            <div key={d.day} className="flex h-full min-w-[9px] flex-1 items-end justify-center gap-px" title={`${dayLabel(d.day)}: ${num(d.shown)} · ${num(d.signups)}`}>
              <span className="w-1/2 max-w-3 rounded-t-[3px] bg-[#c9ccd3]" style={{ height: `${Math.max(d.shown ? 3 : 1, (d.shown / top) * 100)}%` }} />
              <span className="w-1/2 max-w-3 rounded-t-[3px] bg-primary" style={{ height: `${Math.max(d.signups ? 3 : 1, (d.signups / top) * 100)}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[13px] text-muted" style={{ minWidth: s.days.length * 12 }}>
          <span>{dayLabel(s.days[0]?.day ?? "")}</span>
          <span>{dayLabel(s.days[s.days.length - 1]?.day ?? "")}</span>
        </div>
      </div>
    </AdmCard>
  );
}
