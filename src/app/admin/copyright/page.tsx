import type { Metadata } from "next";
import Link from "next/link";
import { AdminIcon } from "@/components/admin/icons";
import { AdminHead } from "@/components/admin/page-head";
import { ADM_INPUT, AdmCard, AdmEmpty, CardTitle, IdChip, KpiGrid, KpiTile, Pill, TableCard, Tabs, type PillTone } from "@/components/admin/ui";
import { requirePermission } from "@/lib/admin/core";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { adminChecks, checkView, type AdminCheckRow } from "@/lib/logo-check/queries";
import type { Verdict } from "@/lib/logo-check/rules";
import { checkLimits } from "@/lib/logo-check/run";
import { formatNumber, formatTaka } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.copyright.title"), robots: { index: false } };
}

const TABS = ["all", "no_match", "similar", "high_risk"] as const;
type Tab = (typeof TABS)[number];
const TONE: Record<Verdict, PillTone> = { no_match: "good", similar: "warn", high_risk: "bad" };

// Admin: AI copyright checker (owner, 2026-10-10; Design/copyright-checker/admin-copyright-checker.html). View only.
export default async function AdminCopyrightPage({ searchParams }: PageProps<"/admin/copyright">) {
  const admin = await requirePermission("copyright.view");
  const sp = await searchParams;
  const tab: Tab = TABS.find((x) => x === sp.tab) ?? "all";
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const sel = typeof sp.sel === "string" ? sp.sel : null;
  const [{ t, locale }, rows, limits, detail] = await Promise.all([getI18n(), adminChecks(), checkLimits(), sel ? checkView(sel, admin) : null]);
  const num = (n: number) => formatNumber(n, locale);
  const when = (iso: string) => new Date(iso).toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dhaka" });
  const link = (over: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged = { tab: tab === "all" ? null : tab, q: q || null, sel, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/copyright${s ? `?${s}` : ""}`;
  };

  const counted = rows.filter((r) => r.status !== "failed");
  const done = rows.filter((r) => r.status === "done");
  const by = (v: Verdict) => done.filter((r) => r.verdict === v).length;
  const shown = rows
    .filter((r) => tab === "all" || r.verdict === tab)
    .filter((r) => !q || r.contest.brand.toLowerCase().includes(q) || r.requester.name.toLowerCase().includes(q) || `cc-${String(r.number).padStart(4, "0")}`.includes(q) || String(r.number) === q.replace(/^cc-?0*/, ""));

  // Checks left per contest, from the contests that have checks.
  const contests = [...new Map(counted.map((r) => [r.contest.id, r.contest])).values()].map((c) => {
    const mine = counted.filter((r) => r.contest.id === c.id);
    return { ...c, used: mine.length, paid: mine.some((r) => r.paid) };
  });

  const resultLine = (r: AdminCheckRow) =>
    r.status === "failed" ? t("admin.copyright.failed") : r.status !== "done" ? t("checker.box.running") : r.close ? t("admin.copyright.closeLine", { n: num(r.close), pct: num(r.closest) }) : t("admin.copyright.noneLine");

  return (
    <div className="space-y-4 sm:space-y-5">
      <AdminHead title={t("admin.copyright.title")} lead={t("admin.copyright.lead")} />

      <KpiGrid>
        <KpiTile label={t("admin.copyright.kpiRun")} value={num(counted.length)} hint={t("admin.copyright.inContests", { n: num(contests.length) })} accent />
        <KpiTile label={t("checker.verdicts.no_match")} value={num(by("no_match"))} hint={t("admin.copyright.kpiCert")} />
        <KpiTile label={t("checker.verdicts.similar")} value={num(by("similar"))} hint={t("admin.copyright.kpiWarned")} />
        <KpiTile label={t("checker.verdicts.high_risk")} value={num(by("high_risk"))} hint={t("admin.copyright.kpiLook")} />
      </KpiGrid>

      <AdmCard className="p-4 sm:p-5">
        <CardTitle
          title={t("admin.copyright.rules")}
          action={
            <Link href="/admin/settings" className="inline-flex min-h-11 items-center gap-1 text-[15px] font-bold text-primary hover:underline">
              {t("admin.copyright.changeInSettings")}
            </Link>
          }
        />
        <dl className="m-0 mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            [t("admin.copyright.ruleLimit"), t("admin.copyright.ruleLimitValue", { n: num(limits.perContest) }), t("admin.copyright.ruleLimitLine")],
            [t("admin.copyright.ruleFree"), t("admin.copyright.ruleFreeValue", { amount: formatTaka(limits.freeFrom, locale) }), t("admin.copyright.ruleFreeLine")],
            [t("admin.copyright.rulePrice", { amount: formatTaka(limits.freeFrom, locale) }), formatTaka(limits.price, locale), t("admin.copyright.rulePriceLine", { n: num(limits.perContest) })],
            [t("admin.copyright.ruleClose"), t("admin.copyright.ruleCloseValue", { close: num(limits.closeFrom), high: num(limits.highRiskFrom) }), t("admin.copyright.ruleCloseLine")],
          ].map(([k, v, line]) => (
            <div key={k} className="rounded-[12px] bg-adm-bg p-4">
              <dt className="text-[14px] font-semibold text-adm-soft">{k}</dt>
              <dd className="m-0 mt-1 text-[20px] font-semibold text-ink">{v}</dd>
              <dd className="m-0 mt-0.5 text-[13.5px] text-muted">{line}</dd>
            </div>
          ))}
        </dl>
      </AdmCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
        <div className="min-w-0 space-y-4">
          <AdmCard className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
            <Tabs
              label={t("admin.copyright.title")}
              items={TABS.map((x) => ({ href: link({ tab: x === "all" ? null : x, sel: null }), label: x === "all" ? t("admin.copyright.all") : t(`checker.verdicts.${x}`), active: tab === x, count: x === "all" ? rows.length : by(x) }))}
            />
            <form action="/admin/copyright" className="ml-auto flex w-full min-w-0 items-center gap-2 sm:w-auto">
              {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
              <input name="q" defaultValue={q} placeholder={t("admin.copyright.search")} aria-label={t("admin.copyright.search")} className={cx(ADM_INPUT, "sm:w-72")} />
            </form>
          </AdmCard>

          {shown.length === 0 ? (
            <AdmCard className="p-4">
              <AdmEmpty>{rows.length === 0 ? t("admin.copyright.empty") : t("admin.copyright.noneFound")}</AdmEmpty>
            </AdmCard>
          ) : (
            <TableCard>
              <table className="w-full min-w-[760px] text-left text-[15px]">
                <thead className="border-b border-adm-line text-[12.5px] uppercase tracking-[0.08em] text-adm-soft">
                  <tr>
                    <th className="px-4 py-3 font-bold">{t("admin.copyright.colCheck")}</th>
                    <th className="px-4 py-3 font-bold">{t("admin.copyright.colContest")}</th>
                    <th className="px-4 py-3 font-bold">{t("admin.copyright.colBy")}</th>
                    <th className="px-4 py-3 font-bold">{t("admin.copyright.colResult")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-adm-line-soft">
                  {shown.map((r) => (
                    <tr key={r.id} className={cx("hover:bg-adm-row", sel === r.id && "bg-adm-row shadow-[inset_3px_0_0_var(--color-primary)]")}>
                      <td className="px-4 py-3">
                        <Link href={link({ sel: r.id })} className="flex items-center gap-3">
                          <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-white ring-1 ring-adm-line">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {r.logoUrl ? <img src={r.logoUrl} alt="" className="size-full object-contain p-1" /> : null}
                          </span>
                          <span className="flex flex-col gap-0.5">
                            <IdChip prefix="CC" n={r.number} />
                            <span className="text-[13px] text-muted">{when(r.createdAt)}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/contests/${r.contest.slug}`} className="font-bold text-ink hover:text-primary">
                          {r.contest.brand}
                        </Link>
                        <span className="block text-[13.5px] text-muted">
                          {r.contest.number ? `LC-${String(r.contest.number).padStart(4, "0")} · ` : ""}
                          {r.entryNumber ? t("checker.choose.design", { n: num(r.entryNumber) }) : t("checker.choose.uploaded")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/users/${r.requester.id}`} className="font-bold text-ink hover:text-primary">
                          {r.requester.name}
                        </Link>
                        <span className="block text-[13.5px] text-muted">{r.paid ? t("admin.copyright.paid") : t("admin.copyright.free")}</span>
                      </td>
                      <td className="px-4 py-3">
                        {r.status === "done" && r.verdict ? <Pill tone={TONE[r.verdict]}>{t(`checker.verdicts.${r.verdict}`)}</Pill> : <Pill tone="neutral">{t(r.status === "failed" ? "admin.copyright.failedPill" : "admin.copyright.runningPill")}</Pill>}
                        <span className="mt-1 block text-[13.5px] text-muted">
                          {resultLine(r)}
                          {r.nth ? ` · ${t("admin.copyright.nth", { n: num(r.nth), limit: num(limits.perContest) })}` : ""}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableCard>
          )}

          {contests.length > 0 && (
            <AdmCard className="p-4 sm:p-5">
              <CardTitle title={t("admin.copyright.perContest")} />
              <ul className="m-0 mt-3 list-none divide-y divide-adm-line-soft p-0">
                {contests.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                    <Link href={`/admin/contests/${c.slug}`} className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 font-bold text-ink hover:text-primary">
                        {c.brand}
                        <IdChip prefix="LC" n={c.number} />
                      </span>
                      <span className="block text-[13.5px] text-muted">
                        {c.paid ? t("admin.copyright.paid") : t("admin.copyright.free")} · {t("admin.copyright.leftLine", { n: num(Math.max(0, limits.perContest - c.used)) })}
                      </span>
                    </Link>
                    <span className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                      <span className="flex gap-1" aria-hidden>
                        {Array.from({ length: limits.perContest }, (_, i) => (
                          <span key={i} className={cx("h-1.5 w-5 rounded-full", i < c.used ? "bg-primary" : "bg-adm-line")} />
                        ))}
                      </span>
                      {t("admin.copyright.usedOf", { used: num(c.used), limit: num(limits.perContest) })}
                    </span>
                  </li>
                ))}
              </ul>
            </AdmCard>
          )}
        </div>

        {/* Details of the chosen check */}
        <AdmCard className="p-4 sm:p-5 xl:sticky xl:top-24">
          {!detail ? (
            <AdmEmpty>{t("admin.copyright.pick")}</AdmEmpty>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-white ring-1 ring-adm-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {detail.logoUrl && <img src={detail.logoUrl} alt="" className="size-full object-contain p-1.5" />}
                </span>
                <div className="min-w-0">
                  <IdChip prefix="CC" n={detail.number} />
                  <p className="m-0 mt-1 font-bold text-ink">
                    {detail.contest.brand} · {detail.entry ? t("checker.choose.design", { n: num(detail.entry.number) }) : t("checker.choose.uploaded")}
                  </p>
                  {detail.entry?.designer && <p className="m-0 text-[13.5px] text-muted">{t("admin.copyright.designer", { name: detail.entry.designer.name })}</p>}
                </div>
              </div>
              {detail.status === "done" && detail.verdict ? <Pill tone={TONE[detail.verdict]}>{t(`checker.verdicts.${detail.verdict}`)}</Pill> : <Pill tone="neutral">{t(detail.status === "failed" ? "admin.copyright.failedPill" : "admin.copyright.runningPill")}</Pill>}
              <dl className="m-0 divide-y divide-adm-line-soft text-[14.5px]">
                {(
                  [
                    [t("admin.copyright.colBy"), detail.requestedBy.name],
                    [t("admin.copyright.when"), when(detail.createdAt)],
                    [t("admin.copyright.cost"), detail.paid ? `${t("admin.copyright.paid")} · ${formatTaka(detail.amount, locale)}` : t("admin.copyright.free")],
                    [t("admin.copyright.aiCost"), `$${detail.costUsd.toFixed(3)}`],
                    ...(detail.matches[0] ? [[t("admin.copyright.closest"), `${num(detail.matches[0].similarity)}%`]] : []),
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 py-2">
                    <dt className="text-muted">{k}</dt>
                    <dd className="m-0 text-right font-semibold text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
              {detail.error && <p className="m-0 rounded-[10px] bg-adm-bad-bg px-3 py-2 text-[13.5px] text-adm-bad">{t(`checker.failed.${["not_logo", "search_unavailable", "ai_unavailable"].includes(detail.error) ? detail.error : "technical"}` as MessageKey)}</p>}
              {detail.matches.length > 0 && (
                <div>
                  <p className="m-0 text-[13px] font-bold uppercase tracking-[0.08em] text-adm-soft">{t("admin.copyright.found")}</p>
                  <ul className="m-0 mt-2 grid list-none grid-cols-2 gap-2 p-0">
                    {detail.matches.map((m) => (
                      <li key={m.position} className="min-w-0">
                        <span className={cx("relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[10px] bg-white", m.isClose ? "ring-2 ring-[#d08a1e]" : "ring-1 ring-adm-line")}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {m.imageUrl && <img src={m.imageUrl} alt="" className="size-full object-contain p-1" />}
                          <span className="absolute bottom-1 left-1 rounded-full bg-[#f0f1f4] px-1.5 text-[11.5px] font-bold text-ink">{m.similarity}%</span>
                        </span>
                        {m.pageUrl ? (
                          <a href={m.pageUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 block truncate text-[12.5px] font-semibold text-primary hover:underline">
                            {m.foundBy === "site" ? "logocontest.bd" : (m.site ?? m.pageUrl)}
                          </a>
                        ) : (
                          <span className="mt-1 block truncate text-[12.5px] text-muted">{m.site ?? "—"}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {detail.status === "done" && (
                <div className="grid grid-cols-2 gap-2">
                  <a href={`/api/logo-checks/${detail.id}/certificate?format=pdf`} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[12px] bg-primary text-[15px] font-bold text-white hover:bg-adm-deep">
                    PDF
                  </a>
                  <a href={`/api/logo-checks/${detail.id}/certificate?format=png`} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[12px] border border-adm-line text-[15px] font-bold text-adm-strong hover:border-primary hover:text-primary">
                    {t("admin.copyright.image")}
                  </a>
                </div>
              )}
              <p className="m-0 text-[13px] text-muted">{t("checker.note")}</p>
              <Link href={`/admin/contests/${detail.contest.slug}`} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[12px] border border-adm-line text-[15px] font-bold text-adm-strong hover:border-primary hover:text-primary">
                <AdminIcon name="contests" size={16} />
                {t("admin.copyright.openContest")}
              </Link>
            </div>
          )}
        </AdmCard>
      </div>
    </div>
  );
}
