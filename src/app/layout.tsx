import type { Metadata, Viewport } from "next";
import { Hind_Siliguri, Instrument_Serif, Inter, Tiro_Bangla } from "next/font/google";
import { PointerFx } from "@/components/layout/pointer-fx";
import { SiteFooter } from "@/components/layout/site-footer";
import { EmailBannerSlot } from "@/components/layout/email-banner-slot";
import { SiteHeader } from "@/components/layout/site-header";
import { ToastProvider } from "@/components/ui/toast";
import { I18nProvider } from "@/lib/i18n/client";
import { MESSAGES } from "@/lib/i18n/messages";
import { getI18n } from "@/lib/i18n/server";
import { openGraphFor, searchIndexingOn, siteUrl } from "@/lib/seo";
import "./globals.css";

const latin = Inter({ variable: "--font-latin", subsets: ["latin"], display: "swap" });
// Bengali characters only: Latin text always uses Inter, so Hind's Latin files were never needed (BLUEPRINT §15.1).
const bangla = Hind_Siliguri({
  variable: "--font-bangla",
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
// Display fonts for the accent words in headlines (owner, 2026-10-08).
const displayLatin = Instrument_Serif({ variable: "--font-display-latin", subsets: ["latin"], weight: "400", style: ["normal", "italic"], display: "swap" });
// Accent words only, so it is not preloaded; the browser fetches it when Bangla accent text is on the page.
const displayBangla = Tiro_Bangla({ variable: "--font-display-bangla", subsets: ["bengali"], weight: "400", style: ["normal", "italic"], display: "swap", preload: false });

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
  const { locale } = await getI18n();
  return (
    <html lang={locale} data-scroll-behavior="smooth" className={`${latin.variable} ${bangla.variable} ${displayLatin.variable} ${displayBangla.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={locale} messages={MESSAGES[locale]}>
          <ToastProvider>
            {/* Pastel aurora wash behind every page (UI-JOURNEY §1.1) */}
            <div className="page-aurora pointer-events-none fixed inset-0 -z-10" aria-hidden />
            <EmailBannerSlot />
            <SiteHeader />
            <main className="flex flex-1 flex-col">{children}</main>
            <SiteFooter />
            <PointerFx />
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
