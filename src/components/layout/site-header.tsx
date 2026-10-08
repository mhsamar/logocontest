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
import { NavLinks, PILL_LINK } from "./nav-links";
import { GUEST_NAV } from "./nav-items";

/**
 * Avatar menu items (UI-JOURNEY §2.1). Client and designer items (Dashboard,
 * Create Contest, Payments, Wallet, …) are added with the milestones that build
 * those screens.
 */
function accountItems(user: CurrentUser, t: Translate) {
  const items: { href: string; label: string }[] = [];
  if (can(user, "admin.access")) items.push({ href: "/admin", label: t("nav.admin") });
  if (user.role !== "admin") items.push({ href: "/dashboard", label: t("nav.dashboard") });
  if (can(user, "contest.save")) items.push({ href: "/dashboard/saved", label: t("nav.saved") });
  if (user.role !== "admin") items.push({ href: "/dashboard/profile", label: t("nav.profile") });
  return items;
}


export async function SiteHeader() {
  const [{ locale, t }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  const links = GUEST_NAV.map((item) => ({ href: item.href, label: t(item.label) }));
  const callLabel = t("nav.call", { phone: SUPPORT_PHONE });
  const toggle = (tone: "light" | "dark") => <LocaleToggle locale={locale} label={t("nav.switchTo")} ariaLabel={t("nav.switchToLabel")} tone={tone} />;

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
      <div className="relative flex h-16 items-center gap-2 pl-4 pr-2 sm:pl-6">
        <Link href="/" aria-label={t("brand.home")} className="flex min-h-11 items-center rounded-full px-1">
          <Wordmark inverted />
        </Link>

        {/* Desktop: links next to the logo (centred from 1280px), language and account on the right */}
        <nav className="hidden items-center gap-1 lg:ml-4 lg:flex xl:absolute xl:left-1/2 xl:ml-0 xl:-translate-x-1/2" aria-label={t("nav.main")}>
          <NavLinks links={links} />
          {/* Hidden between 1024 and 1280px so the guest buttons fit; the number is also in the hero and footer. */}
          <span className="hidden xl:flex">
            <a href={SUPPORT_PHONE_HREF} className={`${PILL_LINK} text-white/70 hover:text-white`}>
              {callLabel}
            </a>
          </span>
        </nav>
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          {toggle("dark")}
          {user ? (
            <AvatarMenu name={user.name} avatarUrl={user.avatarUrl} label={t("nav.account")} items={accountItems(user, t)} footer={logoutForm("menu")} />
          ) : (
            <>
              <Link
                href="/designers/signup"
                className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[0.9375rem] font-semibold text-white ring-1 ring-inset ring-white/20 transition-colors hover:bg-white/10"
              >
                <svg viewBox="0 0 24 24" className="size-4 text-cream" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M15.7 21.3a1 1 0 0 1-1.4 0l-1.6-1.6a1 1 0 0 1 0-1.4l5.6-5.6a1 1 0 0 1 1.4 0l1.6 1.6a1 1 0 0 1 0 1.4Z" strokeLinejoin="round" />
                  <path d="m18 13-1.4-6.9a1 1 0 0 0-.7-.8L3.2 2a1 1 0 0 0-1.2 1.2l3.3 12.7a1 1 0 0 0 .8.7L13 18M2.3 2.3l7.3 7.3" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="11" cy="11" r="2" />
                </svg>
                {t("nav.becomeDesigner")}
              </Link>
              <Link
                href="/login"
                className="inline-flex min-h-12 items-center rounded-full bg-white px-6 text-[0.9375rem] font-bold text-ink shadow-card transition-colors hover:bg-cream"
              >
                {t("nav.login")}
              </Link>
            </>
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
              <>
                <ButtonLink href="/login" size="lg" block>
                  {t("nav.login")}
                </ButtonLink>
                <ButtonLink href="/designers/signup" variant="secondary" size="lg" block>
                  {t("nav.becomeDesigner")}
                </ButtonLink>
              </>
            )}
            <div className="flex justify-center pt-1">{toggle("light")}</div>
          </MobileMenu>
        </div>
      </div>
    </HeaderShell>
  );
}
