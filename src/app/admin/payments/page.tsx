import type { Metadata } from "next";
import Link from "next/link";
import { DayBarChart } from "@/components/admin/charts";
import { AdminIcon } from "@/components/admin/icons";
import { AdminHead } from "@/components/admin/page-head";
import { pageNum, Pager, qs, str } from "@/components/admin/table-bits";
import { AdmCard, AdmEmpty, ADM_INPUT, CardTitle, IdChip, KpiGrid, KpiTile, Pill } from "@/components/admin/ui";
import { requirePermission } from "@/lib/admin/core";
import { paymentsOverview, splitOf, type PaymentRow } from "@/lib/admin/payments-overview";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber, formatTaka } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.payments.title"), robots: { index: false } };
}

const TABS = ["all", "paid", "failed", "contests", "addons"] as const;
type Tab = (typeof TABS)[number];
const PAGE = 30;
const CHART_DAYS = 14;
const dhakaDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(d);

// A-06 Payments (BLUEPRINT §13.6; design/admin/payments.html, owner 2026-10-10): totals, paid per day, where the money
// goes, every payment, and its details. Checking a payment with the gateway comes with SSLCommerz (milestone 9).
export default async function AdminPaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  await requirePermission("payments.view");
  const sp = await searchParams;
  // ?status= and ?purpose= from older links still work.
  const tab: Tab = TABS.find((x) => x === sp.tab) ?? (sp.status === "paid" ? "paid" : sp.status === "failed" ? "failed" : sp.purpose === "contest" ? "contests" : sp.purpose === "addon" || sp.purpose === "extension" ? "addons" : "all");
  const q = str(sp.q).trim().toLowerCase();
  const qNum = q.replace(/^lc-?/, "").replace(/^0+(?=\d)/, "");
  const page = pageNum(sp.page);
  const [{ t, locale }, all] = await Promise.all([getI18n(), paymentsOverview()]);
  const num = (n: number) => formatNumber(n, locale);
  const taka = (n: number) => formatTaka(n, locale);
  const short = (n: number) => (n >= 1000 ? `৳${num(Math.round(n / 100) / 10)}k` : taka(n));
  const tag = locale === "bn" ? "bn-BD" : "en-GB";
  const time = (d: Date) => d.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dhaka" });
  const dayMonth = (d: Date) => d.toLocaleDateString(tag, { day: "numeric", month: "short", timeZone: "Asia/Dhaka" });
  const full = (d: Date) => d.toLocaleString(tag, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });
  const now = new Date();

  const paid = all.filter((p) => p.status === "paid");
  const failed = all.filter((p) => p.status === "failed");
  const paidSum = paid.reduce((a, p) => a + p.amount, 0);
  const split = paid.reduce((a, p) => {
    const s = splitOf(p);
    return { prize: a.prize + s.prize, fees: a.fees + s.fees, addons: a.addons + s.addons };
  }, { prize: 0, fees: 0, addons: 0 });
  const prizeContests = new Set(paid.filter((p) => p.purpose === "contest" && p.contest).map((p) => p.contest!.id)).size;
  const testOnes = all.filter((p) => p.gateway === "fake").length;

  // A failed payment that was paid again later (same contest and purpose).
  const retried = (p: PaymentRow) => {
    const again = paid.filter((x) => x.contest?.id === p.contest?.id && x.purpose === p.purpose && x.createdAt > p.createdAt).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    return again ? Math.max(1, Math.round((again.createdAt.getTime() - p.createdAt.getTime()) / 60_000)) : null;
  };
  const failedAgain = failed.map(retried).filter((x): x is number => x !== null);

  // Paid per day, the last two weeks.
  const days = Array.from({ length: CHART_DAYS }, (_, i) => new Date(now.getTime() - (CHART_DAYS - 1 - i) * 86_400_000));
  const perDay = new Map<string, number>();
  for (const p of paid) if (p.paidAt) perDay.set(dhakaDay(p.paidAt), (perDay.get(dhakaDay(p.paidAt)) ?? 0) + p.amount);

  const counts: Record<Tab, number> = {
    all: all.length,
    paid: paid.length,
    failed: failed.length,
    contests: all.filter((p) => p.purpose === "contest").length,
    addons: all.filter((p) => p.purpose !== "contest").length,
  };
  const inTab = (p: PaymentRow) => (tab === "paid" ? p.status === "paid" : tab === "failed" ? p.status === "failed" : tab === "contests" ? p.purpose === "contest" : tab === "addons" ? p.purpose !== "contest" : true);
  const matches = (p: PaymentRow) =>
    !q || (p.txnId ?? "").toLowerCase().includes(q) || (p.contest?.brand ?? "").toLowerCase().includes(q) || (p.client?.name ?? "").toLowerCase().includes(q) || (/^\d+$/.test(qNum) && p.contest?.number === Number(qNum));
  const list = all.filter(inTab).filter(matches);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const rows = list.slice((page - 1) * PAGE, page * PAGE);
  const selected = all.find((p) => p.id === str(sp.sel)) ?? null;
  const detail = selected ?? rows[0] ?? null;
  const link = (over: Record<string, string | number | undefined>) => `/admin/payments${qs({ tab: tab === "all" ? undefined : tab, q: str(sp.q) || undefined, page: page > 1 ? page : undefined, ...over })}`;

  const method = (p: PaymentRow) => `${t(`admin.payments.methods.${p.method}` as MessageKey)}${p.gateway === "fake" ? ` · ${t("admin.payments.test")}` : ""}`;
  const covers = (p: PaymentRow) => {
    const s = splitOf(p);
    return p.purpose === "contest"
      ? { main: t("admin.payments.coversPrize", { prize: taka(s.prize) }), sub: t("admin.payments.coversRest", { rest: taka(s.platform) }) }
      : { main: t(`admin.payments.coversLater.${p.purpose}` as MessageKey), sub: t("admin.payments.noPrize") };
  };
  const statusPill = (p: PaymentRow) => <Pill tone={p.status === "paid" ? "good" : p.status === "failed" ? "bad" : "warn"}>{t(`admin.payments.statuses.${p.status}`)}</Pill>;

  const details = detail && (
    <AdmCard as="aside" className="flex min-w-0 flex-[1_1_300px] flex-col gap-[18px] p-5 xl:sticky xl:top-[92px] xl:max-w-[380px]">
      <div className="flex items-center justify-between gap-2.5">
        <h2 className="m-0 text-[19px] font-semibold tracking-[-0.02em]">{t("admin.payments.details")}</h2>
        {statusPill(detail)}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm text-muted">{t("admin.payments.amount")}</span>
        <strong className="lc-d text-[30px] font-semibold tracking-[-0.03em] text-primary">{taka(detail.amount)}</strong>
        <span className="text-sm text-muted">{full(detail.paidAt ?? detail.createdAt)}</span>
      </div>
      {detail.contest && (
        <Link href={`/admin/contests/${detail.contest.slug}`} className="flex items-center gap-3 rounded-[12px] border border-adm-line p-3 hover:border-primary">
          <span className="lc-d flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-tint font-semibold text-primary">{detail.contest.brand.trim().slice(0, 1).toUpperCase()}</span>
          <span className="flex min-w-0 flex-col gap-[3px]">
            <strong className="truncate">{detail.contest.brand}</strong>
            <span className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
              {detail.client && t("admin.contests.clientIs", { name: detail.client.name })}
              <IdChip prefix="LC" n={detail.contest.number} />
            </span>
          </span>
        </Link>
      )}
      <dl className="m-0 flex flex-col gap-2 text-[15px]">
        {(
          [
            [t("admin.payments.prize"), taka(splitOf(detail).prize)],
            [t("admin.payments.feesAddons"), taka(splitOf(detail).platform)],
            [t("admin.payments.method"), `${method(detail)}${detail.gateway === "fake" ? "" : ` · ${detail.gateway}`}`],
            [t("admin.payments.txn"), detail.txnId ?? t("admin.payments.noId")],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-muted">{k}</dt>
            <dd className={cx("m-0 min-w-0 truncate text-right font-bold", k === t("admin.payments.txn") && "font-mono text-[13.5px]")}>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-muted">{t("admin.activity.whatHappened")}</span>
        <ol className="m-0 flex list-none flex-col gap-2 p-0 text-[15px]">
          {[
            detail.client?.createdAt && { at: detail.client.createdAt, text: t("admin.payments.tl.joined", { name: detail.client.name }) },
            detail.contest && { at: detail.contest.createdAt, text: t("admin.payments.tl.started", { brand: detail.contest.brand }) },
            { at: detail.createdAt, text: t("admin.payments.tl.opened", { amount: taka(detail.amount) }) },
            detail.paidAt && { at: detail.paidAt, text: detail.purpose === "contest" ? t("admin.payments.tl.paidLive", { amount: taka(detail.amount) }) : t("admin.payments.tl.paid", { amount: taka(detail.amount) }) },
            detail.status === "failed" && { at: detail.createdAt, text: t("admin.payments.tl.failed") },
          ]
            .filter((x): x is { at: Date; text: string } => Boolean(x))
            .sort((a, b) => a.at.getTime() - b.at.getTime())
            .map((x, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>{x.text}</span>
                <span className="shrink-0 text-muted">{time(x.at)}</span>
              </li>
            ))}
        </ol>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        {detail.contest && (
          <Link href={`/admin/contests/${detail.contest.slug}`} className="inline-flex h-[46px] flex-[1_1_140px] items-center justify-center rounded-[12px] bg-primary px-4 text-[15px] font-bold text-white hover:bg-adm-deep">
            {t("admin.activity.open")}
          </Link>
        )}
        <button type="button" disabled title={t("admin.payments.reconcileNote")} className="inline-flex h-[46px] flex-[1_1_140px] cursor-not-allowed items-center justify-center rounded-[12px] border border-adm-line px-4 text-[15px] font-bold text-muted opacity-70">
          {t("admin.payments.checkGateway")}
        </button>
      </div>
    </AdmCard>
  );

  return (
    <div className="flex flex-col gap-5">
      <AdminHead title={t("admin.payments.title")} lead={t("admin.payments.leadNew", { n: num(paid.length), total: taka(paidSum) })} />

      {testOnes > 0 && (
        <div className="flex gap-3 rounded-[16px] border border-[#f1e3a8] bg-[#fffbea] px-[18px] py-3.5 text-[15px] text-gold-ink">
          <AdminIcon name="reports" className="mt-0.5 shrink-0" />
          <span>
            <strong>{t("admin.payments.testTitle")}</strong> {t("admin.payments.testBody", { n: num(testOnes), all: num(all.length) })}
          </span>
        </div>
      )}

      <KpiGrid>
        <KpiTile label={t("admin.payments.kpi.paid")} value={taka(paidSum)} hint={t("admin.payments.kpi.paidHint", { n: num(paid.length) })} icon="payments" accent />
        <KpiTile label={t("admin.payments.kpi.held")} value={taka(split.prize)} hint={t("admin.payments.kpi.heldHint", { n: num(prizeContests) })} icon="contests" />
        <KpiTile label={t("admin.payments.kpi.platform")} value={taka(split.fees + split.addons)} hint={t("admin.payments.kpi.platformHint", { fees: taka(split.fees), addons: taka(split.addons) })} icon="revenue" />
        <KpiTile
          label={t("admin.payments.kpi.failed")}
          value={num(failed.length)}
          hint={failed.length ? `${taka(failed.reduce((a, p) => a + p.amount, 0))}${failedAgain.length ? ` · ${t("admin.payments.kpi.paidAgain", { n: num(failedAgain.length) })}` : ""}` : undefined}
          icon="reports"
        />
      </KpiGrid>

      <div className="flex flex-wrap items-stretch gap-4">
        <AdmCard className="flex min-w-0 flex-[3_1_520px] flex-col gap-[18px] p-5 sm:p-6">
          <CardTitle title={t("admin.payments.perDay")} sub={t("admin.payments.perDayLead", { n: num(CHART_DAYS) })} />
          <DayBarChart
            label={t("admin.payments.perDay")}
            num={short}
            color="bg-adm-pay"
            days={days.map((d) => ({ key: dhakaDay(d), label: dhakaDay(d) === dhakaDay(now) ? t("admin.analytics.today") : dayMonth(d), n: perDay.get(dhakaDay(d)) ?? 0, strong: dhakaDay(d) === dhakaDay(now) }))}
          />
        </AdmCard>
        <AdmCard className="flex min-w-0 flex-[2_1_340px] flex-col gap-4 p-5 sm:p-6">
          <CardTitle title={t("admin.payments.goes", { total: taka(paidSum) })} sub={t("admin.payments.goesLead")} />
          {paidSum > 0 && (
            <div aria-hidden className="flex h-3.5 gap-[3px] overflow-hidden rounded-full">
              {[
                { n: split.prize, c: "bg-adm-chart-prize" },
                { n: split.fees, c: "bg-adm-chart-fee" },
                { n: split.addons, c: "bg-adm-chart-addon" },
              ]
                .filter((x) => x.n > 0)
                .map((x, i) => (
                  <span key={i} className={x.c} style={{ flex: x.n }} />
                ))}
            </div>
          )}
          <dl className="m-0 flex flex-col text-[15.5px]">
            {[
              { k: t("admin.payments.prizes"), n: split.prize, c: "bg-adm-chart-prize" },
              { k: t("admin.dashboard.parts.serviceFees"), n: split.fees, c: "bg-adm-chart-fee" },
              { k: t("admin.dashboard.parts.addons"), n: split.addons, c: "bg-adm-chart-addon" },
            ].map((x, i) => (
              <div key={x.k} className={cx("flex items-center gap-2.5 py-2.5", i < 2 && "border-b border-adm-line-soft")}>
                <span className={cx("size-2.5 shrink-0 rounded-[3px]", x.c)} />
                <dt className="flex-1 font-semibold">{x.k}</dt>
                <span className="text-sm text-muted">{paidSum ? `${num(Math.round((x.n / paidSum) * 100))}%` : "—"}</span>
                <dd className="m-0 w-24 text-right font-bold tabular-nums">{taka(x.n)}</dd>
              </div>
            ))}
          </dl>
          <p className="m-0 text-sm text-muted">{t("admin.payments.designerFeesNote")}</p>
        </AdmCard>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <AdmCard className="min-w-0 flex-[3_1_620px] overflow-hidden">
          <div className="flex flex-col gap-3 p-3 sm:p-4">
            <nav aria-label={t("admin.payments.title")} className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]">
              <ul className="m-0 flex w-max list-none gap-1.5 p-0">
                {TABS.map((x) => (
                  <li key={x}>
                    <Link
                      href={`/admin/payments${qs({ tab: x === "all" ? undefined : x, q: str(sp.q) || undefined })}`}
                      aria-current={x === tab ? "page" : undefined}
                      className={cx("flex h-10 items-center gap-2 whitespace-nowrap rounded-[10px] px-3 text-[15px] font-semibold", x === tab ? "bg-tint text-primary" : "text-adm-strong hover:bg-adm-bg")}
                    >
                      {t(`admin.payments.tabs.${x}`)}
                      <span className={cx("min-w-6 rounded-[7px] px-1.5 text-center text-[12.5px] font-bold tabular-nums", x === tab ? "bg-surface" : "bg-[#f0f1f4]")}>{num(counts[x])}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="flex flex-wrap gap-2">
              <form action="/admin/payments" className="flex min-w-0 flex-[1_1_260px] gap-2">
                {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">{t("admin.payments.searchLabel")}</span>
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-adm-soft">
                    <AdminIcon name="search" />
                  </span>
                  <input type="search" name="q" defaultValue={str(sp.q)} placeholder={t("admin.payments.searchHint")} className={cx(ADM_INPUT, "h-11 pl-10")} />
                </label>
                <button type="submit" className="h-11 shrink-0 rounded-[12px] bg-primary px-5 text-[15px] font-bold text-white hover:bg-adm-deep">
                  {t("admin.filter")}
                </button>
              </form>
              <a href="/admin/payments/export" className="inline-flex h-11 items-center gap-2 rounded-[12px] border border-adm-line bg-surface px-4 text-[15px] font-bold text-adm-strong hover:border-primary hover:text-primary">
                <AdminIcon name="withdrawals" size={16} />
                {t("admin.payments.download")}
              </a>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="px-5 pb-5">
              <AdmEmpty>{t("admin.payments.empty")}</AdmEmpty>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-[15px]">
                <thead>
                  <tr className="text-left text-[13px] uppercase tracking-[0.06em] text-muted">
                    <th scope="col" className="px-5 py-3 font-bold">
                      {t("admin.payments.date")}
                    </th>
                    <th scope="col" className="px-3 py-3 font-bold">
                      {t("admin.payments.contestClient")}
                    </th>
                    <th scope="col" className="px-3 py-3 font-bold">
                      {t("admin.payments.methodTxn")}
                    </th>
                    <th scope="col" className="px-3 py-3 font-bold">
                      {t("admin.payments.covers")}
                    </th>
                    <th scope="col" className="py-3 pl-3 pr-5 text-right font-bold">
                      {t("admin.payments.amount")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const c = covers(p);
                    const again = p.status === "failed" ? retried(p) : null;
                    const on = detail?.id === p.id;
                    return (
                      <tr key={p.id} className={cx("border-t border-adm-line-soft", on ? "bg-adm-row" : "hover:bg-[#fafafb]")}>
                        <td className="px-5 py-3.5 align-top">
                          <Link href={link({ sel: p.id })} scroll={false} className="flex flex-col">
                            <strong>{dayMonth(p.paidAt ?? p.createdAt)}</strong>
                            <span className="text-sm text-muted">{time(p.paidAt ?? p.createdAt)}</span>
                          </Link>
                        </td>
                        <td className="px-3 py-3.5 align-top">
                          <Link href={link({ sel: p.id })} scroll={false} className="flex items-center gap-2.5">
                            <span className="lc-d flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-tint text-sm font-semibold text-primary">{(p.contest?.brand ?? "?").trim().slice(0, 1).toUpperCase()}</span>
                            <span className="flex min-w-0 flex-col gap-0.5">
                              <strong className="truncate">{p.contest?.brand ?? "—"}</strong>
                              <span className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
                                {p.client?.name ?? "—"} · <IdChip prefix="LC" n={p.contest?.number ?? null} />
                              </span>
                            </span>
                          </Link>
                        </td>
                        <td className="px-3 py-3.5 align-top">
                          <span className="flex flex-col">
                            <span className="font-semibold">{method(p)}</span>
                            <span className="font-mono text-[13px] text-muted">{p.txnId ?? t("admin.payments.noId")}</span>
                          </span>
                        </td>
                        <td className="px-3 py-3.5 align-top">
                          {p.status === "failed" ? (
                            <span className="flex flex-col">
                              <span className="font-semibold text-adm-bad">{t("admin.payments.didNotGo")}</span>
                              {again !== null && <span className="text-sm text-muted">{t("admin.payments.paidAgain", { n: num(again) })}</span>}
                            </span>
                          ) : (
                            <span className="flex flex-col">
                              <span className="font-semibold">{c.main}</span>
                              <span className="text-sm text-muted">{c.sub}</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 pl-3 pr-5 text-right align-top">
                          <span className="flex flex-col items-end gap-1">
                            <strong className="lc-d text-[17px] font-semibold tabular-nums">{taka(p.amount)}</strong>
                            {statusPill(p)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-adm-line">
                    <td colSpan={4} className="px-5 py-3.5 font-bold">
                      {t("admin.payments.totalPaid", { n: num(list.filter((p) => p.status === "paid").length) })}
                    </td>
                    <td className="py-3.5 pl-3 pr-5 text-right">
                      <strong className="lc-d text-lg font-semibold tabular-nums text-primary">{taka(list.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0))}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <div className="px-4 pb-3">
            <Pager page={page} pages={pages} href={(p) => link({ page: p })} prev={t("admin.prev")} next={t("admin.next")} label={t("admin.pages")} />
          </div>
        </AdmCard>

        {details}
      </div>
    </div>
  );
}
