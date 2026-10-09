/**
 * Editable lists (BLUEPRINT §13.1 item 2, A-15). Shared by the admin editor (browser) and the server.
 * Built-in items point at message keys, so until a list is edited they follow the Texts editor too.
 */
import { BUSINESS_TYPES } from "@/lib/contests/brief";

export const LIST_KEYS = ["home_faq", "header_menu", "footer_links", "business_types", "colours"] as const;
export type ListKey = (typeof LIST_KEYS)[number];
export const isListKey = (v: string): v is ListKey => (LIST_KEYS as readonly string[]).includes(v);

export const FOOTER_COLUMNS = ["clients", "designers", "legal"] as const;
export type FooterColumn = (typeof FOOTER_COLUMNS)[number];

export type ListText = Record<string, string>;
export type ListItem = { id: string; on: boolean; en: ListText; bn: ListText; href?: string; column?: FooterColumn; value?: string };

type Field = { name: string; max: number; long?: boolean };
type BuiltIn = { id: string; keys?: Record<string, string>; href?: string; column?: FooterColumn; value?: string };

export type ListDef = {
  fields: Field[];
  href?: true;
  column?: true;
  colour?: true;
  /** Admins can add and delete items (business types can only be hidden and moved). */
  canAdd: boolean;
  max: number;
  builtIn: BuiltIn[];
};

const faq = Array.from({ length: 10 }, (_, i) => ({ id: `q${i + 1}`, keys: { q: `home.faq.q${i + 1}.q`, a: `home.faq.q${i + 1}.a` } }));
const link = (id: string, href: string, key: string, column?: FooterColumn): BuiltIn => ({ id, href, keys: { label: key }, column });

export const LISTS: Record<ListKey, ListDef> = {
  home_faq: { fields: [{ name: "q", max: 200 }, { name: "a", max: 1500, long: true }], canAdd: true, max: 30, builtIn: faq },
  header_menu: {
    fields: [{ name: "label", max: 40 }],
    href: true,
    canAdd: true,
    max: 6,
    builtIn: [link("browse", "/contests", "nav.browse"), link("studio", "/design-studio", "nav.studio"), link("how", "/how-it-works", "nav.how"), link("help", "/help", "nav.help")],
  },
  footer_links: {
    fields: [{ name: "label", max: 60 }],
    href: true,
    column: true,
    canAdd: true,
    max: 30,
    builtIn: [
      link("c-start", "/start", "footer.startContest", "clients"),
      link("c-browse", "/contests", "nav.browse", "clients"),
      link("c-studio", "/design-studio", "nav.studio", "clients"),
      link("c-winners", "/winners", "footer.winners", "clients"),
      link("c-how", "/how-it-works", "nav.how", "clients"),
      link("c-help", "/help", "nav.help", "clients"),
      link("d-join", "/designers/signup", "nav.becomeDesigner", "designers"),
      link("d-how", "/how-it-works?for=designers", "footer.howDesigners", "designers"),
      link("d-leaderboard", "/leaderboard", "footer.leaderboard", "designers"),
      link("d-login", "/login?as=designer", "nav.login", "designers"),
      link("l-terms", "/legal/terms", "footer.terms", "legal"),
      link("l-privacy", "/legal/privacy", "footer.privacy", "legal"),
      link("l-refund", "/legal/payment-refund", "footer.refund", "legal"),
      link("l-rules", "/legal/designer-rules", "footer.designerRules", "legal"),
    ],
  },
  business_types: {
    fields: [],
    canAdd: false,
    max: BUSINESS_TYPES.length,
    builtIn: BUSINESS_TYPES.map((id) => ({ id, keys: { label: `wizard.businessTypes.${id}` } })),
  },
  colours: {
    fields: [],
    colour: true,
    canAdd: true,
    max: 16,
    builtIn: ["#0f766e", "#1d4ed8", "#dc2626", "#f59e0b", "#16a34a", "#7c3aed", "#db2777", "#111827", "#ffffff", "#a16207"].map((value, i) => ({ id: `c${i + 1}`, value })),
  },
};

/** A link an admin may use: a page on this site ("/contests") or an https link. */
export const isSafeLink = (v: string) => v.length <= 300 && (/^\/(?!\/)[^\s]*$/.test(v) || /^https:\/\/[^\s]+$/.test(v));
export const isHexColour = (v: string) => /^#[0-9a-f]{6}$/i.test(v);
export const newItemId = () => `n${Math.random().toString(36).slice(2, 10)}`;
