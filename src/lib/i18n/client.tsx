"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "./config";
import { MESSAGES } from "./messages";
import { createTranslator, type Translate } from "./translate";

type I18nValue = { locale: Locale; t: Translate };

// One context for the whole app. When a message file changes in development, hot reload runs this
// module again; keeping the context on globalThis stops the provider and its readers from ending
// up with two different contexts ("useI18n must be used inside <I18nProvider>").
const store = globalThis as typeof globalThis & { __lcI18nContext?: React.Context<I18nValue | null> };
const I18nContext = (store.__lcI18nContext ??= createContext<I18nValue | null>(null));

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, t: createTranslator(locale, MESSAGES[locale]) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
