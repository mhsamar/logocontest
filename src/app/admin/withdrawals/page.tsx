import type { Metadata } from "next";
import { WithdrawalActions } from "@/components/admin/withdrawal-row";
import { authorize } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { formatTaka } from "@/lib/money";
import { pendingWithdrawals } from "@/lib/wallet/queries";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.withdrawals.title"), robots: { index: false } };
}

// Admin withdrawal queue (BLUEPRINT §7.3): bank requests, and bKash when the automatic payout is off or failed.
export default async function AdminWithdrawalsPage() {
  await authorize("admin.access");
  const [{ t, locale }, list] = await Promise.all([getI18n(), pendingWithdrawals()]);
  return (
    <div>
      <h1 className="text-h2 font-bold tracking-tight text-ink lg:text-h2-lg">{t("admin.withdrawals.title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("admin.withdrawals.lead")}</p>
      {list.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center text-muted">{t("admin.withdrawals.empty")}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {list.map((w) => (
            <li key={w.id} className="flex flex-col gap-4 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-2xl font-extrabold tabular-nums text-ink">{formatTaka(w.amount, locale)}</p>
                <p className="text-sm text-ink">
                  {w.designer.name}
                  {w.designer.username && <span className="text-muted"> @{w.designer.username}</span>}
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("admin.withdrawals.to")}</p>
                <p className="font-mono text-sm text-ink">
                  {w.methodType === "bkash"
                    ? `bKash ${w.full.bkash_number ?? ""}`
                    : [w.full.bank_name, w.full.branch, w.full.account_name, w.full.account_number, w.full.routing_number].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1 text-xs text-muted">{t("admin.withdrawals.requested", { date: formatDate(w.createdAt, locale, "short") })}</p>
              </div>
              <WithdrawalActions id={w.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
