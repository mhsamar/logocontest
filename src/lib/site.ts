/** Support line on the Help page, How It Works, the home trust bar and the footer. */
export const SUPPORT_PHONE = "01712028511";
export const SUPPORT_PHONE_HREF = "tel:+8801712028511";

/** WhatsApp click-to-chat link for a Bangladesh mobile number, with an optional greeting filled in. */
export function whatsappLink(mobile: string, text?: string): string {
  const intl = `880${mobile.replace(/\D/g, "").replace(/^0/, "")}`;
  return `https://wa.me/${intl}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Messenger link for a Facebook page link, or null when it can't be made (empty, group or not a page). */
export function messengerLink(facebookUrl: string): string | null {
  if (!facebookUrl) return null;
  try {
    const u = new URL(facebookUrl);
    const [first] = u.pathname.split("/").filter(Boolean);
    if (first === "profile.php") {
      const id = u.searchParams.get("id");
      return id && /^\d+$/.test(id) ? `https://m.me/${id}` : null;
    }
    if (!first || ["groups", "pages", "people", "share", "events"].includes(first)) return null;
    return /^[A-Za-z0-9.\-]+$/.test(first) ? `https://m.me/${first}` : null;
  } catch {
    return null;
  }
}

export type LiveChatConfig = { driver: "none" } | { driver: "tawk"; src: string };

/** Live chat on the Help page (BLUEPRINT live chat): Tawk.to only when switched on and both IDs are set. */
export function liveChatConfig(s: { driver: string; tawkPropertyId: string; tawkWidgetId: string }): LiveChatConfig {
  if (s.driver !== "tawk" || !/^[a-f0-9]{24}$/.test(s.tawkPropertyId) || !/^[a-z0-9]{6,32}$/.test(s.tawkWidgetId)) return { driver: "none" };
  return { driver: "tawk", src: `https://embed.tawk.to/${s.tawkPropertyId}/${s.tawkWidgetId}` };
}
