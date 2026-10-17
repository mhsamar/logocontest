import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { ClientShell } from "./shell";

/**
 * The client workspace as a layout (owner, 2026-10-17: "keep the menu on the right side for a logged-in client" and
 * "the menu takes time to come"). A signed-in client sees every page under it with the top bar and the right-side
 * menu, which stay on screen while the pages change; visitors, designers and admins get the page as it is.
 */
export async function ClientArea({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  return user?.role === "client" ? <ClientShell user={user}>{children}</ClientShell> : <>{children}</>;
}
