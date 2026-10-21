"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition, type MouseEvent, type ReactNode } from "react";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";
import { switchHref } from "@/lib/i18n/lang-path";

/**
 * A language switch (owner, 2026-10-21): a real link to this page with ?lang=, so search engines can follow it to the
 * other language. With JavaScript it switches in place: the choice is kept in the cookie, the address gets ?lang=,
 * and every part of the page is drawn again without a reload, so a half-filled form (designer sign-up) is kept.
 */
export function LanguageLink({ locale, className, label, current, children }: { locale: Locale; className?: string; label?: string; current?: boolean; children: ReactNode }) {
  const pathname = usePathname() || "/";
  const search = useSearchParams();
  const router = useRouter();
  const [pending, start] = useTransition();
  const href = switchHref(pathname, search?.toString() ?? "", locale);
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    start(() => {
      router.replace(href, { scroll: false });
      router.refresh();
    });
  };
  return (
    <a href={href} onClick={onClick} hrefLang={locale} lang={locale} aria-label={label} aria-current={current ? "true" : undefined} aria-busy={pending || undefined} className={className}>
      {children}
    </a>
  );
}
