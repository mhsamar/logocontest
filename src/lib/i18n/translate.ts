import type { Locale } from "./config";
import type { Messages } from "./messages/en";

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;
export type MessageParams = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: MessageParams) => string;

export function createTranslator(locale: Locale, messages: Messages): Translate {
  const numberFormat = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US", { useGrouping: false });

  return (key, params) => {
    const value = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], messages);
    if (typeof value !== "string") return key;
    if (!params) return value;
    return value.replace(/\{(\w+)\}/g, (match, name: string) => {
      const param = params[name];
      if (param === undefined) return match;
      return typeof param === "number" ? numberFormat.format(param) : param;
    });
  };
}
