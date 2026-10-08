import type { Metadata, Viewport } from "next";
import { Hind_Siliguri, Instrument_Serif, Inter, Tiro_Bangla } from "next/font/google";
import { PointerFx } from "@/components/layout/pointer-fx";
import { SiteFooter } from "@/components/layout/site-footer";
import { EmailBannerSlot } from "@/components/layout/email-banner-slot";
import { SiteHeader } from "@/components/layout/site-header";
import { ToastProvider } from "@/components/ui/toast";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
import "./globals.css";

const latin = Inter({ variable: "--font-latin", subsets: ["latin"], display: "swap" });
const bangla = Hind_Siliguri({
  variable: "--font-bangla",
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
// Display fonts for the accent words in headlines (owner, 2026-10-08).
const displayLatin = Instrument_Serif({ variable: "--font-display-latin", subsets: ["latin"], weight: "400", style: ["normal", "italic"], display: "swap" });
const displayBangla = Tiro_Bangla({ variable: "--font-display-bangla", subsets: ["bengali"], weight: "400", style: ["normal", "italic"], display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: t("meta.title"), template: `%s · ${t("brand.name")}` },
    description: t("meta.description"),
  };
}

export const viewport: Viewport = {
  themeColor: "#8b0000",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale } = await getI18n();
  return (
    <html lang={locale} className={`${latin.variable} ${bangla.variable} ${displayLatin.variable} ${displayBangla.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={locale}>
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
