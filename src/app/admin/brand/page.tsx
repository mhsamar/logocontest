import type { Metadata } from "next";
import { AdminHead } from "@/components/admin/page-head";
import { PictureField } from "@/components/admin/picture-field";
import { SettingsGroup, type SettingItem } from "@/components/admin/settings-form";
import { NoticeBar } from "@/components/layout/notice-bar";
import { noticeId, type NoticeTone } from "@/lib/content/notice-rules";
import { PICTURE_KINDS, pictureUrl, type PictureKind } from "@/lib/content/pictures";
import { isSupabaseConfigured } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { SETTINGS, type SettingKey } from "@/lib/settings/registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin/core";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.brand.title"), robots: { index: false } };
}

const TONES: NoticeTone[] = ["info", "warning", "offer"];

/** What each picture shows when none is uploaded. */
const BUILT_IN: Record<PictureKind, string | null> = { logo: "/brand/logo-wordmark.png", icon: "/brand/logo-icon-tile.png", hero: null, share: "/opengraph-image" };

// A-17 Brand & notice (BLUEPRINT §13.1): contact details and the site-wide notice bar.
export default async function AdminBrandPage() {
  await requirePermission("content.view");
  const { t, locale } = await getI18n();
  const { data } = isSupabaseConfigured() ? await createAdminClient().from("settings").select("key, value, updated_at").in("group", ["contact", "notice", "brand"]) : { data: [] };
  const stored = new Map((data ?? []).map((r) => [r.key as string, r]));

  const itemsOf = (group: string): SettingItem[] =>
    (Object.keys(SETTINGS) as SettingKey[])
      .filter((k) => SETTINGS[k].group === group)
      .map((key) => {
        const def = SETTINGS[key];
        const row = stored.get(key);
        return {
          key,
          type: def.type,
          value: String(row ? row.value : def.default),
          description: t(`admin.brand.fields.${key.replace(".", "_")}` as MessageKey),
          updatedAt: (row?.updated_at as string | undefined) ?? null,
          options: key === "notice.tone" ? TONES.map((v) => ({ value: v, label: t(`admin.brand.tones.${v}`) })) : undefined,
        };
      });

  const notice = itemsOf("notice");
  const val = (k: string) => notice.find((i) => i.key === k)?.value ?? "";
  const text = ((locale === "bn" && val("notice.text_bn")) || val("notice.text_en")).trim();
  const on = val("notice.on") === "true";

  return (
    <div className="space-y-4">
      <AdminHead title={t("admin.brand.title")} lead={t("admin.brand.lead")} />

      <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line">
        <h2 className="text-sm font-semibold text-muted">{t("admin.brand.preview")}</h2>
        {text ? (
          <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-line">
            <NoticeBar preview notice={{ id: noticeId(text), text, link: val("notice.link"), tone: (val("notice.tone") as NoticeTone) || "info" }} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">{t("admin.brand.previewEmpty")}</p>
        )}
        {text && !on && <p className="mt-2 text-sm text-muted">{t("admin.brand.previewOff")}</p>}
      </section>

      <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line">
        <h2 className="font-semibold text-ink">{t("admin.brand.pictures.title")}</h2>
        <div className="divide-y divide-line">
          {PICTURE_KINDS.map((kind) => {
            const path = stored.get(`brand.${kind}`)?.value;
            return <PictureField key={kind} kind={kind} url={pictureUrl(typeof path === "string" ? path : null)} fallback={BUILT_IN[kind]} />;
          })}
        </div>
      </section>

      <SettingsGroup group="notice" title={t("admin.brand.notice")} items={notice} reasonOptional />
      <SettingsGroup group="contact" title={t("admin.brand.contact")} items={itemsOf("contact")} reasonOptional />
    </div>
  );
}
