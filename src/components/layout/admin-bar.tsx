"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";

/** The admin page for the public page being looked at, when there is one. */
function adminPageFor(path: string): { href: string; key: "contest" | "person" } | null {
  const contest = path.match(/^\/contest\/([^/]+)/);
  if (contest) return { href: `/admin/contests/${contest[1]}`, key: "contest" };
  const person = path.match(/^\/[dc]\/([^/]+)/);
  if (person) return { href: `/admin/search?q=${encodeURIComponent(person[1])}`, key: "person" };
  return null;
}

/**
 * Shown to admins on the public site (owner, 2026-10-10): who they are browsing as, the way back to the
 * admin panel, and a shortcut to this page's admin page. Sits in the top bars, above the floating nav.
 */
export function AdminBar({ role }: { role: string }) {
  const { t } = useI18n();
  const path = usePathname();
  const here = adminPageFor(path);
  return (
    <div className="bg-ink text-white">
      <div className="mx-auto flex min-h-11 max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <span className="size-2 shrink-0 rounded-full bg-gold" aria-hidden />
          <span className="truncate max-sm:text-[13px]">{t("adminBar.viewing", { role })}</span>
        </span>
        <span className="ml-auto flex items-center gap-2">
          {here && (
            <Link href={here.href} className="inline-flex min-h-9 items-center rounded-[10px] px-3 font-bold text-white/85 hover:bg-white/10 hover:text-white max-sm:hidden">
              {t(`adminBar.here.${here.key}`)}
            </Link>
          )}
          <Link href="/admin" className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-primary px-3.5 font-bold text-white hover:bg-primary-hi">
            <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
            {t("adminBar.back")}
          </Link>
        </span>
      </div>
    </div>
  );
}
