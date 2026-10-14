import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { formatTaka } from "@/lib/money";
import { priceQuote } from "@/lib/pro/rules";
import { getProSettings } from "@/lib/pro/settings";
import { getSubscription, getTrial, isPro } from "@/lib/pro/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { trialEligibilityFor } from "@/lib/pro/trial";
import { FloatingProCard } from "./floating-card";

/**
 * The Go Pro card for Basic designers only, while Pro is for sale or the free Pro Trial is on (owner, 2026-10-14), and
 * the card is switched on (Admin › Pro plan). Designers who can still start the trial see "Start free trial" first.
 */
export async function FloatingProCardSlot() {
  const user = await getCurrentUser();
  if (!user || user.role !== "designer" || user.status !== "active") return null;
  const { settings, ready } = await getProSettings();
  if (!ready || !settings.features.floating_card || (!settings.isForSale && !settings.freeTrialEnabled)) return null;
  if (await isPro(user.id)) return null;
  const [sub, eligible] = await Promise.all([getSubscription(user.id), trialEligibilityFor(user.id, user.role)]);
  if (!settings.isForSale && eligible !== "ok") return null;
  const [{ locale }, { data: pref }] = await Promise.all([getI18n(), createAdminClient().from("pro_preferences").select("card_minimised").eq("designer_id", user.id).maybeSingle()]);
  const quote = priceQuote(settings, { firstTime: !sub && !(await getTrial(user.id)) });
  return <FloatingProCard price={formatTaka(quote.reason === "trial" ? settings.priceBdt : quote.amount, locale)} checks={settings.proLogoChecks} minimised={pref?.card_minimised === true} trialDays={eligible === "ok" ? settings.freeTrialDays : null} forSale={settings.isForSale} />;
}
