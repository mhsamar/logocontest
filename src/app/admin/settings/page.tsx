import type { Metadata } from "next";
import { AdminHead } from "@/components/admin/page-head";
import { SettingsGroup, type SettingItem } from "@/components/admin/settings-form";
import { isSupabaseConfigured } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { SETTINGS, type SettingKey } from "@/lib/settings/registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin/core";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.settings.title"), robots: { index: false } };
}

const GROUPS = ["fees", "packages", "upgrades", "timers", "limits", "monthly", "site", "auth"];

// A-11 Settings (BLUEPRINT §13.8): every admin-changeable number, grouped; each save asks for a reason.
export default async function AdminSettingsPage() {
  await requirePermission("settings.view");
  const { t } = await getI18n();
  const { data } = isSupabaseConfigured() ? await createAdminClient().from("settings").select("key, value, updated_at") : { data: [] };
  const stored = new Map((data ?? []).map((r) => [r.key as string, r]));
  const items = (Object.keys(SETTINGS) as SettingKey[]).map((key): SettingItem & { group: string } => {
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
      {GROUPS.filter((g) => items.some((i) => i.group === g)).map((g) => (
        <SettingsGroup key={g} group={g} title={t(`admin.settings.groups.${g}` as MessageKey)} items={items.filter((i) => i.group === g)} />
      ))}
    </div>
  );
}
