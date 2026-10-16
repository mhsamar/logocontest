/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { ReactNode } from "react";
import type { CurrentUser } from "@/lib/auth/policies";
import { clientMenu, contestHref, hasNews, type ClientMenuKey } from "@/lib/client/rules";
import { clientShell } from "@/lib/client/workspace";
import { brandPictures } from "@/lib/content/brand";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";
import { ClientAvatarMenu } from "./avatar-menu";
import { CwIcon, type CwIconName } from "./icons";
import { MenuScroll } from "./menu-scroll";
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
export async function ClientShell({ user, active, children }: { user: CurrentUser; active: ClientMenuKey | null; children: ReactNode }) {
  const [{ t, locale }, shell, pictures] = await Promise.all([getI18n(), clientShell(user), brandPictures()]);
  const items = clientMenu(shell.counts, shell.links);
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
            <ClientAvatarMenu name={shell.name} business={shell.business} avatarUrl={shell.avatarUrl} news={hasNews(shell.counts)} accountLabel={t("cw.shell.account")} logoutLabel={t("nav.logout")} />
          </header>
          <div className="dp cw">
            <main className="cmn">{children}</main>
            <aside className="cside">
              <div className="csb">
                <span className="csk">
                  <CwIcon name="crown" size={14} />
                  {t("cw.shell.kicker")}
                </span>
                <nav aria-label={t("cw.shell.menu")} data-client-menu>
                  {items.map((i) => (
                    <Link key={i.key} href={i.href} className={i.key === active ? "on" : undefined} aria-current={i.key === active ? "page" : undefined} title={t(`cw.menu.${i.key}`)} data-menu={i.key}>
                      <CwIcon name={ICON[i.key]} size={19} />
                      <span>{t(`cw.menu.${i.key}`)}</span>
                      {i.badge && <em className={i.badge.tone === "r" ? "cr" : "cn"}>{num(i.badge.n)}</em>}
                    </Link>
                  ))}
                </nav>
                <MenuScroll />
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
                <Link href="/support" className="dout sm wide">
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
