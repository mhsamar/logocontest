import Link from "@/components/ui/link";
import { AdminHead } from "@/components/admin/page-head";
import { SettingsGroup, type SettingItem } from "@/components/admin/settings-form";
import { TiersEditor } from "@/components/admin/tiers-editor";
import { AdmCard, CardTitle } from "@/components/admin/ui";
import { PRICING_SECTIONS, type DesignerTier } from "@/lib/admin/pricing-keys";
import { getPricingConfig } from "@/lib/contests/pricing-config";
import { feePercentFor, prizeWithFee, serviceFee } from "@/lib/contests/pricing";
import { isSupabaseConfigured } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatTaka } from "@/lib/money";
import { getSetting } from "@/lib/settings";
import { SETTINGS, type SettingKey } from "@/lib/settings/registry";
import { createAdminClient } from "@/lib/supabase/admin";


/** Settings with a short explanation under their name (admin.pricing.hints.*). */
const HINTS = new Set(["feePercent", "largePercent", "largeFrom", "bestFrom", "allFreeFrom", "nda", "extPerDay", "extDays", "usdMarkup"]);

/** The plain name of each setting on this page (admin.pricing.fields.*). */
const FIELD: Partial<Record<SettingKey, string>> = {
  "fees.client_service_fee_percent": "feePercent",
  "fees.client_service_fee_large_percent": "largePercent",
  "fees.client_service_fee_large_from": "largeFrom",
  "packages.economy_prize": "economy",
  "packages.standard_prize": "standard",
  "packages.pro_prize": "pro",
  "packages.premium_prize": "premium",
  "packages.elite_prize": "elite",
  "packages.custom_min_prize": "customMin",
  "packages.custom_step": "customStep",
  "packages.best_results_from": "bestFrom",
  "upgrades.all_free_from": "allFreeFrom",
  "upgrades.promoted_price": "promoted",
  "upgrades.blind_price": "blind",
  "upgrades.private_price": "private",
  "upgrades.highlight_price": "highlight",
  "upgrades.urgent_price": "urgent",
  "upgrades.nda_price": "nda",
  "upgrades.extension_price_per_day": "extPerDay",
  "upgrades.extension_days_options": "extDays",
  "fees.counted_win_min_prize": "countedMinPrize",
  "fees.counted_win_min_designers": "countedMinDesigners",
  "fees.counted_wins_max_per_client": "countedMaxPerClient",
  "payments.usd_rate": "usdRate",
  "payments.usd_markup_percent": "usdMarkup",
};

/** The page's content (also used by a local preview without the admin login). */
export async function PricingSettings() {
  const [{ t, locale }, cfg, tiers] = await Promise.all([getI18n(), getPricingConfig(), getSetting("fees.designer_tiers")]);
  const { data } = isSupabaseConfigured() ? await createAdminClient().from("settings").select("key, value, updated_at") : { data: [] };
  const stored = new Map((data ?? []).map((r) => [r.key as string, r]));
  const taka = (n: number) => formatTaka(n, locale);

  const itemOf = (key: SettingKey): SettingItem => {
    const def = SETTINGS[key];
    const row = stored.get(key);
    const value = row ? row.value : def.default;
    const field = FIELD[key];
    return {
      key,
      type: def.type,
      value: def.type === "json" ? JSON.stringify(value) : String(value ?? ""),
      label: field ? t(`admin.pricing.fields.${field}` as MessageKey) : undefined,
      description: field ? (HINTS.has(field) ? t(`admin.pricing.hints.${field}` as MessageKey) : "") : def.description,
      updatedAt: (row?.updated_at as string | undefined) ?? null,
    };
  };

  // Three examples with the numbers saved now: the smallest prize, the first prize with free add-ons, a big prize.
  const free = cfg.addonsFreeFrom ?? 0;
  const examples = [...new Set([cfg.customMin, free, cfg.largeFeeFrom + cfg.customStep].filter((p) => p > 0))].sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-5">
      <AdminHead title={t("admin.pricing.title")} lead={t("admin.pricing.lead")} />

      <AdmCard className="flex flex-col gap-2 p-5" data-pricing-examples>
        <CardTitle title={t("admin.pricing.examplesTitle")} />
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[15px] text-ink">
          {examples.map((p) => (
            <li key={p}>{t("admin.pricing.example", { prize: taka(p), fee: taka(serviceFee(p, feePercentFor(p, cfg))), percent: feePercentFor(p, cfg), total: taka(prizeWithFee(p, cfg)) })}</li>
          ))}
          <li className="font-semibold">{free > 0 ? t("admin.pricing.addonsFreeLine", { amount: taka(free) }) : t("admin.pricing.addonsFreeOff")}</li>
        </ul>
      </AdmCard>

      {PRICING_SECTIONS.map((s) => (
        <div key={s.id} id={s.id} className="scroll-mt-24">
          <SettingsGroup
            id={s.id}
            group={s.group}
            title={t(`admin.pricing.sections.${s.id}.title`)}
            note={t(`admin.pricing.sections.${s.id}.note`)}
            // The designer fee rows have their own editor below.
            items={s.keys.filter((k) => k !== "fees.designer_tiers").map((k) => itemOf(k))}
          />
          {s.id === "designerFee" && (
            <AdmCard className="mt-3 p-5">
              <CardTitle title={t("admin.pricing.tiers.title")} />
              <TiersEditor tiers={tiers as DesignerTier[]} />
            </AdmCard>
          )}
        </div>
      ))}

      <div className="grid gap-4 md:grid-cols-2">
        <AdmCard className="flex flex-col gap-2 p-5">
          <CardTitle title={t("admin.pricing.pro.title")} />
          <p className="m-0 text-sm text-muted">{t("admin.pricing.pro.body")}</p>
          <Link href="/admin/pro" className="text-sm font-bold text-primary hover:underline">
            {t("admin.pricing.open")} →
          </Link>
        </AdmCard>
        <AdmCard className="flex flex-col gap-2 p-5">
          <CardTitle title={t("admin.pricing.promos.title")} />
          <p className="m-0 text-sm text-muted">{t("admin.pricing.promos.body")}</p>
          <Link href="/admin/payments/promos" className="text-sm font-bold text-primary hover:underline">
            {t("admin.pricing.open")} →
          </Link>
        </AdmCard>
      </div>
    </div>
  );
}
