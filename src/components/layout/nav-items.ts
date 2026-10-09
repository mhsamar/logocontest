import type { MessageKey } from "@/lib/i18n/translate";

// Legal pages, for the "other pages" links on each legal page (the footer uses the Footer links list, A-15).
export const LEGAL_NAV: { href: string; label: MessageKey }[] = [
  { href: "/legal/terms", label: "footer.terms" },
  { href: "/legal/privacy", label: "footer.privacy" },
  { href: "/legal/payment-refund", label: "footer.refund" },
  { href: "/legal/designer-rules", label: "footer.designerRules" },
];
