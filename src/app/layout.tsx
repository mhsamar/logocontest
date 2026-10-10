import type { Metadata, Viewport } from "next";
import { Hind_Siliguri } from "next/font/google";
import { AdminBar } from "@/components/layout/admin-bar";
import { PointerFx } from "@/components/layout/pointer-fx";
import { SiteFooter } from "@/components/layout/site-footer";
import { EmailBannerSlot } from "@/components/layout/email-banner-slot";
import { SiteChrome } from "@/components/layout/site-chrome";
import { SiteNav } from "@/components/layout/site-nav";
import { VisitTracker } from "@/components/layout/visit-tracker";
import { SupportSlot } from "@/components/support/support-slot";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { ToastProvider } from "@/components/ui/toast";
import { I18nProvider } from "@/lib/i18n/client";
import { NoticeBar } from "@/components/layout/notice-bar";
import { currentNotice } from "@/lib/content/notice";
import { getMessages } from "@/lib/content/texts";
import { can } from "@/lib/auth/policies";
import { getCurrentUser } from "@/lib/auth/session";
import { showsLanding } from "@/lib/home/landing";
import { getI18n } from "@/lib/i18n/server";
import { openGraphFor, searchIndexingOn, siteUrl } from "@/lib/seo";
import { landingBody, landingHeading } from "./fonts";
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
  const { t, locale } = await getI18n();
  const [messages, notice, user] = await Promise.all([getMessages(locale), currentNotice(locale), getCurrentUser()]);
  // Guests and admins get the designed home page, whose hero holds the nav (owner, 2026-10-10).
  const guestHome = showsLanding(user?.role);
  return (
    <html lang={locale} data-scroll-behavior="smooth" className={`${landingBody.variable} ${landingHeading.variable} ${bangla.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={locale} messages={messages}>
          <ToastProvider>
            <SiteChrome>
              {/* Measured by ScrollReveal so the floating nav sits below these bars. */}
              <div data-top-bars>
                {/* Admins browsing the site: who they are and the way back (owner, 2026-10-10). */}
                {can(user, "admin.access") && <AdminBar role={user!.isSuperAdmin ? t("admin.shell.superAdmin") : user!.adminTitle || t("admin.shell.staff")} />}
                {notice && <NoticeBar notice={notice} />}
                <EmailBannerSlot />
              </div>
            </SiteChrome>
            {/* The floating nav on every page (owner, 2026-10-10); the guest home puts it inside its hero. */}
            <SiteChrome hideOnHome={guestHome}>
              <div className="lc-nav-slot">
                <SiteNav user={user} />
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
            </SiteChrome>
            <PointerFx />
            <ScrollReveal />
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
