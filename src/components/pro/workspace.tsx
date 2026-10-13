import Link from "next/link";
import type { ReactNode } from "react";
import { PageShell } from "@/components/ui/panel";
import type { CurrentUser } from "@/lib/auth/policies";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { unreadChats } from "@/lib/pro/chat";
import { designerCheckUsage } from "@/lib/pro/logo-checks";
import { getProSettings } from "@/lib/pro/settings";
import { getSubscription } from "@/lib/pro/status";
import { earlyContests, portfolioCount } from "@/lib/pro/workspace";
import { Icon, ProAvatar, ProBadge, Slot, type ProIconName } from "./parts";
import "./pro.css";

export type WsPage = "dashboard" | "contests" | "saved" | "messages" | "insights" | "wallet" | "profile" | "settings" | "support" | "checker";

/**
 * The Pro workspace (owner, 2026-10-13; Design/pro/pro-*.html): the left menu on every Pro designer page, with the
 * early-access count, unread chats, the plan's renewal date, portfolio slots and logo checks left.
 */
export async function ProWorkspace({ user, active, children }: { user: CurrentUser; active: WsPage; children: ReactNode }) {
  const [{ t, locale }, { settings }, sub, early, unread, usage, slots] = await Promise.all([
    getI18n(),
    getProSettings(),
    getSubscription(user.id),
    earlyContests(),
    unreadChats(user),
    designerCheckUsage(user.id),
    portfolioCount(user.id),
  ]);
  const f = settings.features;
  const items: { key: WsPage; href: string; icon: ProIconName; label: MessageKey; badge?: { text: string; cls: string }; show?: boolean }[] = [
    { key: "dashboard", href: "/dashboard", icon: "grid", label: "pro.ws.dashboard" },
    { key: "contests", href: "/dashboard/contests", icon: "trophy", label: "pro.ws.contests", badge: early.length ? { text: t("pro.ws.early", { n: early.length }), cls: "nb" } : undefined },
    { key: "saved", href: "/dashboard/saved", icon: "heart", label: "pro.ws.saved" },
    { key: "messages", href: "/dashboard/messages", icon: "chat", label: "pro.ws.messages", badge: unread ? { text: String(unread), cls: "nc" } : undefined, show: f.client_chat },
    { key: "insights", href: "/dashboard/insights", icon: "chart", label: "pro.ws.insights", show: f.insights },
    { key: "checker", href: "/dashboard/logo-checks", icon: "shield", label: "pro.ws.checker" },
    { key: "wallet", href: "/dashboard/wallet", icon: "wallet", label: "pro.ws.wallet" },
    { key: "profile", href: user.username ? `/designer/${user.username}` : "/dashboard/profile", icon: "user", label: "pro.ws.profile" },
    { key: "settings", href: "/dashboard/profile", icon: "gear", label: "pro.ws.settings" },
    { key: "support", href: "/dashboard/support", icon: "help", label: "pro.ws.support", show: f.priority_support },
  ];
  return (
    <PageShell>
      <div className="pr pr-ws">
        <aside className="pr-side">
          <div className="pr-me">
            <ProAvatar name={user.name} url={user.avatarUrl} />
            <div>
              <b>{user.name}</b>
              <ProBadge size="sm" />
            </div>
          </div>
          <nav className="pr-nav" aria-label={t("pro.ws.label")}>
            {items
              .filter((i) => i.show !== false)
              .map((i) => (
                <Link key={i.key} href={i.href} className={i.key === active ? "on" : undefined} aria-current={i.key === active ? "page" : undefined}>
                  <Icon name={i.icon} />
                  <span>{t(i.label)}</span>
                  {i.badge && <em className={i.badge.cls}>{i.badge.text}</em>}
                </Link>
              ))}
          </nav>
          {sub && (
            <div className="pr-plan">
              <span className="glow" aria-hidden />
              <span className="k">
                <Icon name="crown" size={14} />
                {t("pro.ws.planKicker")}
              </span>
              <b>{sub.status === "cancelled" ? t("pro.ws.ends", { date: formatDate(sub.currentPeriodEnd, locale, "short") }) : t("pro.ws.renews", { date: formatDate(sub.currentPeriodEnd, locale, "short") })}</b>
              <Slot used={slots} max={settings.proPortfolioLimit} />
              <em>{t("pro.ws.slots", { used: slots, max: settings.proPortfolioLimit })}</em>
              <span className="l">{t("pro.ws.checksLeft", { left: usage.left, max: usage.limit })}</span>
            </div>
          )}
        </aside>
        <div className="pr-main">{children}</div>
      </div>
    </PageShell>
  );
}

/** The title row of a workspace page. */
export function WsHead({ title, lead, action }: { title: string; lead?: string; action?: ReactNode }) {
  return (
    <div className="pr-head">
      <div>
        <div className="t">
          <h1>{title}</h1>
          <ProBadge />
        </div>
        {lead && <p>{lead}</p>}
      </div>
      {action}
    </div>
  );
}
