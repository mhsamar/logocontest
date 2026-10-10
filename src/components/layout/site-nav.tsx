/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { AvatarMenu } from "@/components/layout/avatar-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { logout } from "@/lib/auth/actions";
import { can, type CurrentUser } from "@/lib/auth/policies";
import type { Translate } from "@/lib/i18n/translate";
import { brandPictures } from "@/lib/content/brand";
import { visibleList } from "@/lib/content/lists";
import { setLocale } from "@/lib/i18n/actions";
import { getI18n } from "@/lib/i18n/server";
import { listNotifications, unreadCount } from "@/lib/notifications";
import { renderNotification } from "@/lib/notifications/render";
import { SiteNavDrawer } from "./site-nav-drawer";

/** Account menu items (UI-JOURNEY §2.1). */
export function accountItems(user: CurrentUser, t: Translate) {
  const items: { href: string; label: string }[] = [];
  if (can(user, "admin.access")) items.push({ href: "/admin", label: t("nav.admin") });
  if (user.role !== "admin") items.push({ href: "/dashboard", label: t("nav.dashboard") });
  if (can(user, "contest.save")) items.push({ href: "/dashboard/saved", label: t("nav.saved") });
  if (user.role === "designer") items.push({ href: "/dashboard/wallet", label: t("nav.wallet") });
  if (user.role !== "admin") items.push({ href: "/dashboard/profile", label: t("nav.profile") });
  return items;
}

/** The brand mark + name, as in the design; an admin's uploaded logo replaces both (A-17). */
async function NavLogo() {
  const { t } = await getI18n();
  const uploaded = (await brandPictures()).logo;
  return (
    <Link href="/" aria-label={t("brand.home")} className="lc-d flex min-h-11 items-center gap-2 text-[19px] font-semibold tracking-[-0.03em]">
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
export async function SiteNav({ user }: { user: CurrentUser | null }) {
  const { t, locale } = await getI18n();
  const links = (await visibleList("header_menu", locale)).map((item) => ({ href: item.href ?? "/", label: item.text.label }));
  const now = new Date();
  const [latest, unread] = user ? await Promise.all([listNotifications(user.id, 8), unreadCount(user.id)]) : [[], 0];
  const otherLocale = locale === "en" ? "bn" : "en";
  const languageForm = (className: string) => (
    <form action={setLocale}>
      <input type="hidden" name="locale" value={otherLocale} />
      <button type="submit" lang={otherLocale} aria-label={t("nav.switchToLabel")} className={className}>
        {t("nav.switchTo")}
      </button>
    </form>
  );
  const logoutForm = (
    <form action={logout}>
      <button type="submit" className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-medium text-danger hover:bg-canvas">
        {t("nav.logout")}
      </button>
    </form>
  );
  const pill = "inline-flex min-h-11 items-center rounded-[14px] font-semibold";

  return (
    <nav
      aria-label={t("nav.main")}
      className="lc-nv lc-sh z-50 flex w-max max-w-[calc(100%-28px)] flex-wrap items-center justify-center gap-x-7 gap-y-1 rounded-[22px] border border-line bg-white/90 py-2 pl-[22px] pr-2 text-base font-medium backdrop-blur-[16px]"
    >
      <NavLogo />
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="lc-nv-link py-[11px]">
          {l.label}
        </Link>
      ))}
      <div className="lc-nv-link">{languageForm("py-[11px] font-medium")}</div>
      <div className="flex items-center gap-1.5">
        {user ? (
          <>
            <NotificationBell items={latest.map((n) => renderNotification(n, t, locale, now))} unread={unread} />
            <AvatarMenu name={user.name} avatarUrl={user.avatarUrl} label={t("nav.account")} items={accountItems(user, t)} footer={logoutForm} />
          </>
        ) : (
          <>
            <Link href="/designers/signup" className={`lc-nv-join ${pill} border border-line px-[18px]`}>
              {t("nav.becomeDesigner")}
            </Link>
            <Link href="/login" className={`${pill} bg-ink px-[22px] text-white`}>
              {t("nav.login")}
            </Link>
          </>
        )}
        <SiteNavDrawer links={links} openLabel={t("nav.menu")} closeLabel={t("nav.close")}>
          {user ? (
            accountItems(user, t).map((item) => (
              <Link key={item.href} href={item.href} className={`${pill} justify-center border border-line px-4`}>
                {item.label}
              </Link>
            ))
          ) : (
            <Link href="/designers/signup" className={`${pill} justify-center border border-line px-4`}>
              {t("nav.becomeDesigner")}
            </Link>
          )}
          {user && (
            <form action={logout}>
              <button type="submit" className={`${pill} w-full justify-center border border-line px-4 text-danger`}>
                {t("nav.logout")}
              </button>
            </form>
          )}
          {languageForm(`${pill} w-full justify-center bg-chip px-4`)}
        </SiteNavDrawer>
      </div>
    </nav>
  );
}
