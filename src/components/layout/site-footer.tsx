import Link from "next/link";
import { Wordmark } from "@/components/ui/logo";
import { getI18n } from "@/lib/i18n/server";
import { SUPPORT_PHONE, SUPPORT_PHONE_HREF } from "@/lib/site";
import { LEGAL_NAV } from "./nav-items";

const LINK = "inline-flex min-h-11 items-center text-sm text-white/70 transition-colors hover:text-cream";

export async function SiteFooter() {
  const { t } = await getI18n();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-ink text-white">
      <div className="mx-auto flex max-w-page flex-col gap-8 px-4 py-12 md:flex-row md:justify-between">
        <div className="max-w-xs">
          <Wordmark inverted />
          <p className="mt-3 text-sm text-white/70">{t("footer.blurb")}</p>
        </div>
        <nav aria-label={t("footer.legal")}>
          <ul className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
            {LEGAL_NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={LINK}>
                  {t(item.label)}
                </Link>
              </li>
            ))}
            <li>
              <a href={SUPPORT_PHONE_HREF} className={LINK}>
                {t("footer.contact", { phone: SUPPORT_PHONE })}
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-white/55">
          <span>{t("footer.rights", { year })}</span>
          <span>{t("footer.madeIn")}</span>
        </div>
      </div>
    </footer>
  );
}
