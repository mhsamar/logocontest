import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuideEditor } from "@/components/admin/guide-editor";
import { AdminHead } from "@/components/admin/page-head";
import { requirePermission } from "@/lib/admin/core";
import { guideById } from "@/lib/guides/queries";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.guides.editTitle"), robots: { index: false } };
}

// Admin › Guides: change one guide (view only for staff without content.manage).
export default async function EditGuidePage({ params }: PageProps<"/admin/guides/[id]">) {
  await requirePermission("content.view");
  const [{ id }, { t }] = await Promise.all([params, getI18n()]);
  const g = await guideById(id);
  if (!g) notFound();
  return (
    <div className="flex flex-col gap-4">
      <AdminHead title={g.title_en || t("admin.guides.editTitle")} lead={t("admin.guides.editTitle")} crumbs={[{ href: "/admin/guides", label: t("admin.guides.title") }]} />
      <GuideEditor
        key={g.updated_at}
        initial={{
          id: g.id,
          slug: g.slug,
          category: g.category,
          titleEn: g.title_en,
          titleBn: g.title_bn,
          summaryEn: g.summary_en,
          summaryBn: g.summary_bn,
          bodyEn: g.body_en,
          bodyBn: g.body_bn,
          coverPath: g.cover_path,
          status: g.status,
          inFooter: g.in_footer,
        }}
      />
    </div>
  );
}
