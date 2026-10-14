"use client";

import { createContext, useContext, useMemo } from "react";
import { BDT, formatPrice, type Currency } from "@/lib/currency/rules";
import type { Locale } from "./config";
import type { Messages } from "./messages/en";
import { createTranslator, type Translate } from "./translate";

type I18nValue = { locale: Locale; t: Translate; currency: Currency; price: (bdt: number) => string };

// One context for the whole app. When a message file changes in development, hot reload runs this
// module again; keeping the context on globalThis stops the provider and its readers from ending
// up with two different contexts ("useI18n must be used inside <I18nProvider>").
const store = globalThis as typeof globalThis & { __lcI18nContext?: React.Context<I18nValue | null> };
const I18nContext = (store.__lcI18nContext ??= createContext<I18nValue | null>(null));

/**
 * Takes the messages of one language only, passed down from the server layout, so each visitor
 * downloads just their own language's texts (BLUEPRINT §15.1) instead of both in the JavaScript.
 */
export function I18nProvider({ locale, messages, currency = BDT, children }: { locale: Locale; messages: Messages; currency?: Currency; children: React.ReactNode }) {
  // `price`: a taka amount in this visitor's currency (owner, 2026-10-14: US dollars for visitors from abroad).
  const value = useMemo(() => ({ locale, t: createTranslator(locale, messages), currency, price: (bdt: number) => formatPrice(bdt, locale, currency) }), [locale, messages, currency]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
