"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { isLocalizedPath, localizedPath, splitLangPath } from "@/lib/i18n/lang-path";
import { useI18n } from "@/lib/i18n/client";

/** Marks a link whose address was changed to English here, holding the plain one (as its Next.js link still does). */
const MARK = "data-lc-en";

/** The English address for a link on this site to a public page by its plain (Bangla) address, or null. */
function englishFor(a: HTMLAnchorElement): string | null {
  const href = a.getAttribute("href");
  if (!href || !href.startsWith("/") || href.startsWith("//") || a.hasAttribute("hreflang") || a.hasAttribute("download")) return null;
  if (a.target && a.target !== "_self") return null;
  // Already changed here (and not drawn again since with a new address).
  if (a.hasAttribute(MARK) && splitLangPath(href.split(/[?#]/)[0]).locale) return href;
  const url = new URL(href, location.origin);
  if (splitLangPath(url.pathname).locale || !isLocalizedPath(url.pathname)) return null;
  return `${localizedPath(url.pathname + url.search, "en")}${url.hash}`;
}

/**
 * English stays English (owner, 2026-11-03). The plain address is always Bangla and nobody is redirected, so on an
 * English page a link to a public page goes to its /en address instead: the click is taken over before Next.js's own
 * link handles it, and the link's address is changed when it is pointed at or focused (for opening in a new tab).
 * Language switches (hreflang) are left alone. Also keeps English in the cookie for an /en page the browser loaded
 * early (from a search result), before the visitor opened it.
 */
export function LangCookieSync() {
  const { locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname() || "/";

  useEffect(() => {
    if (splitLangPath(pathname).locale !== "en") return;
    const current = document.cookie.split("; ").find((c) => c.startsWith(`${LOCALE_COOKIE}=`))?.split("=")[1];
    if (current !== "en") document.cookie = `${LOCALE_COOKIE}=en; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }, [pathname]);

  useEffect(() => {
    if (locale !== "en") return;
    const anchor = (e: Event) => ((e.target as Element | null)?.closest?.("a") ?? null) as HTMLAnchorElement | null;
    const point = (e: Event) => {
      const a = anchor(e);
      const to = a && englishFor(a);
      if (!a || !to) return;
      if (!splitLangPath(a.getAttribute("href")!.split(/[?#]/)[0]).locale) a.setAttribute(MARK, a.getAttribute("href")!);
      a.setAttribute("href", to);
    };
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = anchor(e);
      const to = a && englishFor(a);
      if (!to) return;
      e.preventDefault();
      router.push(to);
    };
    document.addEventListener("pointerdown", point, true);
    document.addEventListener("focusin", point, true);
    document.addEventListener("click", click, true);
    return () => {
      document.removeEventListener("pointerdown", point, true);
      document.removeEventListener("focusin", point, true);
      document.removeEventListener("click", click, true);
      // Back to Bangla: the links get their own addresses back.
      for (const a of document.querySelectorAll(`a[${MARK}]`)) {
        a.setAttribute("href", a.getAttribute(MARK)!);
        a.removeAttribute(MARK);
      }
    };
  }, [locale, router]);

  return null;
}
