import type { Metadata } from "next";
import "@/components/logo-checker/checker-page.css";
import { LogoCheckerPage } from "@/components/logo-checker/checker-page";
import { PageShell } from "@/components/ui/panel";
import { getI18n, pageAlternates } from "@/lib/i18n/server";
import { checkLimits } from "@/lib/logo-check/run";
import { getProSettings } from "@/lib/pro/settings";
import { openGraphFor } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getI18n();
  const title = t("checkerPage.metaTitle");
  const description = t("checkerPage.metaDescription");
  return { title: { absolute: title }, description, alternates: await pageAlternates("/logo-checker"), openGraph: openGraphFor({ title, description, path: "/logo-checker", locale }) };
}

/**
 * Public Logo Checker page (owner, 2026-10-13; Design/logo-checker). Open to everyone; only the contest's client
 * can run a check, inside their contest. The price and the number of checks come from Settings.
 */
export default async function LogoCheckerRoute() {
  const [limits, pro] = await Promise.all([checkLimits(), getProSettings()]);
  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-[1384px] flex-col gap-5">
        <LogoCheckerPage numbers={{ perThousand: limits.perThousand, freeFrom: limits.freeFrom, price: limits.price, freeChecks: limits.freeChecks, paidChecks: limits.paidChecks, closeFrom: limits.closeFrom, basicChecks: pro.settings.basicLogoChecks, proChecks: pro.settings.proLogoChecks }} />
      </div>
    </PageShell>
  );
}
