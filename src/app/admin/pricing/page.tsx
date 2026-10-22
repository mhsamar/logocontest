import type { Metadata } from "next";
import { PricingSettings } from "@/components/admin/pricing-settings";
import { requirePermission } from "@/lib/admin/core";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.pricing.title"), robots: { index: false } };
}

// A-28 Admin › Pricing & fees (owner, 2026-10-22; BLUEPRINT §13.3): every price and fee clients and designers pay. Each
// save asks for a reason and goes to the audit log; the site reads the new numbers on the next page load.
export default async function AdminPricingPage() {
  await requirePermission("pricing.view");
  return <PricingSettings />;
}
