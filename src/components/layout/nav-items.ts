import type { MessageKey } from "@/lib/i18n/translate";

// Guest header (UI-JOURNEY §2.1): Browse Contests | How It Works | Call | Log In.
export const GUEST_NAV: { href: string; label: MessageKey }[] = [
  { href: "/contests", label: "nav.browse" },
  { href: "/how-it-works", label: "nav.how" },
];

// Footer (BLUEPRINT §14): Terms, Privacy, Payment & No-Refund Policy, Designer Rules, Contact.
export const LEGAL_NAV: { href: string; label: MessageKey }[] = [
  { href: "/legal/terms", label: "footer.terms" },
  { href: "/legal/privacy", label: "footer.privacy" },
  { href: "/legal/payment-refund", label: "footer.refund" },
  { href: "/legal/designer-rules", label: "footer.designerRules" },
];
