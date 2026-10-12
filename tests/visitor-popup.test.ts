import { describe, expect, it } from "vitest";
import { blockedByStore, isPopupEvent, parseStore, popupAllowedOn, shouldOpen, storeAfter, withPopupSource } from "@/lib/visitor-popup/rules";

const NOW = Date.UTC(2026, 9, 13, 8);
const base = { enabled: true, signedIn: false, hasAccount: false, path: "/", store: {}, shownThisVisit: false, activeSeconds: 20, needSeconds: 20, scrolled: true, now: NOW };

describe("visitor pop-up rules (owner, 2026-10-13)", () => {
  it("opens for a new visitor after the set seconds and a scroll", () => {
    expect(shouldOpen(base)).toBe(true);
    expect(shouldOpen({ ...base, activeSeconds: 19 })).toBe(false);
    expect(shouldOpen({ ...base, scrolled: false })).toBe(false);
  });

  it("never opens for signed-in people, a browser with an account, twice in a visit, or when switched off", () => {
    expect(shouldOpen({ ...base, signedIn: true })).toBe(false);
    expect(shouldOpen({ ...base, hasAccount: true })).toBe(false);
    expect(shouldOpen({ ...base, shownThisVisit: true })).toBe(false);
    expect(shouldOpen({ ...base, enabled: false })).toBe(false);
  });

  it("stays off sign-up, login, password, checkout and signed-in pages", () => {
    for (const p of ["/login", "/designers/signup", "/start", "/start/result", "/forgot-password", "/reset-password", "/verify-email", "/dashboard", "/dashboard/wallet", "/my-contests", "/admin/analytics", "/dev/checkout/x", "/contest/abc/submit", "/legal/terms"]) {
      expect(popupAllowedOn(p), p).toBe(false);
    }
    for (const p of ["/", "/contests", "/contest/abc", "/design-studio", "/logo-checker", "/how-it-works", "/leaderboard", "/d/nila", "/startup"]) {
      expect(popupAllowedOn(p), p).toBe(true);
    }
  });

  it("hides for the set days after a close or click, and for good with Don't show this again", () => {
    const snoozed = storeAfter(false, 7, NOW);
    expect(blockedByStore(snoozed, NOW + 6.9 * 86_400_000)).toBe(true);
    expect(blockedByStore(snoozed, NOW + 7 * 86_400_000 + 1)).toBe(false);
    const never = storeAfter(true, 7, NOW);
    expect(blockedByStore(never, NOW + 3650 * 86_400_000)).toBe(true);
    expect(shouldOpen({ ...base, store: snoozed })).toBe(false);
  });

  it("reads broken storage as nothing stored", () => {
    expect(parseStore(null)).toEqual({});
    expect(parseStore("not json")).toEqual({});
    expect(parseStore('{"until":"soon"}')).toEqual({ never: undefined, until: undefined });
    expect(parseStore('{"never":true}').never).toBe(true);
  });

  it("only knows its five events, and marks the sign-up links", () => {
    expect(isPopupEvent("popup_shown")).toBe(true);
    expect(isPopupEvent("page_view")).toBe(false);
    expect(withPopupSource("/start")).toBe("/start?src=popup");
    expect(withPopupSource("/designers/signup?x=1")).toBe("/designers/signup?x=1&src=popup");
  });
});
