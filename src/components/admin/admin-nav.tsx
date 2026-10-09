"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/ui/logo";
import { logout } from "@/lib/auth/actions";
import { isReadOnlyPage, type AdminBadge, type AdminNavGroup } from "@/lib/admin/nav";
import { ReadOnlyProvider } from "./read-only";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";

type Me = { name: string; title: string | null; isSuper: boolean; permissions: string[] };

function NavList({ groups, counts, onPick }: { groups: AdminNavGroup[]; counts: Record<AdminBadge, number>; onPick?: () => void }) {
  const { t } = useI18n();
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`));
  return (
    <nav aria-label={t("admin.title")} className="space-y-5">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="px-3 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-muted">{t(g.label)}</p>
          <ul className="mt-1.5 space-y-0.5">
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
                      "flex min-h-10 items-center justify-between gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                      on ? "bg-ink text-white" : "text-ink hover:bg-canvas",
                    )}
                  >
                    {t(item.label)}
                    {n > 0 && <span className={cx("rounded-full px-2 text-xs font-bold tabular-nums", on ? "bg-white/20" : "bg-primary text-white")}>{n}</span>}
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

/** A-18 Admin shell: its own top bar and grouped sidebar; a drawer on phones. */
export function AdminShell({ groups, counts, me, children }: { groups: AdminNavGroup[]; counts: Record<AdminBadge, number>; me: Me; children: React.ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const readOnly = isReadOnlyPage({ role: "admin", status: "active", isSuperAdmin: me.isSuper, adminActive: true, adminPermissions: me.permissions }, path);
  const [shownFor, setShownFor] = useState(path);
  // Close the drawer after moving to another page.
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

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f6f8]">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 bg-ink px-3 text-white sm:px-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("admin.shell.menu")}
          aria-expanded={open}
          className="flex size-10 items-center justify-center rounded-full hover:bg-white/10 lg:hidden"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <Link href="/admin" className="flex items-center gap-2 font-bold">
          <LogoMark inverted className="size-7" />
          <span>{t("admin.shell.brand")}</span>
        </Link>
        <span className="hidden rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold sm:inline">{me.isSuper ? t("admin.shell.superAdmin") : me.title || t("admin.shell.staff")}</span>
        <div className="ml-auto flex items-center gap-1">
          <a href="/" target="_blank" rel="noopener" className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold hover:bg-white/10">
            {t("admin.shell.viewSite")}
            <span aria-hidden>↗</span>
          </a>
          <details className="relative">
            <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-full bg-white/15 text-sm font-bold [&::-webkit-details-marker]:hidden" aria-label={t("nav.account")}>
              {me.name.slice(0, 1).toUpperCase()}
            </summary>
            <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-surface p-2 text-ink shadow-raised ring-1 ring-line">
              <p className="truncate px-3 py-2 text-sm font-semibold">{me.name}</p>
              <form action={logout}>
                <button type="submit" className="flex min-h-10 w-full items-center rounded-xl px-3 text-left text-sm text-danger hover:bg-canvas">
                  {t("nav.logout")}
                </button>
              </form>
            </div>
          </details>
        </div>
      </header>

      <div className="flex-1 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-line bg-surface lg:block">
          <div className="sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto px-3 py-5">
            <NavList groups={groups} counts={counts} />
          </div>
        </aside>

        {open && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t("admin.shell.menu")}>
            <button type="button" className="absolute inset-0 bg-ink/40" aria-label={t("admin.shell.close")} onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-surface px-3 py-4 shadow-raised">
              <div className="mb-4 flex items-center justify-between px-2">
                <span className="font-bold text-ink">{t("admin.shell.brand")}</span>
                <button type="button" onClick={() => setOpen(false)} aria-label={t("admin.shell.close")} className="flex size-10 items-center justify-center rounded-full text-xl hover:bg-canvas">
                  ×
                </button>
              </div>
              <NavList groups={groups} counts={counts} onPick={() => setOpen(false)} />
            </div>
          </div>
        )}

        <div className="min-w-0 px-4 pb-16 pt-5 lg:px-8">
          {readOnly && <p className="mb-4 rounded-xl bg-[#fff7e0] px-4 py-2 text-sm text-[#7a5300] ring-1 ring-[#f1dfa6]">{t("admin.shell.viewOnly")}</p>}
          <ReadOnlyProvider value={readOnly}>{children}</ReadOnlyProvider>
        </div>
      </div>
    </div>
  );
}
