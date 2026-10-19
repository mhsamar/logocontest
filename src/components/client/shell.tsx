/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { ReactNode } from "react";
import type { CurrentUser } from "@/lib/auth/policies";
import { clientMenu, contestHref, hasNews, type ClientMenuKey } from "@/lib/client/rules";
import { clientShell } from "@/lib/client/workspace";
import { brandPictures } from "@/lib/content/brand";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";
import { NavLinks } from "@/components/layout/nav-links";
import { NotificationBell } from "@/components/layout/notification-bell";
import { siteMenuLinks } from "@/components/layout/site-nav";
import { DrawerAccount } from "@/components/layout/drawer-account";
import { SiteNavDrawer } from "@/components/layout/site-nav-drawer";
import { logout } from "@/lib/auth/actions";
import { setLocale } from "@/lib/i18n/actions";
import { listNotifications, unreadCount } from "@/lib/notifications";
import { renderNotification } from "@/lib/notifications/render";
import { ClientAvatarMenu } from "./avatar-menu";
import { CwIcon, type CwIconName } from "./icons";
import { ClientMenuNav } from "./menu-nav";
import "./client.css";

const ICON: Record<ClientMenuKey, CwIconName> = {
  dashboard: "home",
  contests: "grid",
  start: "plus",
  review: "eye",
  messages: "chat",
  shortlist: "heart",
  checks: "shield",
  files: "badge",
  payments: "card",
  profile: "user",
  settings: "gear",
  help: "help",
};

/**
 * The premium client workspace (owner, 2026-10-16; Design/client-premium, CLIENT-HANDOFF §1): a top bar with only the
 * logo and the client's photo, the page, and the menu on the right with live counts, the logo checks card and help.
 * On phones the menu moves to the top as a row of icons.
 */
export async function ClientShell({ user, active, children }: { user: CurrentUser; active?: ClientMenuKey | null; children: ReactNode }) {
  const [{ t, locale }, shell, pictures, links, latest, unread] = await Promise.all([
    getI18n(),
    clientShell(user),
    brandPictures(),
    siteMenuLinks(user),
    listNotifications(user.id, 8),
    unreadCount(user.id),
  ]);
  const items = clientMenu(shell.counts, shell.links);
  const now = new Date();
  const otherLocale = locale === "en" ? "bn" : "en";
  const languageForm = (className: string) => (
    <form action={setLocale}>
      <input type="hidden" name="locale" value={otherLocale} />
      <button type="submit" lang={otherLocale} aria-label={t("nav.switchToLabel")} className={className}>
        {t("nav.switchTo")}
      </button>
    </form>
  );
  const num = (n: number) => formatNumber(n, locale);
  const c = shell.checks;
  return (
    <div className="cwx" data-client-shell>
      <div className="pg">
        <div className="pgw">
          <header className="ctop">
            <Link href="/client" className="clogo" aria-label={t("brand.home")}>
              <img src={pictures.logo ?? "/brand/logo-icon-tile.png"} alt="" />
              {!pictures.logo && <b>{t("brand.name")}</b>}
            </Link>
            {/* The site's menu (owner, 2026-10-17: "there is no menu bar for clients"): the same links as everywhere
                else, the language switch and the bell; on smaller screens they move into the menu button. */}
            <nav className="ctn" aria-label={t("nav.main")} data-no-fx>
              <NavLinks links={links} />
              {languageForm("lc-nv-link py-[11px] font-medium")}
            </nav>
            <div className="ctx">
              <NotificationBell items={latest.map((n) => renderNotification(n, t, locale, now, "client"))} unread={unread} />
              <ClientAvatarMenu name={shell.name} business={shell.business} avatarUrl={shell.avatarUrl} news={hasNews(shell.counts)} accountLabel={t("cw.shell.account")} logoutLabel={t("nav.logout")} />
              <SiteNavDrawer links={links} openLabel={t("nav.menu")} closeLabel={t("nav.close")}>
                {/* Every workspace page with its name (owner, 2026-10-20): on phones the left menu is a row of icons. */}
                <DrawerAccount title={t("nav.yourAccount")} items={items.map((i) => ({ href: i.href, label: t(`cw.menu.${i.key}`), badge: i.badge ? num(i.badge.n) : null }))} />
                <form action={logout} className="mt-2">
                  <button type="submit" className="inline-flex min-h-11 w-full items-center justify-center rounded-[14px] border border-line px-4 font-semibold text-danger" data-drawer-logout>
                    {t("nav.logout")}
                  </button>
                </form>
                {languageForm("inline-flex min-h-11 w-full items-center justify-center rounded-[14px] bg-chip px-4 font-semibold")}
              </SiteNavDrawer>
            </div>
          </header>
          <div className="dp cw">
            <main className="cmn">{children}</main>
            <aside className="cside">
              <div className="csb">
                <span className="csk">
                  <CwIcon name="crown" size={14} />
                  {t("cw.shell.kicker")}
                </span>
                <ClientMenuNav
                  label={t("cw.shell.menu")}
                  active={active}
                  items={items.map((i) => ({ key: i.key, href: i.href, text: t(`cw.menu.${i.key}`), icon: ICON[i.key], badge: i.badge ? { text: num(i.badge.n), tone: i.badge.tone } : null }))}
                />
              </div>
              {c && (
                <div className="csc" data-checks-card>
                  <span className="csg" aria-hidden />
                  <b>{t("cw.shell.checks")}</b>
                  <em>
                    {t(c.free ? "cw.shell.checksFree" : "cw.shell.checksLeft", { left: num(c.left), limit: num(c.limit), brand: c.brand })}
                  </em>
                  <i className="dslot">
                    <s style={{ width: `${c.limit ? Math.round((c.left / c.limit) * 100) : 0}%` }} />
                  </i>
                  <Link href={contestHref(c.slug, "designs")} className="dlink sm">
                    {t("cw.shell.checkLogo")}
                    <CwIcon name="arrow" size={16} />
                  </Link>
                </div>
              )}
              <div className="csh">
                <b>{t("cw.shell.helpTitle")}</b>
                <em>{t("cw.shell.helpLead")}</em>
                <Link href="/client/help" className="dout sm wide">
                  <CwIcon name="chat" size={16} />
                  {t("cw.shell.helpButton")}
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
