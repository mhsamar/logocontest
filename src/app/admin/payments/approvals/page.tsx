import type { Metadata } from "next";
import Link from "next/link";
import { AdminHead } from "@/components/admin/page-head";
import { str } from "@/components/admin/table-bits";
import { AdmCard, AdmEmpty, CardTitle, IdChip, KpiGrid, KpiTile, Pill, Tabs } from "@/components/admin/ui";
import { CopyChip, ProofActions, QaMaker } from "@/components/payments/admin-pay";
import { requirePermission } from "@/lib/admin/core";
import { hasPermission } from "@/lib/admin/permissions";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber, formatTaka } from "@/lib/money";
import { proofCounts, proofList, qaCodes, type ProofRow, type ProofStatus } from "@/lib/payments/admin-queries";
import { showMobile } from "@/lib/payments/manual-rules";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pay.admin.approvals.title"), robots: { index: false } };
}

const TABS: ProofStatus[] = ["pending", "approved", "rejected"];

// Admin › Payments › Approvals (owner, 2026-10-14): every bKash transaction ID people sent, oldest waiting first.
// Approve when the money is in the bKash account: the contest goes live, the add-on turns on or Pro starts.
export default async function PaymentApprovalsPage({ searchParams }: PageProps<"/admin/payments/approvals">) {
  const admin = await requirePermission("payments.view");
  const canManage = hasPermission(admin, "payments.manage");
  const sp = await searchParams;
  const tab: ProofStatus = TABS.find((x) => x === str(sp.tab)) ?? "pending";
  const [{ t, locale }, rows, counts, qa] = await Promise.all([getI18n(), proofList(tab), proofCounts(), qaCodes()]);
  const num = (n: number) => formatNumber(n, locale);
  const taka = (n: number) => formatTaka(n, locale);
  const tag = locale === "bn" ? "bn-BD" : "en-GB";
  const full = (d: Date) => d.toLocaleString(tag, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });
  const tabCount: Record<ProofStatus, number> = { pending: counts.pending, approved: counts.approved, rejected: counts.rejected };

  const what = (r: ProofRow) =>
    r.kind === "pro"
      ? t("pay.page.forPro")
      : r.kind === "contest"
        ? t("pay.page.forContest", { brand: r.contest?.brand ?? "" })
        : r.item.days
          ? t("pay.page.forExtension", { days: num(r.item.days), brand: r.contest?.brand ?? "" })
          : `${t(`manage.addons.${r.item.addon ?? "promote"}.title` as MessageKey)} · ${r.contest?.brand ?? ""}`;

  return (
    <div className="flex flex-col gap-5">
      <AdminHead title={t("pay.admin.approvals.title")} lead={t("pay.admin.approvals.lead")} crumbs={[{ href: "/admin/payments", label: t("admin.payments.title") }]} />

      <KpiGrid>
        <KpiTile label={t("pay.admin.approvals.kpi.pending")} value={num(counts.pending)} icon="approvals" accent />
        <KpiTile label={t("pay.admin.approvals.kpi.pendingSum")} value={taka(counts.pendingSum)} icon="payments" />
        <KpiTile label={t("pay.admin.approvals.kpi.approvedToday")} value={num(counts.approvedToday)} icon="check" />
        <KpiTile label={t("pay.admin.approvals.kpi.rejected")} value={num(counts.rejected30)} icon="reports" />
      </KpiGrid>

      <Tabs
        label={t("pay.admin.approvals.title")}
        items={TABS.map((x) => ({ href: `/admin/payments/approvals${x === "pending" ? "" : `?tab=${x}`}`, label: t(`pay.admin.approvals.tabs.${x}`), active: x === tab, count: tabCount[x] }))}
      />

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[3_1_520px] flex-col gap-3">
          {rows.length === 0 && <AdmEmpty>{t("pay.admin.approvals.empty")}</AdmEmpty>}
          {rows.map((r) => (
            <AdmCard key={r.id} as="article" className="flex flex-col gap-4 p-5" data-proof={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <Pill tone={r.kind === "pro" ? "gold" : r.kind === "contest" ? "brand" : "neutral"}>{t(`pay.admin.approvals.kind.${r.kind}`)}</Pill>
                    {r.qa && <Pill tone="sample">{t("pay.admin.approvals.qa")}</Pill>}
                    {r.contest && <IdChip prefix="LC" n={r.contest.number} />}
                  </span>
                  <strong className="text-[17px] text-ink">{what(r)}</strong>
                  <span className="text-[14.5px] text-muted">
                    {t("pay.admin.approvals.payer")}: {r.payer ? `${r.payer.name}${r.payer.mobile ? ` · ${showMobile(r.payer.mobile)}` : ""}` : "—"}
                  </span>
                </div>
                <strong className="lc-d text-[28px] font-semibold tracking-[-0.03em] text-primary tabular-nums">{taka(r.amount)}</strong>
              </div>

              <dl className="m-0 grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-2">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <dt className="text-muted">{t("pay.admin.approvals.txn")}</dt>
                  <dd className="m-0 flex items-center gap-2">
                    <span className="font-mono text-[15px] font-bold tracking-wide text-ink">{r.txnId}</span>
                    <CopyChip value={r.txnId} />
                  </dd>
                </div>
                <div className="flex min-w-0 justify-between gap-3">
                  <dt className="text-muted">{t("pay.admin.approvals.to", { method: t(`pay.methods.${r.method}` as MessageKey) })}</dt>
                  <dd className="m-0 font-mono font-semibold tabular-nums">{showMobile(r.toNumber)}</dd>
                </div>
                <div className="flex min-w-0 justify-between gap-3">
                  <dt className="text-muted">{t("pay.admin.approvals.sent")}</dt>
                  <dd className="m-0 text-right">{full(r.createdAt)}</dd>
                </div>
                <div className="flex min-w-0 justify-between gap-3">
                  <dt className="text-muted">{r.sender ? t("pay.admin.approvals.sender") : t("pay.admin.approvals.noSender")}</dt>
                  <dd className="m-0 font-mono font-semibold tabular-nums">{r.sender ? showMobile(r.sender) : ""}</dd>
                </div>
              </dl>

              {r.qa && <p className="m-0 rounded-[12px] bg-[#eef4ff] px-3.5 py-2.5 text-[14px] text-[#1d4ed8]">{t("pay.admin.approvals.qaHint")}</p>}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 text-[14.5px]">
                  {r.shotUrl ? (
                    <a href={r.shotUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-bold text-primary hover:underline">
                      {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed link to a private file */}
                      <img src={r.shotUrl} alt={t("pay.admin.approvals.shot")} className="size-14 rounded-[10px] border border-adm-line object-cover" />
                      {t("pay.admin.approvals.shot")} ↗
                    </a>
                  ) : (
                    <span className="text-muted">{t("pay.admin.approvals.noShot")}</span>
                  )}
                  {r.contest && (
                    <Link href={`/admin/contests/${r.contest.slug}`} className="font-bold text-primary hover:underline">
                      {t("pay.admin.approvals.openContest")}
                    </Link>
                  )}
                </div>
                {r.status === "pending" && canManage ? (
                  <ProofActions id={r.id} amount={taka(r.amount)} txn={r.txnId} />
                ) : r.status !== "pending" ? (
                  <span className="flex flex-col items-end gap-0.5 text-right text-sm">
                    <Pill tone={r.status === "approved" ? "good" : "bad"}>{t(r.status === "approved" ? "pay.admin.approvals.approved" : "pay.admin.approvals.rejected")}</Pill>
                    <span className="text-muted">
                      {t("pay.admin.approvals.reviewed", { name: r.reviewer ?? "—", date: r.reviewedAt ? full(r.reviewedAt) : "" })}
                    </span>
                    {r.note && <span className="max-w-xs text-ink">{r.note}</span>}
                  </span>
                ) : null}
              </div>
            </AdmCard>
          ))}
        </div>

        <AdmCard as="aside" className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 p-5 xl:max-w-[380px]">
          <CardTitle title={t("pay.admin.qa.title")} sub={t("pay.admin.qa.lead")} />
          {canManage && <QaMaker />}
          {qa.length === 0 ? (
            <p className="m-0 text-sm text-muted">{t("pay.admin.qa.empty")}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col divide-y divide-adm-line p-0" data-qa-codes>
              {qa.map((c) => (
                <li key={c.code} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex min-w-0 flex-col">
                    <span className={c.usedAt ? "font-mono text-[15px] font-bold text-muted line-through" : "font-mono text-[15px] font-bold text-ink"}>{c.code}</span>
                    <span className="text-[13px] text-muted">{c.usedAt ? t("pay.admin.qa.usedAt", { date: full(c.usedAt) }) : t("pay.admin.qa.unused")}</span>
                  </span>
                  {!c.usedAt && <CopyChip value={c.code} />}
                </li>
              ))}
            </ul>
          )}
        </AdmCard>
      </div>
    </div>
  );
}
