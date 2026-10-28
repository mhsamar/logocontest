/* eslint-disable @next/next/no-img-element */
import Link from "@/components/ui/link";
import { Suspense } from "react";
import { LogoutForm } from "@/components/push/logout-form";
import { AvatarMenu } from "@/components/layout/avatar-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { logout } from "@/lib/auth/actions";
import { can, type CurrentUser } from "@/lib/auth/policies";
import type { Translate } from "@/lib/i18n/translate";
import { brandPictures } from "@/lib/content/brand";
import { isNewLink } from "@/lib/content/list-defs";
import { visibleList } from "@/lib/content/lists";
import { showsLink } from "@/lib/rewards/program";
import { visibleOffers } from "@/lib/rewards/visible";
import { getI18n } from "@/lib/i18n/server";
import { listNotifications, unreadCount } from "@/lib/notifications";
import { proMenu } from "@/lib/pro/menu";
import { getProSettings } from "@/lib/pro/settings";
import { isPro } from "@/lib/pro/status";
import { renderNotification } from "@/lib/notifications/render";
import { LanguageLink } from "./language-link";
import { NavLinks, Roll } from "./nav-links";
import { DrawerAccount } from "./drawer-account";
import { SiteNavDrawer } from "./site-nav-drawer";

/** Account menu items (UI-JOURNEY §2.1). */
export function accountItems(user: CurrentUser, t: Translate) {
  const items: { href: string; label: string }[] = [];
  if (can(user, "admin.access")) items.push({ href: "/admin", label: t("nav.admin") });
  // A client's pages are in the client workspace (owner, 2026-10-17).
  if (user.role !== "admin") items.push({ href: user.role === "client" ? "/client" : "/dashboard", label: t("nav.dashboard") });
  // AI copyright checker results and certificates (owner, 2026-10-10).
  if (user.role === "client") items.push({ href: "/client/checks", label: t("nav.logoChecks") });
  if (can(user, "contest.save")) items.push({ href: "/dashboard/saved", label: t("nav.saved") });
  if (user.role === "designer") items.push({ href: "/dashboard/wallet", label: t("nav.wallet") });
  if (user.role !== "admin") items.push({ href: user.role === "client" ? "/client/settings" : "/dashboard/profile", label: t("nav.profile") });
  return items;
}

/** The brand mark + name, as in the design; an admin's uploaded logo replaces both (A-17). */
async function NavLogo() {
  const { t } = await getI18n();
  const uploaded = (await brandPictures()).logo;
  return (
    <Link href="/" aria-label={t("brand.home")} className="lc-nv-logo lc-d flex min-h-11 items-center gap-2 text-[19px] font-semibold tracking-[-0.03em]">
      {uploaded ? (
        <img src={uploaded} alt="" className="h-7 w-auto max-w-[10rem] object-contain" />
      ) : (
        <>
          <img src="/brand/logo-icon-tile.png" alt="" width={24} height={24} className="h-6 w-6 rounded-[7px]" />
          {t("brand.name")}
        </>
      )}
    </Link>
  );
}

/**
 * Site nav (owner, 2026-10-10; the home page design, on every page): floating on wide screens, one line with logo,
 * Log in and a menu button on phones. Links come from Lists → Header menu (A-15).
 */
/** The menu bar's links from Lists → Header menu; also used by the client workspace's top bar (owner, 2026-10-17). */
export async function siteMenuLinks(user: CurrentUser | null): Promise<{ href: string; label: string; badge?: string }[]> {
  const { t, locale } = await getI18n();
  const now = new Date();
  const [menu, offers] = await Promise.all([visibleList("header_menu", locale), visibleOffers()]);
  // Owner, 2026-10-11: a signed-in client gets "My contests" (P-14) where the menu has Browse Contests.
  // Owner, 2026-10-13: the leaderboard link leaves the menu while the monthly prizes program is off.
  return menu.filter((item) => showsLink(item.href, offers)).map((item) =>
    user?.role === "client" && item.href === "/contests"
      ? { href: "/client/contests", label: t("nav.myContests") }
      : { href: item.href ?? "/", label: item.text.label, badge: isNewLink(item.href, now) ? t("nav.new") : undefined },
  );
}

export async function SiteNav({ user }: { user: CurrentUser | null }) {
  const { t, locale } = await getI18n();
  const now = new Date();
  const links = await siteMenuLinks(user);
  const [latest, unread] = user ? await Promise.all([listNotifications(user.id, 8), unreadCount(user.id)]) : [[], 0];
  // Owner, 2026-10-16: a Pro designer has every page in the workspace's left menu, so the account menu at the top
  // only logs out (the name leads back to the dashboard); on phones the menu keeps the way to the dashboard.
  const pro = user?.role === "designer" && (await isPro(user.id));
  const topItems = user ? (pro ? [] : accountItems(user, t)) : [];
  // Owner, 2026-10-20: on phones a Pro designer's sliding workspace row hid Saved, Wallet and Settings, so the phone
  // menu lists every workspace page (with names), as for everyone else.
  const drawerItems = user ? (pro ? proMenu(user, (await getProSettings()).settings.features).map((i) => ({ href: i.href, label: t(i.label) })) : accountItems(user, t)) : [];
  const otherLocale = locale === "en" ? "bn" : "en";
  // A link to this page in the other language (owner, 2026-10-21): search engines follow it to the Bangla pages.
  const languageForm = (className: string, roll = false) => (
    <Suspense fallback={<span className={className}>{t("nav.switchTo")}</span>}>
      <LanguageLink locale={otherLocale} label={t("nav.switchToLabel")} className={className}>
        {roll ? <Roll>{t("nav.switchTo")}</Roll> : t("nav.switchTo")}
      </LanguageLink>
    </Suspense>
  );
  const logoutForm = (
    <LogoutForm action={logout}>
      <button type="submit" className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-medium text-danger hover:bg-canvas">
        {t("nav.logout")}
      </button>
    </LogoutForm>
  );
  const pill = "inline-flex min-h-11 items-center rounded-[14px] font-semibold";

  return (
    // The menu bar stays still: no lean-toward-the-mouse on its links and buttons (owner, 2026-10-10). Inside it,
    // motion (owner, 2026-10-12, "more premium, more advanced"): the bar settles in, an elastic red pill slides under
    // the links, labels roll, a gold spotlight follows the pointer, a red-gold light runs round the edge, the logo
    // flips, the glass firms up on scroll (globals.css "Menu bar motion").
    <nav
      data-no-fx
      aria-label={t("nav.main")}
      className="lc-nv lc-sh z-50 flex w-max max-w-[calc(100%-28px)] flex-wrap items-center justify-center gap-x-7 gap-y-1 rounded-[22px] border border-line bg-white/90 py-2 pl-[22px] pr-2 text-base font-medium backdrop-blur-[16px]"
    >
      <NavLogo />
      <NavLinks links={links} />
      <div className="lc-nv-link">{languageForm("py-[11px] font-medium", true)}</div>
      <div className="flex items-center gap-1.5">
        {user ? (
          <>
            <NotificationBell items={latest.map((n) => renderNotification(n, t, locale, now, user.role))} unread={unread} />
            <AvatarMenu name={user.name} avatarUrl={user.avatarUrl} label={t("nav.account")} items={topItems} footer={logoutForm} nameHref={pro ? "/dashboard" : undefined} />
          </>
        ) : (
          <>
            <Link href="/designers/signup" className={`lc-nv-join ${pill} border border-line px-[18px] hover:border-primary/40 hover:bg-tint hover:text-primary`}>
              <Roll>{t("nav.becomeDesigner")}</Roll>
            </Link>
            <Link href="/login" className={`lc-nv-cta lc-ripple btn-sheen relative ${pill} bg-ink px-[22px] text-white`}>
              <Roll>{t("nav.login")}</Roll>
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h13M13 6l6 6-6 6" />
              </svg>
            </Link>
          </>
        )}
        <SiteNavDrawer links={links} openLabel={t("nav.menu")} closeLabel={t("nav.close")}>
          {user ? (
            <DrawerAccount title={t("nav.yourAccount")} items={drawerItems} />
          ) : (
            <Link href="/designers/signup" className={`${pill} justify-center border border-line px-4`}>
              {t("nav.becomeDesigner")}
            </Link>
          )}
          {user && (
            <LogoutForm action={logout}>
              <button type="submit" className={`${pill} w-full justify-center border border-line px-4 text-danger`}>
                {t("nav.logout")}
              </button>
            </LogoutForm>
          )}
          {languageForm(`${pill} w-full justify-center bg-chip px-4`)}
        </SiteNavDrawer>
      </div>
    </nav>
  );
}
