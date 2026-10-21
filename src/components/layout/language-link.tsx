"use client";

import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n/config";
import { switchHref } from "@/lib/i18n/lang-path";

/**
 * A language switch (owner, 2026-10-21): a plain link to this page with ?lang=, so search engines can follow it to
 * the other language, and the visitor's choice is kept. A full page load on purpose: never fetched ahead of time.
 */
export function LanguageLink({ locale, className, label, current, children }: { locale: Locale; className?: string; label?: string; current?: boolean; children: ReactNode }) {
  const pathname = usePathname() || "/";
  const search = useSearchParams();
  return (
    <a href={switchHref(pathname, search?.toString() ?? "", locale)} hrefLang={locale} lang={locale} aria-label={label} aria-current={current ? "true" : undefined} className={className}>
      {children}
    </a>
  );
}
