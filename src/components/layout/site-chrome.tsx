"use client";

import { usePathname } from "next/navigation";

/**
 * Public header, footer and bars. The admin panel has its own top bar and sidebar instead
 * (BLUEPRINT §13.2 item 1), so these stay out of /admin.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return path === "/admin" || path.startsWith("/admin/") ? null : <>{children}</>;
}
