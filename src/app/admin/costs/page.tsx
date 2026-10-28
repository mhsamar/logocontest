import type { Metadata } from "next";
import { CostsView } from "@/components/admin/costs-view";
import { requirePermission } from "@/lib/admin/core";
import { costsPage } from "@/lib/admin/costs";
import { hasPermission } from "@/lib/admin/permissions";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.costs.title"), robots: { index: false } };
}

// A-29 Costs (owner, 2026-10-27): the page is drawn by CostsView.
export default async function AdminCostsPage({ searchParams }: PageProps<"/admin/costs">) {
  const me = await requirePermission("costs.view");
  const sp = await searchParams;
  const r = await costsPage(typeof sp.month === "string" ? sp.month : null);
  return <CostsView r={r} links={{ report: hasPermission(me, "copyright.view"), settings: hasPermission(me, "settings.view") }} />;
}
