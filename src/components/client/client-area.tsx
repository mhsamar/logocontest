import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { upsellFor } from "@/lib/client/upsell";
import { ClientShell } from "./shell";
import { UpsellPopup } from "./upsell-popup";

/**
 * The client workspace as a layout (owner, 2026-10-17: "keep the menu on the right side for a logged-in client" and
 * "the menu takes time to come"). A signed-in client sees every page under it with the top bar and the right-side
 * menu, which stay on screen while the pages change; visitors, designers and admins get the page as it is.
 */
export async function ClientArea({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (user?.role !== "client") return <>{children}</>;
  // Once a day, the add-ons for a live contest or more time on its last day (owner, 2026-11-02).
  const upsell = await upsellFor(user.id);
  return (
    <ClientShell user={user}>
      {children}
      {upsell && <UpsellPopup upsell={upsell} />}
    </ClientShell>
  );
}
