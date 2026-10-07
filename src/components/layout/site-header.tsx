import Link from "next/link";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/logo";
import { logout } from "@/lib/auth/actions";
import { can, type CurrentUser } from "@/lib/auth/policies";
import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { SUPPORT_PHONE, SUPPORT_PHONE_HREF } from "@/lib/site";
import { AvatarMenu } from "./avatar-menu";
import { HeaderShell } from "./header-shell";
import { LocaleToggle } from "./locale-toggle";
import { MobileMenu } from "./mobile-menu";
import { GUEST_NAV } from "./nav-items";

/**
 * Avatar menu items (UI-JOURNEY §2.1). Client and designer items (Dashboard,
 * Create Contest, Payments, Wallet, …) are added with the milestones that build
 * those screens.
 */
function accountItems(user: CurrentUser, t: Translate) {
  const items: { href: string; label: string }[] = [];
  if (can(user, "admin.access")) items.push({ href: "/admin", label: t("nav.admin") });
  return items;
}

const NAV_LINK = "inline-flex min-h-11 items-center rounded-md px-3 text-[0.9375rem] font-medium text-muted transition-colors hover:text-ink";

export async function SiteHeader() {
  const [{ locale, t }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  const links = GUEST_NAV.map((item) => ({ href: item.href, label: t(item.label) }));
  const callLabel = t("nav.call", { phone: SUPPORT_PHONE });
  const toggle = <LocaleToggle locale={locale} label={t("nav.switchTo")} ariaLabel={t("nav.switchToLabel")} />;

  const logoutForm = (variant: "menu" | "block") => (
    <form action={logout}>
      <button
        type="submit"
        className={
          variant === "menu"
            ? "flex min-h-11 w-full items-center px-4 text-left text-sm text-ink hover:bg-canvas"
            : buttonClasses({ variant: "secondary", block: true, size: "lg" })
        }
      >
        {t("nav.logout")}
      </button>
    </form>
  );

  return (
    <HeaderShell>
      <div className="relative mx-auto flex h-16 max-w-page items-center gap-2 px-5 sm:px-8">
        <Link href="/" aria-label={t("brand.home")} className="-ml-1 flex min-h-11 items-center rounded-md px-1">
          <Wordmark />
        </Link>

        {/* Desktop: links centred, account and language on the right */}
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 lg:flex" aria-label={t("nav.main")}>
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={NAV_LINK}>
              {link.label}
            </Link>
          ))}
          <a href={SUPPORT_PHONE_HREF} className={NAV_LINK}>
            {callLabel}
          </a>
        </nav>
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          {toggle}
          {user ? (
            <AvatarMenu name={user.name} label={t("nav.account")} items={accountItems(user, t)} footer={logoutForm("menu")} />
          ) : (
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-md bg-ink px-5 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              {t("nav.login")}
            </Link>
          )}
        </div>

        {/* Mobile: logo left, hamburger right; the phone number is a tap-to-call link inside the menu */}
        <div className="ml-auto lg:hidden">
          <MobileMenu openLabel={t("nav.menu")} closeLabel={t("nav.close")} links={links}>
            <a href={SUPPORT_PHONE_HREF} className="flex min-h-12 items-center gap-2 text-base font-medium text-primary">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
              </svg>
              {callLabel}
            </a>
            {user ? (
              <>
                <p className="pt-2 text-sm text-muted">{t("nav.signedInAs", { name: user.name })}</p>
                {accountItems(user, t).map((item) => (
                  <ButtonLink key={item.href} href={item.href} variant="secondary" size="lg" block>
                    {item.label}
                  </ButtonLink>
                ))}
                {logoutForm("block")}
              </>
            ) : (
              <ButtonLink href="/login" size="lg" block>
                {t("nav.login")}
              </ButtonLink>
            )}
            <div className="flex justify-center pt-1">{toggle}</div>
          </MobileMenu>
        </div>
      </div>
    </HeaderShell>
  );
}
