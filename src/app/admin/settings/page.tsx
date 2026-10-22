import type { Metadata } from "next";
import { AdminHead } from "@/components/admin/page-head";
import { SettingsGroup, type SettingItem } from "@/components/admin/settings-form";
import { isSupabaseConfigured } from "@/lib/env";
import { liveDesignerCounts } from "@/lib/home/live-designers";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { SETTINGS, type SettingKey } from "@/lib/settings/registry";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { requirePermission } from "@/lib/admin/core";
import { hasPermission } from "@/lib/admin/permissions";
import { PRICING_KEYS } from "@/lib/admin/pricing-keys";
import { formatNumber } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.settings.title"), robots: { index: false } };
}

const GROUPS = ["fees", "packages", "upgrades", "payments", "timers", "limits", "checker", "monthly", "live", "site", "ads", "trash", "security", "email", "support", "auth"];

// A-11 Settings (BLUEPRINT §13.8): every admin-changeable number, grouped; each save asks for a reason.
export default async function AdminSettingsPage() {
  const me = await requirePermission("settings.view");
  const { t, locale } = await getI18n();
  const live = await liveDesignerCounts();
  const { data } = isSupabaseConfigured() ? await createAdminClient().from("settings").select("key, value, updated_at") : { data: [] };
  const stored = new Map((data ?? []).map((r) => [r.key as string, r]));
  // Prices and fees live on Admin › Pricing & fees (owner, 2026-10-22).
  const items = (Object.keys(SETTINGS) as SettingKey[]).filter((key) => !PRICING_KEYS.has(key)).map((key): SettingItem & { group: string } => {
    const def = SETTINGS[key];
    const row = stored.get(key);
    const value = row ? row.value : def.default;
    return {
      key,
      group: def.group,
      type: def.type,
      value: def.type === "json" ? JSON.stringify(value) : String(value ?? ""),
      description: def.description,
      updatedAt: (row?.updated_at as string | undefined) ?? null,
    };
  });
  return (
    <div className="space-y-4">
      <AdminHead title={t("admin.settings.title")} lead={t("admin.settings.lead")} />
      {hasPermission(me, "pricing.view") && (
        <p className="m-0 rounded-2xl bg-surface px-5 py-4 text-sm text-ink shadow-card ring-1 ring-line">
          {t("admin.pricing.movedNote")}{" "}
          <Link href="/admin/pricing" className="font-bold text-primary hover:underline">
            {t("admin.pricing.open")} →
          </Link>
        </p>
      )}
      {GROUPS.filter((g) => items.some((i) => i.group === g)).map((g) => (
        <SettingsGroup
          key={g}
          group={g}
          title={t(`admin.settings.groups.${g}` as MessageKey)}
          // The live numbers next to their limits (cached a minute, like the home page).
          note={g === "live" && live ? t("admin.settings.liveNote", { joined: formatNumber(live.joined, locale), online: formatNumber(live.online, locale) }) : undefined}
          items={items.filter((i) => i.group === g)}
        />
      ))}
    </div>
  );
}
