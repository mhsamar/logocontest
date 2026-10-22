import type { Metadata } from "next";
import { ClaimCards } from "@/components/admin/guarantee-claim-card";
import { AdminHead } from "@/components/admin/page-head";
import { str } from "@/components/admin/table-bits";
import { AdmEmpty, Tabs } from "@/components/admin/ui";
import { requirePermission } from "@/lib/admin/core";
import { hasPermission } from "@/lib/admin/permissions";
import { adminClaims, CLAIM_TABS, claimCounts, type ClaimTab } from "@/lib/guarantee/queries";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("guarantee.admin.title"), robots: { index: false } };
}

// A-27 Admin › Money-back claims (owner, 2026-10-21; BLUEPRINT §7.10): clients whose contest ended with fewer
// designers than promised. Waiting → approve or reject; To pay → send the money and paste the reference.
export default async function RefundsPage({ searchParams }: PageProps<"/admin/refunds">) {
  const admin = await requirePermission("refunds.view");
  const canManage = hasPermission(admin, "refunds.manage");
  const sp = await searchParams;
  const tab: ClaimTab = CLAIM_TABS.find((x) => x === str(sp.tab)) ?? "pending";
  const [{ t }, rows, counts, s] = await Promise.all([getI18n(), adminClaims(tab), claimCounts(), getSettings(["timers.repick_window_days"])]);
  return (
    <div className="flex flex-col gap-5">
      <AdminHead title={t("guarantee.admin.title")} lead={t("guarantee.admin.lead")} />
      <Tabs label={t("guarantee.admin.title")} items={CLAIM_TABS.map((x) => ({ href: `/admin/refunds${x === "pending" ? "" : `?tab=${x}`}`, label: t(`guarantee.admin.tabs.${x}`), active: x === tab, count: counts[x] }))} />

      {rows.length === 0 && <AdmEmpty>{t("guarantee.admin.empty")}</AdmEmpty>}
      <ClaimCards rows={rows} viewer={admin} canManage={canManage} repickDays={s["timers.repick_window_days"]} />
    </div>
  );
}
