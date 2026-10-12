/**
 * Visitor welcome pop-up rules (owner, 2026-10-13; Design/visitor-popup/VISITOR-POPUP-HANDOFF.md). Pure, so the
 * browser, the server and the tests share them. Only first-party storage on this browser: no personal data.
 */

export const POPUP_EVENTS = ["popup_shown", "popup_click_client", "popup_click_designer", "popup_closed", "popup_never"] as const;
export type PopupEvent = (typeof POPUP_EVENTS)[number];
export const isPopupEvent = (v: unknown): v is PopupEvent => typeof v === "string" && (POPUP_EVENTS as readonly string[]).includes(v);

/** localStorage: the snooze / never choice, the "has an account" flag and the anonymous pop-up visitor id. */
export const STORE_KEY = "lc_pop";
export const ACCOUNT_KEY = "lc_has_account";
export const VISITOR_KEY = "lc_pop_vid";
/** sessionStorage (this visit): active seconds so far, and whether the pop-up was already shown. */
export const ACTIVE_KEY = "lc_pop_active";
export const SHOWN_KEY = "lc_pop_shown";
/** First-party cookie for this visit only: the sign-up started from a pop-up button. */
export const SOURCE_COOKIE = "lc_src";
export const SOURCE_POPUP = "popup";

export type PopupStore = { never?: boolean; until?: number };

/**
 * Pages where the pop-up never opens: sign-up, login, password reset, email checks, the contest wizard and its
 * checkout, every signed-in area, admin and the developer pages. It also stays off the legal pages and certificate
 * checks, where people come to read one thing.
 */
const BLOCKED = [
  "/login",
  "/designers/signup",
  "/start",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/verify",
  "/auth",
  "/admin",
  "/admin-login",
  "/admin-signed-out",
  "/dashboard",
  "/my-contests",
  "/notifications",
  "/support",
  "/dev",
  "/styleguide",
  "/legal",
  "/api",
];
export function popupAllowedOn(path: string): boolean {
  if (/^\/contest\/[^/]+\/submit(\/|$)/.test(path)) return false;
  return !BLOCKED.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Read the stored choice; anything broken counts as nothing stored. */
export function parseStore(raw: string | null): PopupStore {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return {};
    const o = v as Record<string, unknown>;
    return { never: o.never === true || undefined, until: typeof o.until === "number" && Number.isFinite(o.until) ? o.until : undefined };
  } catch {
    return {};
  }
}

/** Is the pop-up blocked on this browser right now (never again, or still snoozed)? */
export const blockedByStore = (s: PopupStore, now: number) => s.never === true || (s.until !== undefined && s.until > now);

/** The choice after a close or a button click: hidden for `days`, or for good when "Don't show this again" is ticked. */
export const storeAfter = (never: boolean, days: number, now: number): PopupStore => (never ? { never: true } : { until: now + days * 86_400_000 });

/** Everything that must be true before the pop-up opens. */
export function shouldOpen(o: {
  enabled: boolean;
  signedIn: boolean;
  hasAccount: boolean;
  path: string;
  store: PopupStore;
  shownThisVisit: boolean;
  activeSeconds: number;
  needSeconds: number;
  scrolled: boolean;
  now: number;
}): boolean {
  return (
    o.enabled &&
    !o.signedIn &&
    !o.hasAccount &&
    popupAllowedOn(o.path) &&
    !blockedByStore(o.store, o.now) &&
    !o.shownThisVisit &&
    o.activeSeconds >= o.needSeconds &&
    o.scrolled
  );
}

/** Adds ?src=popup to a sign-up link. */
export const withPopupSource = (href: string) => `${href}${href.includes("?") ? "&" : "?"}src=${SOURCE_POPUP}`;
