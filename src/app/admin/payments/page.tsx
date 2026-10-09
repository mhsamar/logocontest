import type { Metadata } from "next";
import Link from "next/link";
import { AdminHead } from "@/components/admin/page-head";
import { FILTER_INPUT, FilterBar, pageNum, Pager, qs, StatusPill, str } from "@/components/admin/table-bits";
import { listPayments } from "@/lib/admin/misc";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatTaka } from "@/lib/money";
import { requirePermission } from "@/lib/admin/core";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.payments.title"), robots: { index: false } };
}

// A-06 Payments (BLUEPRINT §13.6). Checking a payment with the gateway comes with SSLCommerz (milestone 9).
export default async function AdminPaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  await requirePermission("payments.view");
  const sp = await searchParams;
  const q = { status: str(sp.status), purpose: str(sp.purpose), search: str(sp.q), page: pageNum(sp.page) };
  const [{ t, locale }, list] = await Promise.all([getI18n(), listPayments(q)]);
  const when = (d: Date) => d.toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });
  return (
    <div className="space-y-4">
      <AdminHead title={t("admin.payments.title")} lead={t("admin.payments.lead", { total: formatTaka(list.paidSum, locale) })} />
      <FilterBar action="/admin/payments">
        <input name="q" defaultValue={q.search} placeholder={t("admin.payments.search")} className={`${FILTER_INPUT} min-w-56 flex-1`} />
        <select name="status" defaultValue={q.status} className={FILTER_INPUT} aria-label={t("admin.payments.status")}>
          <option value="">{t("admin.payments.allStatuses")}</option>
          {(["paid", "initiated", "failed"] as const).map((s) => (
            <option key={s} value={s}>
              {t(`admin.payments.statuses.${s}`)}
            </option>
          ))}
        </select>
        <select name="purpose" defaultValue={q.purpose} className={FILTER_INPUT} aria-label={t("admin.payments.purpose")}>
          <option value="">{t("admin.payments.allPurposes")}</option>
          {(["contest", "extension", "addon"] as const).map((p) => (
            <option key={p} value={p}>
              {t(`admin.payments.purposes.${p}`)}
            </option>
          ))}
        </select>
        <button className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white">{t("admin.filter")}</button>
      </FilterBar>
      <p className="text-xs text-muted">{t("admin.payments.reconcileNote")}</p>
      {list.rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center text-muted">{t("admin.payments.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-surface shadow-card ring-1 ring-line">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">{t("admin.payments.date")}</th>
                <th className="px-4 py-3 font-semibold">{t("admin.payments.contest")}</th>
                <th className="px-4 py-3 font-semibold">{t("admin.payments.purpose")}</th>
                <th className="px-4 py-3 font-semibold">{t("admin.payments.gateway")}</th>
                <th className="px-4 py-3 text-right font-semibold">{t("admin.payments.amount")}</th>
                <th className="px-4 py-3 font-semibold">{t("admin.payments.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.rows.map((p) => (
                <tr key={p.id} className="hover:bg-canvas/60">
                  <td className="px-4 py-3 text-muted">{when(p.paidAt ?? p.createdAt)}</td>
                  <td className="px-4 py-3">
                    {p.contest ? (
                      <Link href={`/admin/contests/${p.contest.slug}`} className="font-semibold text-ink hover:text-primary">
                        {p.contest.brand}
                      </Link>
                    ) : (
                      "—"
                    )}
                    {p.client && (
                      <Link href={`/admin/users/${p.client.id}`} className="block text-xs text-muted hover:text-primary">
                        {p.client.name}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3">{t(`admin.payments.purposes.${p.purpose}` as MessageKey)}</td>
                  <td className="px-4 py-3 text-muted">
                    {p.gateway} · {p.method}
                    {p.txnId && <span className="block font-mono text-xs">{p.txnId}</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatTaka(p.amount, locale)}</td>
                  <td className="px-4 py-3">
                    <StatusPill tone={p.status === "paid" ? "ok" : p.status === "failed" ? "bad" : "muted"}>{t(`admin.payments.statuses.${p.status}` as MessageKey)}</StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={q.page} pages={list.pages} href={(p) => `/admin/payments${qs({ q: q.search, status: q.status, purpose: q.purpose, page: p })}`} prev={t("admin.prev")} next={t("admin.next")} label={t("admin.pages")} />
    </div>
  );
}
