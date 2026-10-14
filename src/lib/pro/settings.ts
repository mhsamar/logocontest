import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_PRO_SETTINGS, PRO_FEATURES, type ProFeature, type ProSettings } from "./rules";

const date = (v: unknown) => (typeof v === "string" && v ? new Date(v) : null);
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

export function rowToSettings(r: Record<string, unknown>): ProSettings {
  const d = DEFAULT_PRO_SETTINGS;
  return {
    isForSale: r.is_for_sale === true,
    priceBdt: num(r.price_bdt, d.priceBdt),
    offerEnabled: r.offer_enabled === true,
    offerPriceBdt: typeof r.offer_price_bdt === "number" ? r.offer_price_bdt : null,
    offerAudience: r.offer_audience === "all" ? "all" : "new",
    offerStartsAt: date(r.offer_starts_at),
    offerEndsAt: date(r.offer_ends_at),
    trialDays: num(r.trial_days, 0),
    promoCode: typeof r.promo_code === "string" && r.promo_code ? r.promo_code : null,
    promoPriceBdt: typeof r.promo_price_bdt === "number" ? r.promo_price_bdt : null,
    proLogoChecks: num(r.pro_logo_checks, d.proLogoChecks),
    basicLogoChecks: num(r.basic_logo_checks, d.basicLogoChecks),
    checkLowMax: num(r.check_low_max, d.checkLowMax),
    checkMediumMax: num(r.check_medium_max, d.checkMediumMax),
    freeTrialEnabled: r.free_trial_enabled === true,
    freeTrialDays: num(r.free_trial_days, d.freeTrialDays),
    trialLogoChecks: num(r.trial_logo_checks, d.trialLogoChecks),
    trialPortfolioLimit: num(r.trial_portfolio_limit, d.trialPortfolioLimit),
    proPortfolioLimit: num(r.pro_portfolio_limit, d.proPortfolioLimit),
    proEntriesPerContest: typeof r.pro_entries_per_contest === "number" ? r.pro_entries_per_contest : null,
    basicEntriesPerContest: num(r.basic_entries_per_contest, d.basicEntriesPerContest),
    invitesPerContest: num(r.invites_per_contest, d.invitesPerContest),
    earlyAccessMinutes: num(r.early_access_minutes, d.earlyAccessMinutes),
    features: Object.fromEntries(PRO_FEATURES.map((f) => [f, r[`f_${f}`] === undefined ? d.features[f] : r[`f_${f}`] === true])) as Record<ProFeature, boolean>,
    autoRemind: r.auto_remind !== false,
  };
}

/**
 * The Pro plan settings (Admin › Pro plan). `ready` is false until migration 0046 has run: then there is no Pro plan
 * at all and Basic designers keep working exactly as before (no new limits).
 */
export const getProSettings = cache(async (): Promise<{ settings: ProSettings; ready: boolean }> => {
  if (!isSupabaseConfigured()) return { settings: DEFAULT_PRO_SETTINGS, ready: false };
  const { data, error } = await createAdminClient().from("pro_settings").select("*").eq("id", 1).maybeSingle();
  if (error || !data) return { settings: DEFAULT_PRO_SETTINGS, ready: false };
  return { settings: rowToSettings(data as Record<string, unknown>), ready: true };
});

/** Pro features on (the plan exists and this feature's switch is on). */
export async function proFeatureOn(f: ProFeature): Promise<boolean> {
  const { settings, ready } = await getProSettings();
  return ready && settings.features[f];
}
