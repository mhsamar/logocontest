import type { Metadata } from "next";
import { GuideEditor } from "@/components/admin/guide-editor";
import { AdminHead } from "@/components/admin/page-head";
import { requirePermission } from "@/lib/admin/core";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.guides.newTitle"), robots: { index: false } };
}

// Admin › Guides: a new guide.
export default async function NewGuidePage() {
  await requirePermission("content.manage");
  const { t } = await getI18n();
  return (
    <div className="flex flex-col gap-4">
      <AdminHead title={t("admin.guides.newTitle")} crumbs={[{ href: "/admin/guides", label: t("admin.guides.title") }]} />
      <GuideEditor
        initial={{ id: null, slug: "", category: "clients", titleEn: "", titleBn: "", summaryEn: "", summaryBn: "", bodyEn: "", bodyBn: "", coverPath: null, status: "draft", inFooter: false }}
      />
    </div>
  );
}
