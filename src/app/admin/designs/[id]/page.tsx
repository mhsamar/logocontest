import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DesignBody } from "@/components/admin/design-viewer";
import { AdminHead } from "@/components/admin/page-head";
import { AdmCard } from "@/components/admin/ui";
import { loadAdminDesign } from "@/lib/admin/design-view";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.nav.entries"), robots: { index: false } };
}

// One design inside the admin panel (owner, 2026-10-10): the page behind a design link opened in a new tab.
export default async function AdminDesignPage({ params }: PageProps<"/admin/designs/[id]">) {
  const { id } = await params;
  const [{ t }, design] = await Promise.all([getI18n(), loadAdminDesign(id)]);
  if (!design) notFound();
  return (
    <div className="space-y-4">
      <AdminHead title={t("admin.entries.designNo", { n: String(design.number) })} crumbs={[{ href: "/admin/entries", label: t("admin.nav.entries") }]} />
      <AdmCard className="flex overflow-hidden lg:h-[calc(100dvh-14rem)] lg:min-h-[560px]">
        <DesignBody design={design} />
      </AdmCard>
    </div>
  );
}
