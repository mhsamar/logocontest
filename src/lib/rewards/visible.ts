import "server-only";
import { cache } from "react";
import { getCurrency } from "@/lib/currency/server";
import { offersOn, type Offers } from "./program";

const NONE: Offers = { program: false, smartphone: false, giftBox: false };

/**
 * The monthly offers this visitor may see (owner, 2026-10-14): the smartphone and gift box are for Bangladesh only,
 * so visitors from abroad (who see prices in US dollars) see no prize cards, pop-up, leaderboard or links. Scheduled
 * jobs (month close, claims) keep using offersOn().
 */
export const visibleOffers = cache(async (): Promise<Offers> => {
  const [on, currency] = await Promise.all([offersOn(), getCurrency()]);
  return currency.code === "USD" ? NONE : on;
});
