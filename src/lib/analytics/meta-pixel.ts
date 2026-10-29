/**
 * Meta Pixel events (owner, 2026-10-24). The base code in the root layout defines window.fbq on the live site; these
 * calls send the conversion events once per action, only after it really happened. Call them from effects or from the
 * success branch of an action, never while rendering. Nothing here throws, and nothing personal is sent.
 */
// ViewContent and AddPaymentInfo: onboarding v2's prize step and bKash ID sent (owner, 2026-10-28).
export type PixelEvent = "InitiateCheckout" | "CompleteRegistration" | "Purchase" | "Lead" | "ViewContent" | "AddPaymentInfo";
export type PixelParams = { value?: number; currency?: "BDT" };

type Fbq = (cmd: "track", event: PixelEvent, params?: PixelParams, options?: { eventID?: string }) => void;
declare global {
  interface Window {
    fbq?: Fbq;
    /** For Google Analytics 4 later (owner, 2026-10-28): the same events, pushed whether or not the pixel loaded. */
    dataLayer?: Record<string, unknown>[];
  }
}

const PREFIX = "lc-px:";

/**
 * Pages that never get the pixel (owner, 2026-10-24): Admin (its search addresses hold customers' emails and mobile
 * numbers) and the signed unsubscribe link (its address holds the account ID and a working signature). The proxy marks
 * these requests with this header and the root layout leaves the base code out.
 */
export const NO_PIXEL_HEADER = "x-lc-no-pixel";
export const noPixelPath = (path: string) => /^\/(admin|admin-login|admin-signed-out|r)(\/|$)|^\/email\/unsubscribe(\/|$)/.test(path);
/**
 * A contest payment counts as a new Purchase for this long after it was paid: the client usually sees it live at once
 * (card) or soon after an admin approves it (bKash). Older payments never fire, so clients who paid before the pixel
 * was added don't count, and a second device rarely repeats it.
 */
const PURCHASE_FRESH_MS = 48 * 3_600_000;

/** True while a paid contest payment may still send its Purchase event. */
export function freshPurchase(paidAt: Date | null, now = new Date()): boolean {
  return !!paidAt && now.getTime() - paidAt.getTime() < PURCHASE_FRESH_MS;
}

// This page load: re-renders and React's development double effects.
const sent = new Set<string>();

/** True when `key` was already sent or marked in this browser. */
export function pixelDone(key: string): boolean {
  if (sent.has(key)) return true;
  try {
    return Boolean(localStorage.getItem(PREFIX + key));
  } catch {
    return false;
  }
}

const START = "lc-px-start";
/** One id per contest start in this tab, so each new contest counts once (InitiateCheckout). */
export function pixelStartId(): string {
  try {
    let id = sessionStorage.getItem(START);
    if (!id) sessionStorage.setItem(START, (id = crypto.randomUUID()));
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
/** The started contest was paid: the next start in this tab is a new one. */
export function endPixelStart(): void {
  try {
    sessionStorage.removeItem(START);
  } catch {
    // ignore
  }
}

/** Marks `key` as done without sending anything (a resumed draft is not a new "start"). */
export function markPixel(key: string): void {
  sent.add(key);
  try {
    localStorage.setItem(PREFIX + key, String(Date.now()));
  } catch {
    // Private mode: the page-load guard is enough.
  }
}

/**
 * Sends `event` once per `key` in this browser: reloads, Back/Forward and other tabs skip it. The key also goes to Meta
 * as the event ID, so it must never hold personal data.
 */
export function trackPixel(key: string, event: PixelEvent, params?: PixelParams): void {
  if (typeof window === "undefined") return;
  pushDataLayer(key, event, params);
  if (typeof window.fbq !== "function" || sent.has(key)) return;
  sent.add(key);
  try {
    if (localStorage.getItem(PREFIX + key)) return;
    localStorage.setItem(PREFIX + key, String(Date.now()));
  } catch {
    // Private mode: the page-load guard is enough.
  }
  try {
    window.fbq("track", event, params ?? {}, { eventID: key });
  } catch {
    // Tracking never gets in the way of the site.
  }
}

const pushed = new Set<string>();
const DL_PREFIX = "lc-dl:";

/** The event for window.dataLayer, once per key in this browser like the pixel; nothing personal. */
function pushDataLayer(key: string, event: PixelEvent, params?: PixelParams): void {
  if (pushed.has(key)) return;
  pushed.add(key);
  try {
    if (localStorage.getItem(DL_PREFIX + key)) return;
    localStorage.setItem(DL_PREFIX + key, String(Date.now()));
  } catch {
    // Private mode: the page-load guard is enough.
  }
  try {
    (window.dataLayer ??= []).push({ event, event_id: key, ...(params ?? {}) });
  } catch {
    // Tracking never gets in the way of the site.
  }
}
