import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { getSetting } from "@/lib/settings";
import { whatsappLink } from "@/lib/site";
import { WhatsAppButton } from "./whatsapp-button";

/** The team's WhatsApp for everyone, visitors too (owner, 2026-11-02); raised above the support chat button (SupportSlot). */
export async function WhatsAppSlot() {
  const [user, number, { t }] = await Promise.all([getCurrentUser(), getSetting("contact.whatsapp").catch(() => ""), getI18n()]);
  if (!number || user?.role === "admin") return null;
  const chat = Boolean(user && (user.role === "client" || user.role === "designer") && user.status !== "banned");
  return <WhatsAppButton href={whatsappLink(number, t("support.whatsappGreeting"))} raised={chat} />;
}
