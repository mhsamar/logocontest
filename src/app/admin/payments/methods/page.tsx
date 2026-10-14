import type { Metadata } from "next";
import { AdminHead } from "@/components/admin/page-head";
import { MethodCard } from "@/components/payments/admin-pay";
import { requirePermission } from "@/lib/admin/core";
import { hasPermission } from "@/lib/admin/permissions";
import { getI18n } from "@/lib/i18n/server";
import { isManual } from "@/lib/payments/manual-rules";
import { gatewayReady, isOpen, methodRows } from "@/lib/payments/methods";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pay.admin.methods.title"), robots: { index: false } };
}

// Admin › Payments › Methods (owner, 2026-10-14): one card per way to pay, each with its own switch. bKash Personal
// and Merchant are manual (approved in Payment approvals); the bKash API and SSLCommerz switch on once set up.
export default async function PaymentMethodsPage() {
  const admin = await requirePermission("payments.view");
  const canManage = hasPermission(admin, "payments.manage");
  const [{ t, locale }, rows] = await Promise.all([getI18n(), methodRows()]);
  const tag = locale === "bn" ? "bn-BD" : "en-GB";
  const full = (iso: string) => new Date(iso).toLocaleString(tag, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });
  const noneOpen = rows.length > 0 && !rows.some(isOpen);

  return (
    <div className="flex flex-col gap-5">
      <AdminHead title={t("pay.admin.methods.title")} lead={t("pay.admin.methods.lead")} crumbs={[{ href: "/admin/payments", label: t("admin.payments.title") }]} />
      {noneOpen && <p className="m-0 rounded-[16px] border border-[#f1e3a8] bg-[#fffbea] px-[18px] py-3.5 text-[15px] text-gold-ink">{t("pay.admin.methods.noneOpen")}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((r) => (
          <MethodCard
            key={r.key}
            canManage={canManage}
            m={{
              key: r.key,
              enabled: r.enabled,
              manual: isManual(r.key),
              ready: gatewayReady(r.key),
              number: r.number,
              name: r.name,
              noteEn: r.noteEn,
              noteBn: r.noteBn,
              updated: r.updatedAt ? full(r.updatedAt) : null,
            }}
          />
        ))}
      </div>
    </div>
  );
}
