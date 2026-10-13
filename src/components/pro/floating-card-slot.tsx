import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { formatTaka } from "@/lib/money";
import { priceQuote } from "@/lib/pro/rules";
import { getProSettings } from "@/lib/pro/settings";
import { getSubscription } from "@/lib/pro/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { isProActive } from "@/lib/pro/rules";
import { FloatingProCard } from "./floating-card";

/** The Go Pro card for Basic designers only, while Pro is for sale and the card is switched on (Admin › Pro plan). */
export async function FloatingProCardSlot() {
  const user = await getCurrentUser();
  if (!user || user.role !== "designer" || user.status !== "active") return null;
  const { settings, ready } = await getProSettings();
  if (!ready || !settings.isForSale || !settings.features.floating_card) return null;
  const sub = await getSubscription(user.id);
  if (isProActive(sub)) return null;
  const [{ locale }, { data: pref }] = await Promise.all([getI18n(), createAdminClient().from("pro_preferences").select("card_minimised").eq("designer_id", user.id).maybeSingle()]);
  const quote = priceQuote(settings, { firstTime: !sub });
  return <FloatingProCard price={formatTaka(quote.reason === "trial" ? settings.priceBdt : quote.amount, locale)} checks={settings.proLogoChecks} minimised={pref?.card_minimised === true} />;
}
