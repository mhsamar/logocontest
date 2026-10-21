"use client";

import { useEffect } from "react";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { langOf } from "@/lib/i18n/lang-path";

// Same private areas the proxy leaves alone (Admin › Legal uses ?lang= for the document's language).
const PRIVATE = /^\/(admin|admin-login|client|dashboard)(\/|$)/;

/**
 * A public page opened from a search result with ?lang= (owner, 2026-10-21): the browser may have loaded it early, before
 * the visitor chose it, so the server couldn't keep the language then. Once the page is shown, remember it here, so the
 * next click stays in that language.
 */
export function LangCookieSync() {
  useEffect(() => {
    if (PRIVATE.test(location.pathname)) return;
    const lang = langOf(location.search);
    if (!lang) return;
    const current = document.cookie.split("; ").find((c) => c.startsWith(`${LOCALE_COOKIE}=`))?.split("=")[1];
    if (current !== lang) document.cookie = `${LOCALE_COOKIE}=${lang}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }, []);
  return null;
}
