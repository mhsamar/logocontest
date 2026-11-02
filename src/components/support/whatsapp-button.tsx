"use client";

import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { cx } from "@/lib/cx";

/** The WhatsApp glyph (also on the prize step of the new wizard). */
export const WhatsAppIcon = ({ className = "size-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.2-.7-2.7-1.1-4.4-3.8-4.6-4-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.6 2 1.1 1 2 1.3 2.3 1.4.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3Z" />
  </svg>
);

/**
 * WhatsApp support on every page (owner, 2026-11-02: "whatsapp er massage always site e rakhba as support"): a green
 * round button in the corner, above the support chat button when that one shows. Not on the new contest wizard, which
 * has its own WhatsApp button on the prize step and the team's help card on the others.
 */
export function WhatsAppButton({ href, raised }: { href: string; raised: boolean }) {
  const { t } = useI18n();
  const path = usePathname();
  if (path === "/start-v2" || path.startsWith("/start-v2/")) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("support.whatsapp")}
      title={t("support.whatsapp")}
      className={cx(
        "fixed right-4 z-40 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-raised transition-transform hover:scale-105 print:hidden",
        raised ? "bottom-[5.5rem]" : "bottom-[max(1rem,env(safe-area-inset-bottom))]",
      )}
    >
      <WhatsAppIcon className="size-7" />
    </a>
  );
}
