import type { Metadata, Viewport } from "next";
import { Hind_Siliguri } from "next/font/google";
import { AdminBar } from "@/components/layout/admin-bar";
import { SuspendedBar } from "@/components/layout/suspended-bar";
import { MotionFx } from "@/components/layout/motion-fx";
import { PointerFx } from "@/components/layout/pointer-fx";
import { SiteFooter } from "@/components/layout/site-footer";
import { EmailBannerSlot } from "@/components/layout/email-banner-slot";
import { SiteChrome } from "@/components/layout/site-chrome";
import { SiteNav } from "@/components/layout/site-nav";
import { VisitTracker } from "@/components/layout/visit-tracker";
import { VisitorPopupSlot } from "@/components/visitor-popup/visitor-popup-slot";
import { SupportSlot } from "@/components/support/support-slot";
import { FloatingProCardSlot } from "@/components/pro/floating-card-slot";
import { AdsScript } from "@/components/ads/ads-script";
import { AdminPresence } from "@/components/admin/admin-presence";
import { ImpersonationBar } from "@/components/admin/impersonation-bar";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { ToastProvider } from "@/components/ui/toast";
import { I18nProvider } from "@/lib/i18n/client";
import { NoticeBar } from "@/components/layout/notice-bar";
import { currentNotice } from "@/lib/content/notice";
import { getMessages } from "@/lib/content/texts";
import { can } from "@/lib/auth/policies";
import { suspendedError } from "@/lib/moderation/suspension";
import { getCurrentUser } from "@/lib/auth/session";
import { showsLanding } from "@/lib/home/landing";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { openGraphFor, searchIndexingOn, siteUrl } from "@/lib/seo";
import { banglaDigits, landingBody, landingHeading } from "./fonts";
import "./globals.css";

// Bengali characters only (BLUEPRINT §15.1); Latin text uses Urbanist and Instrument Sans (./fonts.ts).
const bangla = Hind_Siliguri({
  variable: "--font-bangla",
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getI18n();
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t("meta.title"), template: `%s · ${t("brand.name")}` },
    description: t("meta.description"),
    applicationName: t("brand.name"),
    // Share previews (BLUEPRINT §15.1); the card image comes from app/opengraph-image.tsx.
    openGraph: openGraphFor({ title: t("meta.title"), description: t("meta.description"), path: "/", locale }),
    twitter: { card: "summary_large_image" },
    robots: searchIndexingOn() ? undefined : { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#8b0000",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { t, locale, currency } = await getI18n();
  const [messages, notice, user, ads] = await Promise.all([getMessages(locale), currentNotice(locale), getCurrentUser(), getSettings(["ads.enabled", "ads.adsense_client", "security.admin_idle_minutes"])]);
  // Ads (owner, 2026-10-14): only once switched on with a publisher ID in Admin › Settings › Ads.
  const adsClient = ads["ads.enabled"] && ads["ads.adsense_client"] ? ads["ads.adsense_client"] : null;
  // Guests and admins get the designed home page, whose hero holds the nav (owner, 2026-10-10).
  const guestHome = showsLanding(user?.role);
  // Suspended for 48 hours (owner, 2026-10-12): a bar on every page says until when and what is on hold.
  const held = suspendedError(user);
  return (
    <html lang={locale} data-scroll-behavior="smooth" className={`${landingBody.variable} ${landingHeading.variable} ${banglaDigits.variable} ${bangla.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={locale} messages={messages} currency={currency}>
          <ToastProvider>
            <ImpersonationBar />
            {/* The floating nav on every page (owner, 2026-10-10); the guest home puts it inside its hero.
                It stays in one place, so the bars come after it (owner, 2026-10-10: the menu bar never moves). */}
            <SiteChrome hideOnHome={guestHome}>
              <div className="lc-nav-slot">
                <SiteNav user={user} />
              </div>
            </SiteChrome>
            <SiteChrome>
              <div data-top-bars>
                {/* Admins browsing the site: who they are and the way back (owner, 2026-10-10). */}
                {can(user, "admin.access") && <AdminBar role={user!.isSuperAdmin ? t("admin.shell.superAdmin") : user!.adminTitle || t("admin.shell.staff")} />}
                {notice && <NoticeBar notice={notice} />}
                {held && <SuspendedBar text={t(held.key, held.params)} rulesLabel={t("suspension.rules")} />}
                <EmailBannerSlot />
              </div>
            </SiteChrome>
            <main className="flex flex-1 flex-col">{children}</main>
            <SiteChrome>
              <div className="lc-footer-slot">
                <SiteFooter />
              </div>
            </SiteChrome>
            <SiteChrome>
              <VisitTracker />
              <SupportSlot />
              <VisitorPopupSlot signedIn={Boolean(user)} />
              <FloatingProCardSlot />
            </SiteChrome>
            {adsClient && <AdsScript client={adsClient} />}
            {/* Staff: idle and closed-tab sign-out (owner, 2026-10-14). */}
            {user?.role === "admin" && <AdminPresence idleMinutes={ads["security.admin_idle_minutes"]} />}
            <PointerFx />
            <MotionFx />
            <ScrollReveal />
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
