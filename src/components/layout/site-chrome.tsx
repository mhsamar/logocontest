"use client";

import { usePathname } from "next/navigation";

/**
 * Public header, footer and bars. The admin panel has its own top bar and sidebar instead
 * (BLUEPRINT §13.2 item 1), so these stay out of /admin. `hideOnHome`: the guest home page
 * brings its own nav and footer (owner, 2026-10-10 design), so the site ones step aside there.
 */
export function SiteChrome({ children, hideOnHome = false }: { children: React.ReactNode; hideOnHome?: boolean }) {
  const path = usePathname();
  if (path === "/admin" || path.startsWith("/admin/")) return null;
  if (hideOnHome && path === "/") return null;
  return <>{children}</>;
}
