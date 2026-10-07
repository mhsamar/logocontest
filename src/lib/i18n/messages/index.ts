import type { Locale } from "../config";
import bn from "./bn";
import en, { type Messages } from "./en";

export const MESSAGES: Record<Locale, Messages> = { en, bn };
