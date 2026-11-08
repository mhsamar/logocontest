import type { Metadata } from "next";
import { BriefSettings } from "@/components/admin/brief-settings";
import { AdminHead } from "@/components/admin/page-head";
import { requirePermission } from "@/lib/admin/core";
import { briefConfig, briefStats, briefV3On } from "@/lib/brief-v3/store";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.brief.title"), robots: { index: false } };
}

// Admin › Brief (owner, 2026-11-08): the new brief's switch, categories, suggestion templates and counts.
export default async function AdminBriefPage() {
  await requirePermission("content.view");
  const [{ t, locale }, on, { categories, templates }, stats] = await Promise.all([getI18n(), briefV3On(), briefConfig(), briefStats()]);
  const n = (v: number) => formatNumber(v, locale);
  const tiles: [string, string][] = [
    [t("admin.brief.statSaved"), n(stats.saved)],
    [t("admin.brief.statSuggest"), n(stats.suggest)],
    [t("admin.brief.statOther"), n(stats.other)],
    [t("admin.brief.statWords"), n(stats.avgWords)],
    [t("admin.brief.statSections"), n(stats.avgSections)],
    [t("admin.brief.statStep3"), `${n(stats.step3)} / ${n(stats.step2)}`],
    [t("admin.brief.statUpdates"), n(stats.updates)],
  ];
  return (
    <div className="flex flex-col gap-4">
      <AdminHead title={t("admin.brief.title")} lead={t("admin.brief.lead")} />
      <section className="rounded-[16px] border border-adm-line bg-surface p-4">
        <h2 className="m-0 text-[17px] font-semibold">{t("admin.brief.stats")}</h2>
        <p className="m-0 mt-1 text-[13px] text-muted">{t("admin.brief.statsHint")}</p>
        <dl className="m-0 mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tiles.map(([label, value]) => (
            <div key={label} className="rounded-[12px] bg-adm-bg p-3">
              <dt className="text-[12.5px] text-muted">{label}</dt>
              <dd className="m-0 mt-1 text-[20px] font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <BriefSettings key={JSON.stringify([on, categories, templates])} on={on} categories={categories} templates={templates} />
    </div>
  );
}
