import type { Metadata } from "next";
import Link from "next/link";
import { AdminHead } from "@/components/admin/page-head";
import { AdmCard, AdmEmpty, CardTitle, IdChip, KpiGrid, KpiTile, Pill, TableCard } from "@/components/admin/ui";
import { requirePermission } from "@/lib/admin/core";
import { getI18n } from "@/lib/i18n/server";
import { costReport, monthFromKey } from "@/lib/logo-check/cost-report";
import { formatNumber } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("entryCheck.costs.title"), robots: { index: false } };
}

// Admin › Copyright checker › Cost report (owner, 2026-10-14): the logo checker's API cost in taka, per check, per
// contest and per month, with the prices from Settings and a CSV download.
export default async function CheckerCostsPage({ searchParams }: PageProps<"/admin/copyright/costs">) {
  await requirePermission("copyright.view");
  const sp = await searchParams;
  const [{ t, locale }, r] = await Promise.all([getI18n(), costReport(typeof sp.month === "string" ? sp.month : null)]);
  const num = (n: number) => formatNumber(n, locale);
  const tk = (n: number) => `৳${n.toLocaleString(locale === "bn" ? "bn-BD" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const monthName = (key: string) => new Date(`${key}-15T00:00:00Z`).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const when = (iso: string) => new Date(iso).toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dhaka" });
  const months = [...new Set([monthFromKey(null).key, ...r.byMonth.map((m) => m.key)])];
  const STATUS: Record<string, "good" | "bad" | "neutral"> = { done: "good", failed: "bad", queued: "neutral", running: "neutral" };

  return (
    <div className="space-y-4 sm:space-y-5">
      <AdminHead
        title={t("entryCheck.costs.title")}
        lead={t("entryCheck.costs.lead")}
        crumbs={[{ href: "/admin/copyright", label: t("admin.copyright.title") }]}
        actions={
          <a href={`/admin/copyright/costs/export?month=${r.month.key}`} className="inline-flex min-h-11 items-center gap-2 rounded-[12px] bg-ink px-4 text-[15px] font-bold text-white hover:bg-ink/85">
            {t("entryCheck.costs.download")}
          </a>
        }
      />

      <AdmCard className="flex flex-wrap items-center gap-2 p-3 sm:p-4">
        <span className="text-[14px] font-semibold text-adm-soft">{t("entryCheck.costs.month")}</span>
        {months.map((k) => (
          <Link key={k} href={`/admin/copyright/costs?month=${k}`} className={`inline-flex min-h-10 items-center rounded-full px-3.5 text-[14px] font-bold ${k === r.month.key ? "bg-ink text-white" : "bg-adm-bg text-ink hover:bg-adm-line"}`}>
            {monthName(k)}
          </Link>
        ))}
      </AdmCard>

      <KpiGrid>
        <KpiTile label={t("entryCheck.costs.kTotal")} value={tk(r.totals.bdt)} hint={t("entryCheck.costs.kTotalHint", { usd: r.totals.usd.toFixed(2) })} accent />
        <KpiTile label={t("entryCheck.costs.kChecks")} value={num(r.totals.checks)} hint={t("entryCheck.costs.kChecksHint", { done: num(r.totals.done), failed: num(r.totals.failed) })} />
        <KpiTile label={t("entryCheck.costs.kAvg")} value={tk(r.totals.avgBdt)} hint={t("entryCheck.costs.kAvgHint")} />
        <KpiTile label={t("entryCheck.costs.kContests")} value={num(r.byContest.length)} hint={t("entryCheck.costs.kContestsHint")} />
      </KpiGrid>

      <AdmCard className="p-4 sm:p-5">
        <CardTitle
          title={t("entryCheck.costs.rates")}
          action={
            <Link href="/admin/settings" className="inline-flex min-h-11 items-center gap-1 text-[15px] font-bold text-primary hover:underline">
              {t("entryCheck.costs.changeRates")}
            </Link>
          }
        />
        <dl className="m-0 mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            [t("entryCheck.costs.rateBdt"), `৳${num(r.rates.usdToBdt)}`],
            [t("entryCheck.costs.rateLens"), `$${(r.rates.lens * 1000).toFixed(2)}`],
            [t("entryCheck.costs.rateVision"), `$${(r.rates.vision * 1000).toFixed(2)}`],
            [t("entryCheck.costs.rateAiIn"), `$${(r.rates.aiIn * 1_000_000).toFixed(2)}`],
            [t("entryCheck.costs.rateAiOut"), `$${(r.rates.aiOut * 1_000_000).toFixed(2)}`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-[12px] bg-adm-bg p-4">
              <dt className="text-[13.5px] font-semibold text-adm-soft">{k}</dt>
              <dd className="m-0 mt-1 text-[20px] font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="m-0 mt-3 text-[13.5px] text-muted">{t("entryCheck.costs.ratesNote")}</p>
      </AdmCard>

      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <AdmCard className="p-4 sm:p-5">
          <CardTitle title={t("entryCheck.costs.byMonth")} />
          {r.byMonth.length === 0 ? (
            <div className="mt-3">
              <AdmEmpty>{t("entryCheck.costs.none")}</AdmEmpty>
            </div>
          ) : (
            <ul className="m-0 mt-3 list-none divide-y divide-adm-line-soft p-0">
              {r.byMonth.map((m) => (
                <li key={m.key} className="flex items-center justify-between gap-3 py-2.5 text-[15px]">
                  <Link href={`/admin/copyright/costs?month=${m.key}`} className="font-bold text-ink hover:text-primary">
                    {monthName(m.key)}
                  </Link>
                  <span className="text-muted">
                    {m.checks === 1 ? t("entryCheck.costs.checksOne") : t("entryCheck.costs.checksN", { n: num(m.checks) })} · <b className="text-ink">{tk(m.bdt)}</b>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdmCard>
        <AdmCard className="p-4 sm:p-5">
          <CardTitle title={t("entryCheck.costs.byContest")} />
          {r.byContest.length === 0 ? (
            <div className="mt-3">
              <AdmEmpty>{t("entryCheck.costs.none")}</AdmEmpty>
            </div>
          ) : (
            <ul className="m-0 mt-3 list-none divide-y divide-adm-line-soft p-0">
              {r.byContest.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-[15px]">
                  <Link href={`/admin/contests/${c.slug}`} className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 font-bold text-ink hover:text-primary">
                      {c.brand}
                      <IdChip prefix="LC" n={c.number} />
                    </span>
                    <span className="block text-[13.5px] text-muted">{c.client}</span>
                  </Link>
                  <span className="text-muted">
                    {c.checks === 1 ? t("entryCheck.costs.checksOne") : t("entryCheck.costs.checksN", { n: num(c.checks) })} · <b className="text-ink">{tk(c.bdt)}</b>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdmCard>
      </div>

      {r.rows.length === 0 ? (
        <AdmCard className="p-4">
          <AdmEmpty>{t("entryCheck.costs.none")}</AdmEmpty>
        </AdmCard>
      ) : (
        <TableCard>
          <table className="w-full min-w-[860px] text-left text-[15px]">
            <thead className="border-b border-adm-line text-[12.5px] uppercase tracking-[0.08em] text-adm-soft">
              <tr>
                <th className="px-4 py-3 font-bold">{t("entryCheck.costs.colWhen")}</th>
                <th className="px-4 py-3 font-bold">{t("entryCheck.costs.colWho")}</th>
                <th className="px-4 py-3 font-bold">{t("entryCheck.costs.colContest")}</th>
                <th className="px-4 py-3 font-bold">{t("entryCheck.costs.colStatus")}</th>
                <th className="px-4 py-3 text-right font-bold">{t("entryCheck.costs.colCost")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-adm-line-soft">
              {r.rows.map((row) => (
                <tr key={row.id} className="hover:bg-adm-row">
                  <td className="px-4 py-3">
                    <IdChip prefix="CC" n={row.number} />
                    <span className="block text-[13px] text-muted">{when(row.at)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${row.who.id}`} className="font-bold text-ink hover:text-primary">
                      {row.who.name}
                    </Link>
                    <span className="block font-mono text-[12px] text-muted">
                      {row.kind === "client" ? t("entryCheck.costs.client") : t("entryCheck.costs.designer")} · {row.who.id.slice(0, 8)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {row.contest ? (
                      <Link href={`/admin/contests/${row.contest.slug}`} className="font-bold text-ink hover:text-primary">
                        {row.contest.brand}
                        <span className="block font-mono text-[12px] font-semibold text-muted">{row.contest.number ? `LC-${String(row.contest.number).padStart(4, "0")}` : ""}</span>
                      </Link>
                    ) : (
                      <span className="text-muted">{t("entryCheck.costs.ownCheck")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Pill tone={STATUS[row.status]}>{t(`entryCheck.costs.status.${row.status}`)}</Pill>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <b className="tabular-nums text-ink">{tk(row.costBdt)}</b>
                    <span className="block text-[12.5px] tabular-nums text-muted">
                      ${row.costUsd.toFixed(4)}
                      {row.estimated ? ` · ${t("entryCheck.costs.estimated")}` : ""}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      )}
    </div>
  );
}
