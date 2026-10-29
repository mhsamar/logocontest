import { AdmCard, CardTitle } from "@/components/admin/ui";
import type { V2FunnelStep } from "@/lib/admin/dashboard";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";

/**
 * The new 4-step wizard's funnel on the Dashboard (owner, 2026-10-29; client-onboarding-v2-spec.md §4): how many people
 * reached each step in the chosen period, and what share of the step before. Styled like the Wizard drop-off chart.
 */
export async function V2FunnelCard({ steps }: { steps: V2FunnelStep[] }) {
  const { t, locale } = await getI18n();
  const num = (n: number) => formatNumber(n, locale);
  const top = Math.max(1, ...steps.map((s) => s.count));
  return (
    <AdmCard className="flex flex-col gap-[18px] p-5 sm:p-6" data-v2-funnel>
      <CardTitle title={t("wizardV2.admin.funnel.title")} sub={t("wizardV2.admin.funnel.help")} />
      <ol className="m-0 flex list-none flex-col gap-3 p-0 text-[14.5px]">
        {steps.map((s) => (
          <li key={s.key} className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="text-[13px] font-semibold text-adm-strong sm:text-[14.5px]">{t(`wizardV2.admin.funnel.${s.key}`)}</span>
              <span className="tabular-nums">
                <strong>{num(s.count)}</strong>
                {s.ofBefore !== null && <span className="text-muted"> · {t("wizardV2.admin.funnel.of", { pct: num(s.ofBefore) })}</span>}
              </span>
            </div>
            <span className="h-3 overflow-hidden rounded-full bg-[#f0f1f4]">
              <span className={cx("block h-full rounded-full", s.key === "sent" || s.key === "approved" ? "bg-adm-pay" : "bg-primary")} style={{ width: `${Math.max(Math.round((s.count / top) * 100), s.count ? 2 : 0)}%` }} />
            </span>
          </li>
        ))}
      </ol>
    </AdmCard>
  );
}
