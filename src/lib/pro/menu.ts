import type { MessageKey } from "@/lib/i18n/translate";

export type WsPage = "dashboard" | "contests" | "saved" | "messages" | "insights" | "wallet" | "profile" | "settings" | "support" | "checker";

/**
 * The Pro workspace menu (owner, 2026-10-13): the left menu on wide screens, and the account part of the phone menu
 * (owner, 2026-10-20: on phones the sliding row hid Saved, Wallet and Settings off the screen).
 */
export function proMenu(user: { username: string | null }, f: { client_chat?: boolean; insights?: boolean; priority_support?: boolean }): { key: WsPage; href: string; label: MessageKey }[] {
  const all: { key: WsPage; href: string; label: MessageKey; show?: boolean }[] = [
    { key: "dashboard", href: "/dashboard", label: "pro.ws.dashboard" },
    { key: "contests", href: "/dashboard/contests", label: "pro.ws.contests" },
    { key: "saved", href: "/dashboard/saved", label: "pro.ws.saved" },
    { key: "messages", href: "/dashboard/messages", label: "pro.ws.messages", show: f.client_chat },
    { key: "insights", href: "/dashboard/insights", label: "pro.ws.insights", show: f.insights },
    { key: "checker", href: "/dashboard/logo-checks", label: "pro.ws.checker" },
    { key: "wallet", href: "/dashboard/wallet", label: "pro.ws.wallet" },
    { key: "profile", href: user.username ? `/designer/${user.username}` : "/dashboard/profile", label: "pro.ws.profile" },
    { key: "settings", href: "/dashboard/profile", label: "pro.ws.settings" },
    { key: "support", href: "/dashboard/support", label: "pro.ws.support", show: f.priority_support },
  ];
  return all.filter((i) => i.show !== false).map(({ key, href, label }) => ({ key, href, label }));
}
