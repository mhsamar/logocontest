import { NavScroll } from "@/components/ui/nav-scroll";
import Link from "@/components/ui/link";
import type { ReactNode } from "react";
import { PageShell } from "@/components/ui/panel";
import type { CurrentUser } from "@/lib/auth/policies";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { unreadChats } from "@/lib/pro/chat";
import { designerCheckUsage } from "@/lib/pro/logo-checks";
import { getProSettings } from "@/lib/pro/settings";
import { getCurrentUser } from "@/lib/auth/session";
import { getSubscription, getTrial, proKind } from "@/lib/pro/status";
import { portfolioLimit } from "@/lib/pro/trial-rules";
import { proMenu, type WsPage } from "@/lib/pro/menu";
import { earlyContests, portfolioCount } from "@/lib/pro/workspace";
import { Icon, ProAvatar, ProBadge, Slot, type ProIconName } from "./parts";
import "./pro.css";

export type { WsPage } from "@/lib/pro/menu";

const ICONS: Record<WsPage, ProIconName> = { dashboard: "grid", contests: "trophy", saved: "heart", messages: "chat", insights: "chart", checker: "shield", wallet: "wallet", profile: "user", settings: "gear", support: "help" };

/**
 * The Pro workspace (owner, 2026-10-13; Design/pro/pro-*.html): the left menu on every Pro designer page, with the
 * early-access count, unread chats, the plan's renewal date, portfolio slots and logo checks left.
 */
export async function ProWorkspace({ user, active, children }: { user: CurrentUser; active: WsPage; children: ReactNode }) {
  const [{ t, locale }, { settings }, sub, trial, kind, early, unread, usage, slots] = await Promise.all([
    getI18n(),
    getProSettings(),
    getSubscription(user.id),
    getTrial(user.id),
    proKind(user.id),
    earlyContests(),
    unreadChats(user),
    designerCheckUsage(user.id),
    portfolioCount(user.id),
  ]);
  const f = settings.features;
  // The free Pro Trial (owner, 2026-10-14): "PRO TRIAL", its end date and its own limits, with Upgrade.
  const onTrial = kind === "trial" && trial;
  const slotMax = portfolioLimit(onTrial ? "trial" : "pro", settings);
  const badgeLabel = onTrial ? t("pro.trial.badge") : undefined;
  const badges: Partial<Record<WsPage, { text: string; cls: string }>> = {
    contests: early.length ? { text: t("pro.ws.early", { n: early.length }), cls: "nb" } : undefined,
    messages: unread ? { text: String(unread), cls: "nc" } : undefined,
  };
  const items = proMenu(user, f).map((i) => ({ ...i, icon: ICONS[i.key], badge: badges[i.key] }));
  return (
    <PageShell>
      <div className="pr pr-ws">
        <aside className="pr-side">
          <div className="pr-me">
            <ProAvatar name={user.name} url={user.avatarUrl} />
            <div>
              <b>{user.name}</b>
              <ProBadge size="sm" label={badgeLabel} />
            </div>
          </div>
          <nav className="pr-nav" aria-label={t("pro.ws.label")}>
            {items.map((i) => (
                <Link key={i.key} href={i.href} className={i.key === active ? "on" : undefined} aria-current={i.key === active ? "page" : undefined}>
                  <Icon name={i.icon} />
                  <span>{t(i.label)}</span>
                  {i.badge && <em className={i.badge.cls}>{i.badge.text}</em>}
                </Link>
              ))}
          </nav>
          <NavScroll selector=".pr-nav" />
          {onTrial && (
            <div className="pr-plan">
              <span className="glow" aria-hidden />
              <span className="k">
                <Icon name="crown" size={14} />
                {t("pro.trial.badge")}
              </span>
              <b>{t("pro.ws.ends", { date: formatDate(trial.endsAt, locale, "short") })}</b>
              <Slot used={slots} max={slotMax} />
              <em>{t("pro.trial.slots", { used: slots, limit: slotMax })}</em>
              <span className="l">{t("pro.trial.checks", { left: usage.left, limit: usage.limit })}</span>
              <Link href="/pro" className="l" style={{ fontWeight: 800 }}>
                {t("pro.trial.upgrade")}
              </Link>
            </div>
          )}
          {!onTrial && sub && (
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
export async function WsHead({ title, lead, action }: { title: string; lead?: string; action?: ReactNode }) {
  const [{ t }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  const trial = (await proKind(user?.id)) === "trial";
  return (
    <div className="pr-head">
      <div>
        <div className="t">
          <h1>{title}</h1>
          <ProBadge label={trial ? t("pro.trial.badge") : undefined} />
        </div>
        {lead && <p>{lead}</p>}
      </div>
      {action}
    </div>
  );
}
