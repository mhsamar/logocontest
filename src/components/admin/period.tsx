import { getI18n } from "@/lib/i18n/server";
import type { PeriodKey } from "@/lib/admin/period";
import { AdmCard, ADM_INPUT, Tabs } from "./ui";

/** The period buttons for a page header (design/admin/dashboard.html). `base` is the page address. */
export async function PeriodTabs({ base, keys, current, fallback = "30" }: { base: string; keys: readonly PeriodKey[]; current: PeriodKey; fallback?: PeriodKey }) {
  const { t } = await getI18n();
  return (
    <Tabs
      label={t("admin.dashboard.range")}
      items={keys.map((r) => ({
        href: r === fallback ? base : `${base}?range=${r}`,
        label: t(`admin.dashboard.ranges.${r}`),
        active: r === current,
        icon: r === "custom" ? ("calendar" as const) : undefined,
      }))}
    />
  );
}

/** The From / To form shown when Custom is picked. `valid` is false until both dates make a period. */
export async function CustomRange({ base, from, to, valid }: { base: string; from: string; to: string; valid: boolean }) {
  const { t } = await getI18n();
  return (
    <AdmCard className="p-4">
      <form action={base} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="range" value="custom" />
        <label className="flex min-w-40 flex-1 flex-col gap-1.5 text-sm font-semibold text-adm-strong sm:flex-none">
          {t("admin.dashboard.from")}
          <input type="date" name="from" defaultValue={from} required className={ADM_INPUT} />
        </label>
        <label className="flex min-w-40 flex-1 flex-col gap-1.5 text-sm font-semibold text-adm-strong sm:flex-none">
          {t("admin.dashboard.to")}
          <input type="date" name="to" defaultValue={to} required className={ADM_INPUT} />
        </label>
        <button type="submit" className="h-12 rounded-[12px] bg-primary px-6 text-[15px] font-bold text-white hover:bg-adm-deep">
          {t("admin.dashboard.show")}
        </button>
        {!valid && <p className="m-0 w-full text-sm text-muted">{t("admin.dashboard.customHint")}</p>}
      </form>
    </AdmCard>
  );
}
