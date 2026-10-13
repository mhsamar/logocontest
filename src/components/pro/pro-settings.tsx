import Link from "next/link";
import type { CurrentUser } from "@/lib/auth/policies";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber, formatTaka } from "@/lib/money";
import { PRO_FILES_BUCKET } from "@/lib/pro/chat";
import { designerCheckUsage } from "@/lib/pro/logo-checks";
import { getProSettings } from "@/lib/pro/settings";
import { getSubscription } from "@/lib/pro/status";
import { proPrefs } from "@/lib/pro/workspace";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { Icon, ProBadge, Slot } from "./parts";
import { CancelPlan, PicksGrid, PortfolioManager, TitleForm } from "./pro-extras";
import { PrefToggle } from "./pref-toggles";

/**
 * Settings › Pro extras and Subscription (owner, 2026-10-13; Design/pro/pro-settings.html): cover and featured picks
 * from the designer's own designs, portfolio uploads, logo checks used, the Pro switches, and the plan with cancel.
 */
export async function ProSettingsExtras({ user }: { user: CurrentUser }) {
  const { t, locale } = await getI18n();
  const db = createAdminClient();
  const [{ settings }, prefs, usage, sub, { data: entries }, { data: items }] = await Promise.all([
    getProSettings(),
    proPrefs(user.id),
    designerCheckUsage(user.id),
    getSubscription(user.id),
    db
      .from("entries")
      .select("id, created_at, contest:contests!contest_id(brand_name, is_private, is_nda), images:entry_images!entry_id(preview_path, position)")
      .eq("designer_id", user.id)
      .not("status", "in", "(removed,withdrawn)")
      .order("created_at", { ascending: false })
      .limit(48),
    db.from("portfolio_items").select("id, title, preview_path").eq("designer_id", user.id).order("position").limit(200),
  ]);
  // Only designs from public contests can go on the public profile.
  const designs = (entries ?? []).flatMap((e) => {
    const c = (Array.isArray(e.contest) ? e.contest[0] : e.contest) as { brand_name: string; is_private: boolean; is_nda: boolean } | null;
    if (!c || c.is_private || c.is_nda) return [];
    const img = [...((e.images as { preview_path: string; position: number }[] | null) ?? [])].sort((a, b) => a.position - b.position)[0];
    return [{ id: e.id as string, path: img?.preview_path ?? null, brand: c.brand_name }];
  });
  const store = getFileStorage();
  const [entryUrls, itemUrls] = await Promise.all([
    store.createReadUrls("entry-files", designs.map((d) => d.path).filter((p): p is string => Boolean(p)), 3600).catch(() => new Map<string, string>()),
    store.createReadUrls(PRO_FILES_BUCKET, (items ?? []).map((i) => i.preview_path as string), 3600).catch(() => new Map<string, string>()),
  ]);
  const pick = designs.map((d) => ({ id: d.id, brand: d.brand, thumb: d.path ? (entryUrls.get(d.path) ?? null) : null }));
  const portfolio = (items ?? []).map((i) => ({ id: i.id as string, title: (i.title as string) ?? "", url: itemUrls.get(i.preview_path as string) ?? null }));
  const n = (v: number) => formatNumber(v, locale);
  const until = sub ? formatDate(sub.currentPeriodEnd, locale, "long") : "";

  return (
    <>
      <section id="extras" className="pr-card" style={{ scrollMarginTop: 120 }} aria-labelledby="ps-extras">
        <div className="pr-ch">
          <h2 id="ps-extras">{t("pro.settings.extras")}</h2>
          <ProBadge />
        </div>
        <div className="pr-xs">
          <TitleForm initial={prefs.title ?? ""} />
        </div>
        <div className="pr-xs">
          <b>{t("pro.settings.cover")}</b>
          <em>{t("pro.settings.coverLead")}</em>
          <PicksGrid kind="cover" designs={pick} picked={prefs.coverEntryIds} max={12} />
        </div>
        <div className="pr-xs">
          <b>{t("pro.settings.featured")}</b>
          <em>{t("pro.settings.featuredLead", { n: n(prefs.featuredEntryIds.length) })}</em>
          <PicksGrid kind="featured" designs={pick} picked={prefs.featuredEntryIds} max={6} />
        </div>
        <div className="pr-xs">
          <b>{t("pro.settings.slots")}</b>
          <em>{t("pro.settings.slotsLine", { used: n(portfolio.length), max: n(settings.proPortfolioLimit) })}</em>
          <Slot used={portfolio.length} max={settings.proPortfolioLimit} />
          <PortfolioManager items={portfolio} max={settings.proPortfolioLimit} />
        </div>
        <div className="pr-xs">
          <b>{t("pro.settings.checker")}</b>
          <em>{t("pro.settings.checkerLine", { used: n(usage.used), max: n(usage.limit), date: formatDate(usage.resetsOn, locale, "short") })}</em>
          <Slot used={usage.used} max={usage.limit} />
        </div>
        {settings.features.client_chat && <PrefToggle pref="client_messages" on={prefs.clientMessages} label={t("pro.settings.messagesToggle")} sub={t("pro.settings.messagesSub")} />}
        <PrefToggle pref="show_badge" on={prefs.showBadge} label={t("pro.settings.badgeToggle")} sub={t("pro.settings.badgeSub")} />
        {settings.features.insights && <PrefToggle pref="weekly_report" on={prefs.weeklyReport} label={t("pro.settings.weeklyToggle")} sub={t("pro.settings.weeklySub")} />}
        {settings.features.show_contact_on_profile && <PrefToggle pref="show_contact" on={prefs.showContact} label={t("pro.settings.contactToggle")} sub={t("pro.settings.contactSub")} />}
      </section>
      {sub && (
        <section id="subscription" className="pr-card" style={{ scrollMarginTop: 120 }} aria-labelledby="ps-sub">
          <div className="pr-ch">
            <h2 id="ps-sub">{t("pro.settings.subscription")}</h2>
          </div>
          <div className="pr-sub">
            <span className="pr-ic g">
              <Icon name="crown" />
            </span>
            <div>
              <b>{t("pro.settings.planLine", { price: formatTaka(settings.priceBdt, locale) })}</b>
              <em>{sub.status === "cancelled" ? t("pro.settings.cancelledLine", { date: until }) : sub.autoRenew ? t("pro.settings.renewsLine", { date: until }) : t("pro.settings.endsLine", { date: until })}</em>
            </div>
          </div>
          <div className="pr-sub-act">
            {sub.currentPeriodEnd.getTime() - new Date().getTime() <= 7 * 86_400_000 && settings.isForSale && (
              <Link href="/pro/checkout?renew=1" className="pr-btn sm">
                {t("pro.settings.renew")}
              </Link>
            )}
            <Link href="/dashboard/wallet#receipts" className="pr-out sm">
              {t("pro.settings.receipts")}
            </Link>
            {sub.status !== "cancelled" && <CancelPlan until={until} />}
          </div>
        </section>
      )}
    </>
  );
}
