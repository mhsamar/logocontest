import type { Metadata } from "next";
import { HeroEditor } from "@/components/admin/hero-editor";
import { AdminHead } from "@/components/admin/page-head";
import { requirePermission } from "@/lib/admin/core";
import { colorsFrom } from "@/lib/home/hero-slides";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.hero.newTitle"), robots: { index: false } };
}

// A-09b: a new home hero slide.
export default async function NewHeroSlidePage() {
  await requirePermission("content.manage");
  const { t } = await getI18n();
  const empty = { line1: "", line2: "", text: "" };
  return (
    <div className="flex flex-col gap-4">
      <AdminHead title={t("admin.hero.newTitle")} crumbs={[{ href: "/admin/hero", label: t("admin.hero.title") }]} />
      <HeroEditor
        initial={{
          id: null,
          brand: "",
          personName: "",
          role: "client",
          item: "cup",
          colors: colorsFrom("#8B0000"),
          photo: null,
          photoFocus: 25,
          logo: null,
          logoWhite: null,
          badgeLogo: "color",
          en: empty,
          bn: empty,
          isActive: true,
        }}
      />
    </div>
  );
}
