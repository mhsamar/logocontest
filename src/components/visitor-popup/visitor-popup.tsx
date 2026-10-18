"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n/client";
import {
  ACCOUNT_KEY,
  ACTIVE_KEY,
  parseStore,
  shouldOpen,
  SHOWN_KEY,
  SOURCE_COOKIE,
  SOURCE_POPUP,
  STORE_KEY,
  storeAfter,
  VISITOR_KEY,
  withPopupSource,
  type PopupEvent,
} from "@/lib/visitor-popup/rules";
import "./visitor-popup.css";

export type PopupConfig = { enabled: boolean; seconds: number; snoozeDays: number; smartphone: boolean; giftBox: boolean };

// Storage can be missing or blocked (private mode, settings): the pop-up then simply never opens.
const get = (s: Storage | undefined, k: string) => {
  try {
    return s?.getItem(k) ?? null;
  } catch {
    return null;
  }
};
const put = (s: Storage | undefined, k: string, v: string) => {
  try {
    s?.setItem(k, v);
  } catch {
    // ignore
  }
};
const local = () => (typeof window === "undefined" ? undefined : window.localStorage);
const session = () => (typeof window === "undefined" ? undefined : window.sessionStorage);

function visitorId(): string | null {
  const have = get(local(), VISITOR_KEY);
  if (have) return have;
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : null;
  if (id) put(local(), VISITOR_KEY, id);
  return id;
}

function send(event: PopupEvent) {
  const vid = visitorId();
  if (!vid) return;
  try {
    void fetch("/api/popup-event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, vid }), keepalive: true, credentials: "same-origin" }).catch(() => {});
  } catch {
    // Counting must never get in the way.
  }
}

/** This visit only (no expiry): the sign-up that follows started from the pop-up. */
function markSource() {
  try {
    document.cookie = `${SOURCE_COOKIE}=${SOURCE_POPUP}; path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  } catch {
    // ignore
  }
}

const Tick = () => (
  <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
const Arrow = () => (
  <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
// The site's own neutral example logos (public/logo-checker), never real clients' logos.
const Sample = ({ n }: { n: number }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={`/logo-checker/sample-${String(n).padStart(2, "0")}.svg`} alt="" />
);

/**
 * Visitor welcome pop-up (owner, 2026-10-13; Design/visitor-popup/visitor-popup.html). Only for new visitors: not
 * signed in and no account on this browser. It opens once per visit, after the visitor has spent the set seconds on
 * the site (across pages, only while the tab is visible) and has scrolled, and never on sign-up, login, password,
 * checkout or signed-in pages. Closing (✕, Esc, backdrop, "Just browsing") or a button hides it for the set days;
 * "Don't show this again" hides it for good. The offer ticks only show while those offers run.
 */
export function VisitorPopup({ config, signedIn }: { config: PopupConfig; signedIn: boolean }) {
  const { t } = useI18n();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [never, setNever] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const before = useRef<HTMLElement | null>(null);
  const scrolled = useRef(false);

  // A signed-in person has an account on this browser: the pop-up never opens here again.
  useEffect(() => {
    if (signedIn) put(local(), ACCOUNT_KEY, "1");
  }, [signedIn]);

  // A sign-up link opened with ?src=popup also counts (the cookie lasts for this visit).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("src") === SOURCE_POPUP) markSource();
  }, [path]);

  // Active time across pages (sessionStorage), the scroll on this page, then open once.
  useEffect(() => {
    // Time counts on every page of the visit; the pop-up itself only opens where it is allowed (shouldOpen).
    if (!config.enabled || signedIn) return;
    scrolled.current = window.scrollY > 40;
    const onScroll = () => {
      if (window.scrollY > 40) scrolled.current = true;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const tick = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const active = (Number(get(session(), ACTIVE_KEY)) || 0) + 1;
      put(session(), ACTIVE_KEY, String(active));
      const ok = shouldOpen({
        enabled: config.enabled,
        signedIn,
        hasAccount: get(local(), ACCOUNT_KEY) === "1",
        path,
        store: parseStore(get(local(), STORE_KEY)),
        shownThisVisit: get(session(), SHOWN_KEY) === "1",
        activeSeconds: active,
        needSeconds: config.seconds,
        scrolled: scrolled.current,
        now: Date.now(),
      });
      if (!ok) return;
      put(session(), SHOWN_KEY, "1");
      before.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setNever(false);
      setOpen(true);
      send("popup_shown");
    }, 1000);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener("scroll", onScroll);
    };
  }, [config.enabled, config.seconds, signedIn, path]);

  const finish = useCallback(
    (how: "close" | "client" | "designer") => {
      put(local(), STORE_KEY, JSON.stringify(storeAfter(never, config.snoozeDays, Date.now())));
      if (how === "close") send("popup_closed");
      else {
        send(how === "client" ? "popup_click_client" : "popup_click_designer");
        markSource();
      }
      if (never) send("popup_never");
      setOpen(false);
      if (how === "close") before.current?.focus?.({ preventScroll: true });
    },
    [never, config.snoozeDays],
  );

  // While open: focus inside, Tab stays inside, Esc closes, the page behind doesn't scroll.
  useEffect(() => {
    if (!open) return;
    const root = dialog.current;
    const focusables = () => [...(root?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled])') ?? [])];
    focusables()[0]?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish("close");
      } else if (e.key === "Tab") {
        const list = focusables();
        if (!list.length) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (!root?.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      html.style.overflow = overflow;
    };
  }, [open, finish]);

  if (!open) return null;
  const clientTicks = [t("popup.client.tick1"), t("popup.client.tick2"), ...(config.smartphone ? [t("popup.client.tickOffer")] : [])];
  const designerTicks = [t("popup.designer.tick1"), t("popup.designer.tick2"), ...(config.giftBox ? [t("popup.designer.tickOffer")] : [])];

  return createPortal(
    <div className="vp-wrap" data-no-fx>
      <div className="vp-back" aria-hidden onClick={() => finish("close")} />
      <div ref={dialog} className="vp-pop" role="dialog" aria-modal="true" aria-labelledby="vp-title">
        <div className="vp-top">
          <div className="vp-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-icon-tile.png" alt="" width={30} height={30} />
            <strong id="vp-title">{t("popup.title")}</strong>
          </div>
          <button type="button" className="vp-x" aria-label={t("popup.close")} onClick={() => finish("close")}>
            <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="vp-split">
          <Link href={withPopupSource("/start")} className="vp-ps vp-l" onClick={() => finish("client")}>
            <span className="vp-k">{t("popup.client.kicker")}</span>
            <h2>
              {t("popup.client.title1")}
              <br />
              {t("popup.client.title2")}
            </h2>
            <p>{t("popup.client.body")}</p>
            <ul>
              {clientTicks.map((x) => (
                <li key={x}>
                  <Tick />
                  {x}
                </li>
              ))}
            </ul>
            <span className="vp-btn">
              {t("popup.client.cta")}
              <Arrow />
            </span>
            <span className="vp-viz" aria-hidden>
              <span className="vp-t vp-a">
                <Sample n={4} />
              </span>
              <span className="vp-t vp-b">
                <Sample n={9} />
              </span>
              <span className="vp-t vp-c">
                <Sample n={12} />
              </span>
              <span className="vp-t vp-d">
                <Sample n={3} />
              </span>
              {config.smartphone && (
                <span className="vp-ph">
                  <svg width="74" height="140" viewBox="0 0 74 140">
                    <defs>
                      <linearGradient id="vp-phg" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#FFE27A" />
                        <stop offset="1" stopColor="#F29A1A" />
                      </linearGradient>
                    </defs>
                    <rect x="2" y="2" width="70" height="136" rx="16" fill="#111216" />
                    <rect x="7" y="8" width="60" height="124" rx="11" fill="url(#vp-phg)" />
                    <rect x="27" y="13" width="20" height="5" rx="2.5" fill="#111216" />
                    <path d="M37 52l5 10 11 1.5-8 7.5 2 11-10-5.5-10 5.5 2-11-8-7.5 11-1.5z" fill="#8B0000" />
                  </svg>
                </span>
              )}
            </span>
          </Link>

          <span className="vp-or" aria-hidden>
            {t("popup.or")}
          </span>

          <Link href={withPopupSource("/designers/signup")} className="vp-ps vp-r" onClick={() => finish("designer")}>
            <span className="vp-k">{t("popup.designer.kicker")}</span>
            <h2>
              {t("popup.designer.title1")}
              <br />
              {t("popup.designer.title2")}
            </h2>
            <p>{t("popup.designer.body")}</p>
            <ul>
              {designerTicks.map((x) => (
                <li key={x}>
                  <Tick />
                  {x}
                </li>
              ))}
            </ul>
            <span className="vp-btn">
              {t("popup.designer.cta")}
              <Arrow />
            </span>
            <span className="vp-viz" aria-hidden>
              <span className="vp-pc">
                <span className="vp-av">D</span>
                <span className="vp-l1" />
                <span className="vp-l2" />
                <span className="vp-mini">
                  <Sample n={4} />
                  <Sample n={6} />
                  <Sample n={12} />
                </span>
              </span>
              {config.giftBox && (
                <span className="vp-gift">
                  <svg width="96" height="96" viewBox="0 0 96 96">
                    <rect x="10" y="38" width="76" height="52" rx="8" fill="#B3201B" />
                    <rect x="6" y="28" width="84" height="16" rx="6" fill="#8B0000" />
                    <rect x="42" y="28" width="12" height="62" fill="#E2B13C" />
                    <path d="M48 28c-6-14-24-16-22-4 2 7 14 6 22 4zM48 28c6-14 24-16 22-4-2 7-14 6-22 4z" fill="none" stroke="#E2B13C" strokeWidth="6" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
            </span>
          </Link>
        </div>

        <div className="vp-foot">
          <label className="vp-no">
            <input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} />
            {t("popup.never")}
          </label>
          <button type="button" className="vp-browse" onClick={() => finish("close")}>
            {t("popup.browse")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
