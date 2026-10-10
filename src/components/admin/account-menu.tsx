"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { adminLogout } from "@/lib/auth/actions";
import { useI18n } from "@/lib/i18n/client";
import { formatNumber } from "@/lib/money";
import type { AdminMe } from "./admin-nav";
import { AdminIcon, type AdminIconName } from "./icons";

/** The avatar menu, top right (design/admin/shell-account-menu-open.html): who you are, shortcuts, sign out. */
export function AccountMenu({ me, initial, unread, links }: { me: AdminMe; initial: string; unread: number; links: { href: string; label: string; icon: AdminIconName }[] }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("admin.shell.account")}
        aria-expanded={open}
        aria-haspopup="menu"
        className="lc-d flex size-11 items-center justify-center rounded-[12px] bg-primary text-base font-semibold text-white transition-colors hover:bg-adm-deep"
      >
        {initial}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-[60] w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-[16px] border border-adm-line bg-surface text-ink shadow-[0_18px_48px_rgb(17_18_22/0.16)]">
          <div className="flex items-center gap-3 p-4">
            <span className="lc-d flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-primary text-[17px] font-semibold text-white">{initial}</span>
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <strong className="truncate text-[16.5px] font-bold">{me.name}</strong>
              <span className="truncate text-sm text-muted">{me.isSuper ? t("admin.shell.superAdmin") : me.title || t("admin.shell.staff")}</span>
            </div>
            {unread > 0 && (
              <span className="whitespace-nowrap rounded-full bg-tint px-[9px] py-0.5 text-[12.5px] font-bold text-primary">{t("admin.shell.newCount", { n: formatNumber(unread, locale) })}</span>
            )}
          </div>
          {links.length > 0 && (
            <div className="grid grid-cols-3 border-y border-adm-line-soft text-[14.5px] font-semibold">
              {links.map((l, i) => (
                <Link
                  key={l.href}
                  href={l.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={[
                    "flex min-h-11 flex-col items-center justify-center gap-2 px-1.5 py-[18px] text-center text-adm-strong hover:bg-adm-bg",
                    i % 3 !== 2 ? "border-r border-dashed border-r-[#e3e4e8]" : "",
                    i < links.length - (links.length % 3 || 3) ? "border-b border-dashed border-b-[#e3e4e8]" : "",
                  ].join(" ")}
                >
                  <AdminIcon name={l.icon} size={20} className="text-adm-soft" />
                  {l.label}
                </Link>
              ))}
            </div>
          )}
          <form action={adminLogout} className="flex justify-end px-4 py-3.5">
            <button type="submit" role="menuitem" className="inline-flex h-11 items-center gap-2 rounded-[12px] bg-tint px-[18px] text-[15px] font-bold text-primary hover:bg-[#f6dad8]">
              <AdminIcon name="logout" size={16} />
              {t("nav.logout")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
