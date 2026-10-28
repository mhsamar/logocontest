/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { AddSlideLink, CopySamplesButton, HeroRowActions, HeroSettingsForm } from "@/components/admin/hero-list";
import { AdminHead } from "@/components/admin/page-head";
import { AdmCard, AdmEmpty, CardTitle, Pill } from "@/components/admin/ui";
import { requirePermission } from "@/lib/admin/core";
import { heroImageUrl } from "@/lib/home/hero";
import { allHeroSlides } from "@/lib/home/hero-admin";
import { BUILT_IN_SLIDES } from "@/lib/home/hero-slides";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.hero.title"), robots: { index: false } };
}

// A-09b Home hero (owner, 2026-10-11): the showcase slides at the top of the home page.
export default async function AdminHeroPage() {
  await requirePermission("content.view");
  const { t, locale } = await getI18n();
  const [slides, s] = await Promise.all([allHeroSlides(), getSettings(["home.hero_slide_seconds", "home.hero_sample_pill", "home.hero_offer_slide"])]);
  const fmt = (n: number) => formatNumber(n, locale);
  const on = (slides ?? []).filter((x) => x.is_active).length;

  return (
    <div className="flex flex-col gap-4">
      <AdminHead
        title={t("admin.hero.title")}
        lead={t("admin.hero.lead")}
        actions={
          <div className="flex flex-wrap gap-2">
            <a href="/" target="_blank" rel="noopener" className="inline-flex min-h-12 items-center rounded-[12px] border border-adm-line bg-surface px-4 text-[15.5px] font-bold text-ink hover:bg-adm-row">
              {t("admin.hero.openHome")}
            </a>
            {slides && <AddSlideLink />}
          </div>
        }
      />

      {slides === null ? (
        <AdmCard className="p-5">
          <p className="m-0 text-ink">{t("admin.hero.needsMigration")}</p>
        </AdmCard>
      ) : (
        <>
          {/* What the home page shows right now */}
          <p className={on ? "m-0 rounded-[12px] bg-adm-good-bg px-4 py-3 font-semibold text-adm-good" : "m-0 rounded-[12px] bg-adm-sample-bg px-4 py-3 font-semibold text-adm-sample"}>
            {on ? t("admin.hero.status.live", { n: fmt(on) }) : t("admin.hero.status.samples", { n: fmt(BUILT_IN_SLIDES.length) })}
          </p>

          <AdmCard className="p-5">
            <CardTitle title={t("admin.hero.list.title")} sub={t("admin.hero.list.sub")} />
            {slides.length === 0 ? (
              <div className="mt-4 flex flex-col items-start gap-3">
                <AdmEmpty>{t("admin.hero.list.empty")}</AdmEmpty>
                <CopySamplesButton />
              </div>
            ) : (
              <ol className="m-0 mt-4 flex list-none flex-col gap-2.5 p-0">
                {slides.map((x, i) => (
                  <li key={x.id} className="flex flex-col gap-3 rounded-[14px] border border-adm-line p-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="w-6 shrink-0 text-center text-[15px] font-bold text-adm-soft tabular-nums">{fmt(i + 1)}</span>
                      <Link href={`/admin/hero/${x.id}`} className="relative size-16 shrink-0 overflow-hidden rounded-[12px] bg-[#6E6C6A]">
                        <img src={heroImageUrl(x.photo_path)} alt="" className="h-full w-full object-cover" style={{ objectPosition: `50% ${x.photo_focus}%` }} />
                        <span className="absolute -bottom-0.5 -right-0.5 flex size-7 items-center justify-center rounded-full ring-2 ring-white" style={{ background: x.color_badge }}>
                          <img src={heroImageUrl(x.badge_logo === "white" ? x.logo_white_path : x.logo_path)} alt="" className="max-h-4 max-w-5 object-contain" />
                        </span>
                      </Link>
                      <div className="min-w-0">
                        <p className="m-0 flex flex-wrap items-center gap-2">
                          <strong className="truncate text-[16px]">{x.brand}</strong>
                          <Pill tone={x.is_active ? "good" : "neutral"}>{t(x.is_active ? "admin.hero.list.on" : "admin.hero.list.off")}</Pill>
                          {x.photo_path.startsWith("/") && <Pill tone="sample">{t("admin.hero.list.sample")}</Pill>}
                        </p>
                        <p className="m-0 truncate text-[14px] text-muted">
                          {t(x.role === "designer" ? "home.hero.chipDesigner" : "home.hero.chipClient", { name: x.person_name })} · {t(`admin.hero.look.items.${x.item}`)}
                        </p>
                        <p className="m-0 truncate text-[14px] text-ink">
                          {locale === "bn" && x.line1_bn ? `${x.line1_bn} ${x.line2_bn ?? ""}` : `${x.line1_en} ${x.line2_en}`}
                        </p>
                      </div>
                    </div>
                    <HeroRowActions id={x.id} brand={x.brand} active={x.is_active} first={i === 0} last={i === slides.length - 1} />
                  </li>
                ))}
              </ol>
            )}
          </AdmCard>

          <AdmCard className="p-5">
            <CardTitle title={t("admin.hero.settings.title")} />
            <HeroSettingsForm seconds={s["home.hero_slide_seconds"]} samplePill={s["home.hero_sample_pill"]} offerSlide={s["home.hero_offer_slide"]} />
          </AdmCard>

          <AdmCard className="p-5">
            <CardTitle title={t("admin.hero.help.title")} />
            <ol className="m-0 mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-[15px] text-ink">
              <li>{t("admin.hero.help.s1")}</li>
              <li>{t("admin.hero.help.s2")}</li>
              <li>{t("admin.hero.help.s3")}</li>
              <li>{t("admin.hero.help.s4")}</li>
              <li>{t("admin.hero.help.s5")}</li>
            </ol>
          </AdmCard>
        </>
      )}
    </div>
  );
}
