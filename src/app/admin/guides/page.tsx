import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { AddGuideLink } from "@/components/admin/guide-list";
import { AdminHead } from "@/components/admin/page-head";
import { AdmCard, AdmEmpty, CardTitle, Pill } from "@/components/admin/ui";
import { requirePermission } from "@/lib/admin/core";
import { formatDate } from "@/lib/dates";
import { allGuides } from "@/lib/guides/queries";
import { MIN_WORDS, wordCount } from "@/lib/guides/rules";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.guides.title"), robots: { index: false } };
}

// Admin › Guides (owner, 2026-10-15): articles for clients and designers on /guides, in the footer and the sitemap.
export default async function AdminGuidesPage() {
  await requirePermission("content.view");
  const { t, locale } = await getI18n();
  const guides = await allGuides();
  const fmt = (n: number) => formatNumber(n, locale);
  const live = (guides ?? []).filter((g) => g.status === "published").length;

  return (
    <div className="flex flex-col gap-4">
      <AdminHead
        title={t("admin.guides.title")}
        lead={t("admin.guides.lead")}
        actions={
          <div className="flex flex-wrap gap-2">
            <a href="/guides" target="_blank" rel="noopener" className="inline-flex min-h-12 items-center rounded-[12px] border border-adm-line bg-surface px-4 text-[15.5px] font-bold text-ink hover:bg-adm-row">
              {t("admin.guides.openPage")}
            </a>
            {guides && <AddGuideLink />}
          </div>
        }
      />

      {guides === null ? (
        <AdmCard className="p-5">
          <p className="m-0 text-ink">{t("admin.guides.needsMigration")}</p>
        </AdmCard>
      ) : (
        <>
          <AdmCard className="p-5">
            <CardTitle title={t("admin.guides.list.title")} sub={t("admin.guides.list.sub", { live: fmt(live), all: fmt(guides.length) })} />
            {guides.length === 0 ? (
              <div className="mt-4">
                <AdmEmpty>{t("admin.guides.list.empty")}</AdmEmpty>
              </div>
            ) : (
              <ul className="m-0 mt-4 flex list-none flex-col gap-2.5 p-0">
                {guides.map((g) => {
                  const words = wordCount(g.body_en);
                  return (
                    <li key={g.id}>
                      <Link href={`/admin/guides/${g.id}`} className="flex flex-col gap-1 rounded-[14px] border border-adm-line p-3.5 hover:bg-adm-row">
                        <span className="flex flex-wrap items-center gap-2">
                          <strong className="text-[16px] text-ink">{g.title_en || "…"}</strong>
                          <Pill tone={g.status === "published" ? "good" : "neutral"}>{t(g.status === "published" ? "admin.guides.list.live" : "admin.guides.list.draft")}</Pill>
                          <Pill tone="brand">{t(`guides.categories.${g.category}`)}</Pill>
                          {g.in_footer && <Pill tone="sample">{t("admin.guides.list.footer")}</Pill>}
                          {!g.bn_ready && <Pill tone="warn">{t("admin.guides.list.noBangla")}</Pill>}
                        </span>
                        <span className="truncate text-[14px] text-muted">/guides/{g.slug}</span>
                        <span className="text-[13.5px] text-muted">
                          {t("admin.guides.list.meta", { words: fmt(words), date: formatDate(new Date(g.updated_at), locale, "long") })}
                          {words < MIN_WORDS && <span className="font-bold text-adm-warn"> · {t("admin.guides.list.short")}</span>}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </AdmCard>

          <AdmCard className="p-5">
            <CardTitle title={t("admin.guides.help.title")} sub={t("admin.guides.help.sub")} />
            <ol className="m-0 mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-[15px] text-ink">
              {(["s1", "s2", "s3", "s4", "s5", "s6", "s7"] as const).map((k) => (
                <li key={k}>{t(`admin.guides.help.${k}`)}</li>
              ))}
            </ol>
          </AdmCard>
        </>
      )}
    </div>
  );
}
