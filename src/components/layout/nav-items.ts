import type { MessageKey } from "@/lib/i18n/translate";

// Header (UI-JOURNEY §2.1, owner 2026-10-08): Browse Contests | Design Studio | How It Works | Help.
export const GUEST_NAV: { href: string; label: MessageKey }[] = [
  { href: "/contests", label: "nav.browse" },
  { href: "/design-studio", label: "nav.studio" },
  { href: "/how-it-works", label: "nav.how" },
  { href: "/help", label: "nav.help" },
];

// Footer (BLUEPRINT §14): Terms, Privacy, Payment & No-Refund Policy, Designer Rules, Contact.
export const LEGAL_NAV: { href: string; label: MessageKey }[] = [
  { href: "/legal/terms", label: "footer.terms" },
  { href: "/legal/privacy", label: "footer.privacy" },
  { href: "/legal/payment-refund", label: "footer.refund" },
  { href: "/legal/designer-rules", label: "footer.designerRules" },
];
