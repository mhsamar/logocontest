import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HeroEditor } from "@/components/admin/hero-editor";
import { AdminHead } from "@/components/admin/page-head";
import { requirePermission } from "@/lib/admin/core";
import { heroImageUrl } from "@/lib/home/hero";
import { heroSlideById } from "@/lib/home/hero-admin";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.hero.editTitle"), robots: { index: false } };
}

// A-09b: edit one home hero slide (view only for staff without content.manage).
export default async function EditHeroSlidePage({ params }: PageProps<"/admin/hero/[id]">) {
  await requirePermission("content.view");
  const [{ id }, { t }] = await Promise.all([params, getI18n()]);
  const r = await heroSlideById(id);
  if (!r) notFound();
  const pic = (path: string, width: number, height: number) => ({ path, url: heroImageUrl(path), width, height });
  return (
    <div className="flex flex-col gap-4">
      <AdminHead title={r.brand} lead={t("admin.hero.editTitle")} crumbs={[{ href: "/admin/hero", label: t("admin.hero.title") }]} />
      <HeroEditor
        initial={{
          id: r.id,
          brand: r.brand,
          personName: r.person_name,
          role: r.role,
          item: r.item,
          colors: { main: r.color_main, dark: r.color_dark, light: r.color_light, badge: r.color_badge },
          photo: pic(r.photo_path, r.photo_w, r.photo_h),
          photoFocus: r.photo_focus,
          logo: pic(r.logo_path, r.logo_w, r.logo_h),
          logoWhite: pic(r.logo_white_path, r.logo_white_w, r.logo_white_h),
          badgeLogo: r.badge_logo,
          en: { line1: r.line1_en, line2: r.line2_en, text: r.text_en },
          bn: { line1: r.line1_bn ?? "", line2: r.line2_bn ?? "", text: r.text_bn ?? "" },
          isActive: r.is_active,
        }}
      />
    </div>
  );
}
