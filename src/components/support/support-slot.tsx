import { getCurrentUser } from "@/lib/auth/session";
import { myUnread } from "@/lib/support/queries";
import { SupportWidget } from "./support-widget";

/** Shows the support chat button to signed-in clients and designers only (BLUEPRINT §13.2 item 5). */
export async function SupportSlot() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "client" && user.role !== "designer") || user.status === "banned") return null;
  return <SupportWidget unread={await myUnread(user.id)} />;
}
