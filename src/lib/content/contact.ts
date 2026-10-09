import "server-only";
import type { Locale } from "@/lib/i18n/config";
import { getSettings } from "@/lib/settings";

export type Contact = { phone: string; phoneHref: string; email: string; address: string };

/** Support phone, email and office address from Brand & notice (BLUEPRINT §13.1). Empty ones are hidden. */
export async function getContact(locale: Locale): Promise<Contact> {
  const s = await getSettings(["contact.phone", "contact.email", "contact.address_en", "contact.address_bn"]);
  const phone = s["contact.phone"];
  return {
    phone,
    phoneHref: `tel:+88${phone}`,
    email: s["contact.email"],
    address: (locale === "bn" && s["contact.address_bn"]) || s["contact.address_en"],
  };
}
