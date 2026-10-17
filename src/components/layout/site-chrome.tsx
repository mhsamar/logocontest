"use client";

import { usePathname } from "next/navigation";
import { inClientArea } from "@/lib/client/rules";

/**
 * Public header, footer and bars. The admin panel has its own top bar and sidebar instead
 * (BLUEPRINT §13.2 item 1), so these stay out of /admin. `hideOnHome`: the guest home page
 * brings its own nav and footer (owner, 2026-10-10 design), so the site ones step aside there.
 */
/** The admin sign-in and signed-out pages are full-screen pages of their own (owner, 2026-10-10). */
const ADMIN_DOORS = ["/admin-login", "/admin-signed-out"];

/** The premium client workspace (owner, 2026-10-16) has its own top bar (logo and photo only) and no site footer. */
export const isClientWorkspace = (path: string) => path === "/client" || path.startsWith("/client/");

export function SiteChrome({ children, hideOnHome = false, hideOnClient = false, client = false }: { children: React.ReactNode; hideOnHome?: boolean; hideOnClient?: boolean; /** The visitor is a signed-in client. */ client?: boolean }) {
  const path = usePathname();
  if (path === "/admin" || path.startsWith("/admin/") || ADMIN_DOORS.includes(path)) return null;
  if (hideOnHome && path === "/") return null;
  // The workspace brings its own top bar; a signed-in client also gets it on Start a contest, payments and the
  // other pages in inClientArea (owner, 2026-10-17), so the site's menu and footer are never drawn there first.
  if (hideOnClient && (isClientWorkspace(path) || (client && inClientArea(path)))) return null;
  return <>{children}</>;
}
