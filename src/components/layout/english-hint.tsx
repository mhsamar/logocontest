"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LanguageLink } from "@/components/layout/language-link";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { HINT_COOKIE, showsEnglishHint } from "@/lib/i18n/english-hint";
import { isLocalizedPath, splitLangPath } from "@/lib/i18n/lang-path";
import { useI18n } from "@/lib/i18n/client";

const cookie = (name: string) => document.cookie.split("; ").find((c) => c.startsWith(`${name}=`))?.split("=")[1] ?? null;

/**
 * "View in English →" on a Bangla public page (owner, 2026-11-03), for a visitor outside Bangladesh or who chose
 * English before. Decided in the browser after the page shows, so the page itself is the same for everyone and
 * search engines never see the bar. Closing it is remembered for a year; the link switches like the footer's.
 */
export function EnglishHint({ country }: { country: string | null }) {
  const { t, locale } = useI18n();
  const pathname = usePathname() || "/";
  const [show, setShow] = useState(false);
  const { locale: prefixed, path } = splitLangPath(pathname);
  const page = locale === "bn" && !prefixed && isLocalizedPath(path);

  useEffect(() => {
    // Read once the page is in the browser, so the page drawn on the server is the same for everyone.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(page && showsEnglishHint({ chosen: cookie(LOCALE_COOKIE), dismissed: cookie(HINT_COOKIE) === "off", country }));
  }, [page, country]);

  if (!show) return null;
  const close = () => {
    document.cookie = `${HINT_COOKIE}=off; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    setShow(false);
  };
  return (
    <div lang="en" className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 right-[5.5rem] z-40 flex items-center justify-between gap-1 rounded-full bg-ink py-1.5 pl-4 pr-1.5 text-sm text-white shadow-raised sm:left-1/2 sm:right-auto sm:-translate-x-1/2 print:hidden">
      <LanguageLink locale="en" className="whitespace-nowrap font-semibold underline-offset-2 hover:underline">
        {t("langHint.view")} →
      </LanguageLink>
      <button type="button" onClick={close} aria-label={t("langHint.close")} className="flex size-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
        ×
      </button>
    </div>
  );
}
