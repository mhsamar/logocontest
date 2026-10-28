import Link from "@/components/ui/link";
import { AdminHead } from "@/components/admin/page-head";
import { AdmCard, CardTitle, KpiGrid, KpiTile, Pill, TableCard } from "@/components/admin/ui";
import { designCheckUsd, supportReplyUsd, type CostLine, type CostLineKey } from "@/lib/admin/cost-rules";
import type { CostsPage } from "@/lib/admin/costs";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";

const AI: CostLineKey[] = ["checker", "support"];
const NUDE: CostLineKey[] = ["safeSearch", "designCheck"];

// Admin › Costs (owner, 2026-10-27): what the AI, the nude photo checks and emails cost each month, counted by the
// site itself (no hosting or other bills), with the five months before and the prices from Settings.
export async function CostsView({ r, links }: { r: CostsPage; links: { report: boolean; settings: boolean } }) {
  const { t, locale } = await getI18n();
  const num = (n: number) => formatNumber(n, locale);
  const tk = (n: number) => `৳${n.toLocaleString(locale === "bn" ? "bn-BD" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const monthName = (key: string) => new Date(`${key.slice(0, 7)}-15T00:00:00Z`).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const sum = (lines: CostLine[], keys: CostLineKey[]) => lines.filter((l) => keys.includes(l.key)).reduce((a, l) => a + l.bdt, 0);
  const line = (key: CostLineKey) => r.month.lines.find((l) => l.key === key)!;
  const email = line("email");
  const p = r.prices;
  const bdt = (usd: number) => tk(Math.round(usd * p.usdToBdt * 100) / 100);
  const chosen = r.month.key;

  return (
    <div className="space-y-4 sm:space-y-5">
      <AdminHead title={t("admin.costs.title")} lead={t("admin.costs.lead")} />

      <AdmCard className="flex flex-wrap items-center gap-2 p-3 sm:p-4">
        <span className="text-[14px] font-semibold text-adm-soft">{t("admin.costs.month")}</span>
        {r.history.map((m) => (
          <Link key={m.key} href={`/admin/costs?month=${m.key}`} className={`inline-flex min-h-10 items-center rounded-full px-3.5 text-[14px] font-bold ${m.key === chosen ? "bg-ink text-white" : "bg-adm-bg text-ink hover:bg-adm-line"}`}>
            {monthName(m.key)}
          </Link>
        ))}
      </AdmCard>

      <KpiGrid>
        <KpiTile label={t("admin.costs.kTotal", { month: monthName(chosen) })} value={tk(r.month.total)} hint={t("admin.costs.kTotalHint")} accent />
        <KpiTile label={t("admin.costs.kAi")} value={tk(sum(r.month.lines, AI))} hint={t("admin.costs.kAiHint")} />
        <KpiTile label={t("admin.costs.kNude")} value={tk(sum(r.month.lines, NUDE))} hint={t("admin.costs.kNudeHint")} />
        <KpiTile label={t("admin.costs.kEmail")} value={tk(email.bdt)} hint={t("admin.costs.kEmailHint", { used: num(email.count), limit: num(p.emailFree) })} />
      </KpiGrid>

      <TableCard>
        <table className="w-full min-w-[720px] text-left text-[15px]">
          <thead className="border-b border-adm-line text-[12.5px] uppercase tracking-[0.08em] text-adm-soft">
            <tr>
              <th className="px-4 py-3 font-bold">{t("admin.costs.colService")}</th>
              <th className="px-4 py-3 font-bold">{t("admin.costs.colCount")}</th>
              <th className="px-4 py-3 text-right font-bold">{t("admin.costs.colCost")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-adm-line-soft">
            {r.month.lines.map((l) => (
              <tr key={l.key} className="align-top hover:bg-adm-row">
                <td className="px-4 py-3.5">
                  <span className="flex flex-wrap items-center gap-2 font-bold text-ink">
                    {t(`admin.costs.lines.${l.key}.name` as MessageKey)}
                    {l.off ? <Pill tone="neutral">{t("admin.costs.off")}</Pill> : <Pill tone={l.exact ? "good" : "warn"}>{t(l.exact ? "admin.costs.exact" : "admin.costs.estimate")}</Pill>}
                  </span>
                  <span className="mt-0.5 block max-w-[520px] text-[13.5px] text-muted">{t(`admin.costs.lines.${l.key}.what` as MessageKey)}</span>
                  {l.off && <span className="mt-0.5 block text-[13.5px] text-muted">{t("admin.costs.offNote")}</span>}
                  {l.key === "checker" && links.report && (
                    <Link href={`/admin/copyright/costs?month=${r.month.key}`} className="mt-1 inline-flex min-h-9 items-center text-[14px] font-bold text-primary hover:underline">
                      {t("admin.costs.report")} →
                    </Link>
                  )}
                </td>
                <td className="px-4 py-3.5 text-ink">
                  {t(`admin.costs.lines.${l.key}.unit` as MessageKey, { n: num(l.count) })}
                  {l.free && <span className="block text-[13.5px] text-muted">{t("admin.costs.freeUsed", { used: num(l.free.used), limit: num(l.free.limit) })}</span>}
                  {l.key === "email" && r.month.emailsFailed > 0 && <span className="block text-[13.5px] text-muted">{t("admin.costs.emailsFailed", { n: num(r.month.emailsFailed) })}</span>}
                </td>
                <td className="px-4 py-3.5 text-right text-[16px] font-semibold text-ink">{tk(l.bdt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:items-start">
        <TableCard>
          <div className="px-4 pt-4 sm:px-5">
            <CardTitle title={t("admin.costs.history")} />
          </div>
          <table className="mt-3 w-full min-w-[640px] text-left text-[15px]">
            <thead className="border-b border-adm-line text-[12.5px] uppercase tracking-[0.08em] text-adm-soft">
              <tr>
                <th className="px-4 py-3 font-bold">{t("admin.costs.colMonth")}</th>
                <th className="px-4 py-3 text-right font-bold">{t("admin.costs.kAi")}</th>
                <th className="px-4 py-3 text-right font-bold">{t("admin.costs.kNude")}</th>
                <th className="px-4 py-3 text-right font-bold">{t("admin.costs.kEmail")}</th>
                <th className="px-4 py-3 text-right font-bold">{t("admin.costs.colTotal")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-adm-line-soft">
              {r.history.map((m) => (
                <tr key={m.key} className={m.key === chosen ? "bg-adm-row" : "hover:bg-adm-row"}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/costs?month=${m.key}`} className="font-bold text-ink hover:text-primary">
                      {monthName(m.key)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right text-muted">{tk(sum(m.lines, AI))}</td>
                  <td className="px-4 py-3 text-right text-muted">{tk(sum(m.lines, NUDE))}</td>
                  <td className="px-4 py-3 text-right text-muted">{tk(sum(m.lines, ["email"]))}</td>
                  <td className="px-4 py-3 text-right font-semibold text-ink">{tk(m.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>

        <AdmCard className="p-4 sm:p-5">
          <CardTitle
            title={t("admin.costs.prices")}
            action={
              links.settings ? (
                <Link href="/admin/settings" className="inline-flex min-h-11 items-center gap-1 text-[15px] font-bold text-primary hover:underline">
                  {t("admin.costs.changePrices")}
                </Link>
              ) : undefined
            }
          />
          <dl className="m-0 mt-3 grid gap-2.5">
            {[
              [t("admin.costs.priceRate"), `৳${num(p.usdToBdt)}`],
              [t("admin.costs.priceAi"), `$${(p.aiIn * 1_000_000).toFixed(2)} / $${(p.aiOut * 1_000_000).toFixed(2)}`],
              [t("admin.costs.priceSafeSearch"), `$${(p.safeSearch * 1000).toFixed(2)}`],
              [t("admin.costs.priceEmail"), `$${(p.email * 1000).toFixed(2)}`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 rounded-[12px] bg-adm-bg px-4 py-3">
                <dt className="text-[14px] font-semibold text-adm-soft">{k}</dt>
                <dd className="m-0 text-[16px] font-semibold text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <h3 className="m-0 mt-5 text-[15px] font-bold text-ink">{t("admin.costs.howTitle")}</h3>
          <ul className="m-0 mt-2 list-disc space-y-1.5 pl-5 text-[14px] text-muted">
            <li>{t("admin.costs.how1")}</li>
            <li>{t("admin.costs.how2", { design: bdt(designCheckUsd(2, p)), answer: bdt(supportReplyUsd(p)) })}</li>
            <li>{t("admin.costs.how3", { free: num(p.safeSearchFree) })}</li>
            <li>{t("admin.costs.how4", { free: num(p.emailFree) })}</li>
          </ul>
        </AdmCard>
      </div>
    </div>
  );
}
