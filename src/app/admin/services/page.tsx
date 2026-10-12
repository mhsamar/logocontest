import type { Metadata } from "next";
import { ServicesEditor } from "@/components/admin/services-editor";
import { AdminHead } from "@/components/admin/page-head";
import { requirePermission } from "@/lib/admin/core";
import { getI18n } from "@/lib/i18n/server";
import { allServices, servicesReady } from "@/lib/services/store";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.services.title"), robots: { index: false } };
}

// Admin → Services (owner, 2026-10-13): which kinds of contest clients can start, and how each one is set up.
export default async function AdminServicesPage() {
  await requirePermission("settings.view");
  const [{ t }, services, ready] = await Promise.all([getI18n(), allServices(), servicesReady()]);
  return (
    <div className="flex flex-col gap-4">
      <AdminHead title={t("admin.services.title")} lead={t("admin.services.lead")} />
      <ServicesEditor services={services} ready={ready} />
    </div>
  );
}
