import type { Metadata } from "next";
import { WithdrawalsView } from "@/components/admin/withdrawals-view";
import { requirePermission } from "@/lib/admin/core";
import { moneyNow, payoutRows } from "@/lib/admin/payouts";
import { hasPermission } from "@/lib/admin/permissions";
import { getI18n } from "@/lib/i18n/server";
import { autoWithdrawalsOn } from "@/lib/payouts";
import { bkashPayoutsReady } from "@/lib/payouts/ready";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.withdrawals.title"), robots: { index: false } };
}

// Admin › Withdrawals (BLUEPRINT §7.3; owner 2026-10-16): the queue to pay, every payout sent, and the designers' money.
export default async function AdminWithdrawalsPage({ searchParams }: PageProps<"/admin/withdrawals">) {
  const me = await requirePermission("withdrawals.view");
  const [sp, rows, auto, now] = await Promise.all([searchParams, payoutRows(), autoWithdrawalsOn(), moneyNow()]);
  return <WithdrawalsView sp={sp} rows={rows} now={now} auto={auto} ready={bkashPayoutsReady()} canManage={hasPermission(me, "withdrawals.manage")} />;
}
