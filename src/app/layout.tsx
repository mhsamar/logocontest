import type { Metadata, Viewport } from "next";
import { Hind_Siliguri } from "next/font/google";
import { AdminBar } from "@/components/layout/admin-bar";
import { BackupBar } from "@/components/layout/backup-bar";
import { LangCookieSync } from "@/components/layout/lang-cookie-sync";
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
import { headers } from "next/headers";
import { NO_PIXEL_HEADER } from "@/lib/analytics/meta-pixel";
import { viewingAs } from "@/lib/push";
import { showsLanding } from "@/lib/home/landing";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { openGraphFor, searchIndexingOn } from "@/lib/seo";
import { requestOrigin } from "@/lib/site-origin";
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
    // Share previews use the address being visited (so they work on the backup address too); every page's canonical
    // link names logocontest.bd itself (owner, 2026-10-21).
    metadataBase: new URL(await requestOrigin()),
    title: { default: t("meta.title"), template: `%s · ${t("brand.name")}` },
    description: t("meta.description"),
    applicationName: t("brand.name"),
    // Share previews (BLUEPRINT §15.1); the card image comes from app/opengraph-image.tsx.
    openGraph: openGraphFor({ title: t("meta.title"), description: t("meta.description"), locale }),
    twitter: { card: "summary_large_image" },
    robots: searchIndexingOn() ? undefined : { index: false, follow: false },
    // Pinterest "Claim your website" (owner, 2026-10-18) and Meta domain verification (owner, 2026-10-24): prove
    // logocontest.bd is ours. Public by design.
    other: { "p:domain_verify": "cb536e9e87dbc7662f94b8400e106a79", "facebook-domain-verification": "mo7wzhn8u6wu6r14jt0kr0bf0cugg7" },
  };
}

export const viewport: Viewport = {
  themeColor: "#8b0000",
};

// Meta Pixel base code (owner, 2026-10-24), exactly as Meta gave it. Only on the live site: local and preview builds
// would send test visits and fake-gateway payments to the real pixel.
const META_PIXEL = process.env.VERCEL_ENV === "production";
const META_PIXEL_SCRIPT = `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '1804708190768737');
fbq('track', 'PageView');`;
const META_PIXEL_NOSCRIPT = `<img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=1804708190768737&ev=PageView&noscript=1"
/>`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { t, locale, currency } = await getI18n();
  const [messages, notice, user, ads] = await Promise.all([getMessages(locale), currentNotice(locale), getCurrentUser(), getSettings(["ads.enabled", "ads.adsense_client", "security.admin_idle_minutes"])]);
  // Ads (owner, 2026-10-14): only once switched on with a publisher ID in Admin › Settings › Ads.
  const adsClient = ads["ads.enabled"] && ads["ads.adsense_client"] ? ads["ads.adsense_client"] : null;
  // Guests and admins get the designed home page, whose hero holds the nav (owner, 2026-10-10).
  const guestHome = showsLanding(user?.role);
  // Suspended for 48 hours (owner, 2026-10-12): a bar on every page says until when and what is on hold.
  const held = suspendedError(user);
  // The Meta Pixel never runs for the team, on Admin or unsubscribe pages, or while staff use "Log in as": those
  // addresses and visits carry customers' details (owner, 2026-10-24).
  const pixel = META_PIXEL && user?.role !== "admin" && (await headers()).get(NO_PIXEL_HEADER) !== "1" && !(user && (await viewingAs(user.id)));
  return (
    <html lang={locale} data-scroll-behavior="smooth" className={`${landingBody.variable} ${landingHeading.variable} ${banglaDigits.variable} ${bangla.variable} h-full antialiased`}>
      <head>
        {pixel && (
          <>
            {/* Meta Pixel Code */}
            <script dangerouslySetInnerHTML={{ __html: META_PIXEL_SCRIPT }} />
            <noscript dangerouslySetInnerHTML={{ __html: META_PIXEL_NOSCRIPT }} />
            {/* End Meta Pixel Code */}
          </>
        )}
      </head>
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={locale} messages={messages} currency={currency}>
          <ToastProvider>
            <ImpersonationBar />
            {/* The floating nav on every page (owner, 2026-10-10); the guest home puts it inside its hero.
                It stays in one place, so the bars come after it (owner, 2026-10-10: the menu bar never moves). */}
            <SiteChrome hideOnHome={guestHome} hideOnClient client={user?.role === "client"}>
              <div className="lc-nav-slot">
                <SiteNav user={user} />
              </div>
            </SiteChrome>
            <SiteChrome>
              <div data-top-bars>
                {/* Admins browsing the site: who they are and the way back (owner, 2026-10-10). */}
                {can(user, "admin.access") && <AdminBar role={user!.isSuperAdmin ? t("admin.shell.superAdmin") : user!.adminTitle || t("admin.shell.staff")} />}
                <BackupBar admin={can(user, "admin.access")} />
                {notice && <NoticeBar notice={notice} />}
                {held && <SuspendedBar text={t(held.key, held.params)} rulesLabel={t("suspension.rules")} />}
                <EmailBannerSlot />
              </div>
            </SiteChrome>
            <main className="flex flex-1 flex-col">{children}</main>
            <SiteChrome hideOnClient client={user?.role === "client"}>
              <div className="lc-footer-slot">
                <SiteFooter />
              </div>
            </SiteChrome>
            <SiteChrome>
              <VisitTracker />
              <LangCookieSync />
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
