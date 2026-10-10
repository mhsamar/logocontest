"use client";

import { usePathname } from "next/navigation";

/**
 * Public header, footer and bars. The admin panel has its own top bar and sidebar instead
 * (BLUEPRINT §13.2 item 1), so these stay out of /admin. `hideOnHome`: the guest home page
 * brings its own nav and footer (owner, 2026-10-10 design), so the site ones step aside there.
 */
/** The admin sign-in and signed-out pages are full-screen pages of their own (owner, 2026-10-10). */
const ADMIN_DOORS = ["/admin-login", "/admin-signed-out"];

export function SiteChrome({ children, hideOnHome = false }: { children: React.ReactNode; hideOnHome?: boolean }) {
  const path = usePathname();
  if (path === "/admin" || path.startsWith("/admin/") || ADMIN_DOORS.includes(path)) return null;
  if (hideOnHome && path === "/") return null;
  return <>{children}</>;
}
