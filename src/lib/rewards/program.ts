import "server-only";
import { getSettings } from "@/lib/settings";

export type Offers = {
  /** The monthly prizes program is running (Admin → Monthly winner, master switch). */
  program: boolean;
  /** The smartphone race for clients is running. */
  smartphone: boolean;
  /** The gift box race for designers is running. */
  giftBox: boolean;
};

/**
 * Which monthly offers are running (owner, 2026-10-13). Every page, card and pop-up that mentions the smartphone,
 * the gift box, the leaderboard, a monthly prize claim or a champion badge reads this, so nothing promises an offer
 * that isn't on. Each offer needs the master switch and its own switch.
 */
export async function offersOn(): Promise<Offers> {
  const s = await getSettings(["rewards.program_on", "rewards.smartphone_card_on", "rewards.gift_box_card_on"]);
  const program = s["rewards.program_on"];
  return { program, smartphone: program && s["rewards.smartphone_card_on"], giftBox: program && s["rewards.gift_box_card_on"] };
}

/** Pages that only exist for the program: their menu, footer and sitemap links hide while it is off. */
export const PROGRAM_PATHS = ["/leaderboard"];
export const showsLink = (href: string | undefined, on: Pick<Offers, "program">) => on.program || !href || !PROGRAM_PATHS.some((p) => href === p || href.startsWith(`${p}?`) || href.startsWith(`${p}#`));
