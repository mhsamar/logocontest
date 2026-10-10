"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/ui/logo";
import { isReadOnlyPage, type AdminBadge, type AdminNavGroup } from "@/lib/admin/nav";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { AccountMenu } from "./account-menu";
import { ActivityDrawer } from "./activity-drawer";
import { AdminIcon } from "./icons";
import { ReadOnlyProvider } from "./read-only";

export type AdminMe = { name: string; title: string | null; isSuper: boolean; permissions: string[] };

const initial = (name: string) => name.trim().slice(0, 1).toUpperCase() || "A";

function NavList({ groups, counts, onPick }: { groups: AdminNavGroup[]; counts: Record<AdminBadge, number>; onPick?: () => void }) {
  const { t } = useI18n();
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`));
  return (
    <nav aria-label={t("admin.title")} className="px-3 pb-4 pt-1">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="m-0 px-3.5 pb-2 pt-[18px] text-xs font-bold uppercase tracking-[0.09em] text-adm-soft">{t(g.label)}</p>
          <ul className="m-0 list-none space-y-0.5 p-0">
            {g.items.map((item) => {
              const n = item.badge ? counts[item.badge] : 0;
              const on = active(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onPick}
                    aria-current={on ? "page" : undefined}
                    className={cx(
                      "flex min-h-[42px] items-center gap-3 rounded-[12px] px-3.5 text-[15.5px] font-semibold transition-colors",
                      on ? "bg-tint text-primary" : "text-adm-strong hover:bg-adm-bg",
                    )}
                  >
                    <AdminIcon name={item.icon} className={on ? "text-primary" : "text-adm-soft"} />
                    <span className="min-w-0 flex-1 truncate">{t(item.label)}</span>
                    {n > 0 && <span className="min-w-6 rounded-[7px] bg-primary px-1.5 text-center text-[12.5px] font-bold tabular-nums text-white">{n}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  const { t } = useI18n();
  return (
    <Link href="/admin" className="flex h-[68px] shrink-0 items-center gap-2.5 border-b border-adm-line px-[22px]">
      <LogoMark className="size-7" />
      <span className="lc-d text-[19px] font-semibold tracking-[-0.03em] text-ink">logocontest.bd</span>
      <span className="ml-auto rounded-[6px] bg-[#f0f1f4] px-2 py-0.5 text-xs font-bold text-adm-strong">{t("admin.shell.brand")}</span>
    </Link>
  );
}

function Me({ me }: { me: AdminMe }) {
  const { t } = useI18n();
  return (
    <div className="mx-3 mb-3.5 flex items-center gap-3 rounded-[14px] bg-adm-bg p-3">
      <span className="lc-d flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-primary font-semibold text-white">{initial(me.name)}</span>
      <div className="flex min-w-0 flex-col leading-tight">
        <strong className="truncate text-[15px] font-bold text-ink">{me.name}</strong>
        <span className="truncate text-[13px] text-muted">{me.isSuper ? t("admin.shell.superAdmin") : me.title || t("admin.shell.staff")}</span>
      </div>
    </div>
  );
}

/** Admin layout (design/admin, owner 2026-10-10): white sidebar, top bar with search, activity and account menu. */
export function AdminShell({
  groups,
  counts,
  me,
  canSearch,
  canSeeActivity,
  children,
}: {
  groups: AdminNavGroup[];
  counts: Record<AdminBadge, number>;
  me: AdminMe;
  canSearch: boolean;
  canSeeActivity: boolean;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const readOnly = isReadOnlyPage({ role: "admin", status: "active", isSuperAdmin: me.isSuper, adminActive: true, adminPermissions: me.permissions }, path);
  const [shownFor, setShownFor] = useState(path);
  // Close the phone menu after moving to another page.
  if (shownFor !== path) {
    setShownFor(path);
    if (open) setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const hrefs = new Set(groups.flatMap((g) => g.items.map((i) => i.href)));

  return (
    <div className="flex min-h-screen bg-adm-bg text-[16px] text-ink">
      {/* Sidebar (below 980px the menu button opens it as a drawer) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-adm-line bg-surface min-[981px]:flex">
        <Brand />
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
          <NavList groups={groups} counts={counts} />
        </div>
        <Me me={me} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-[80] min-[981px]:hidden" role="dialog" aria-modal="true" aria-label={t("admin.shell.menu")}>
          <button type="button" className="absolute inset-0 bg-ink/45" aria-label={t("admin.shell.close")} onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-raised">
            {/* Room on the right for the close button */}
            <div className="pr-14">
              <Brand />
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("admin.shell.close")}
              className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-[12px] border border-adm-line bg-surface text-adm-strong"
            >
              <AdminIcon name="close" />
            </button>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <NavList groups={groups} counts={counts} onPick={() => setOpen(false)} />
            </div>
            <Me me={me} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-[68px] items-center gap-3 border-b border-adm-line bg-surface px-4 sm:px-7">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t("admin.shell.menu")}
            aria-expanded={open}
            className="flex size-11 shrink-0 items-center justify-center rounded-[12px] border border-adm-line bg-surface text-adm-strong min-[981px]:hidden"
          >
            <AdminIcon name="menu" />
          </button>
          {canSearch && (
            <form action="/admin/search" role="search" className="hidden h-11 max-w-[420px] flex-1 items-center gap-2.5 rounded-[12px] bg-adm-bg px-3.5 text-adm-soft min-[981px]:flex">
              <AdminIcon name="search" />
              <label htmlFor="admin-q" className="sr-only">
                {t("admin.shell.searchLabel")}
              </label>
              <input id="admin-q" name="q" type="search" placeholder={t("admin.shell.search")} className="h-10 min-w-0 flex-1 border-0 bg-transparent text-[15.5px] font-medium text-ink outline-none placeholder:text-adm-soft" />
            </form>
          )}
          <div className="ml-auto flex items-center gap-2">
            {canSearch && (
              <Link href="/admin/search" aria-label={t("admin.shell.searchLabel")} className="flex size-11 items-center justify-center rounded-[12px] border border-adm-line bg-surface text-adm-strong min-[981px]:hidden">
                <AdminIcon name="search" />
              </Link>
            )}
            <a href="/" target="_blank" rel="noopener" className="flex h-11 items-center gap-2 rounded-[12px] border border-adm-line px-3 text-[15px] font-bold text-ink hover:bg-adm-bg sm:px-4">
              <span className="max-sm:sr-only">{t("admin.shell.viewSite")}</span>
              <AdminIcon name="external" size={16} />
            </a>
            {canSeeActivity && <ActivityDrawer />}
            <AccountMenu
              me={me}
              initial={initial(me.name)}
              unread={hrefs.has("/admin/support") ? counts.support : 0}
              links={[
                { href: "/admin/support", label: t("admin.menu.messages"), icon: "messages" as const },
                { href: "/admin/activity", label: t("admin.nav.activity"), icon: "activity" as const },
                { href: "/admin/team", label: t("admin.nav.team"), icon: "team" as const },
                { href: "/admin/settings", label: t("admin.nav.settings"), icon: "settings" as const },
                { href: "/admin/audit", label: t("admin.nav.audit"), icon: "audit" as const },
              ].filter((l) => hrefs.has(l.href))}
            />
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-5 p-4 sm:p-7">
          {readOnly && <p className="m-0 rounded-[12px] bg-adm-sample-bg px-4 py-2.5 text-[15px] font-medium text-adm-sample">{t("admin.shell.viewOnly")}</p>}
          <ReadOnlyProvider value={readOnly}>{children}</ReadOnlyProvider>
        </main>
      </div>
    </div>
  );
}
