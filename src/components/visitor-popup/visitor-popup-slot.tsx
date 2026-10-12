import { getSettings } from "@/lib/settings";
import { VisitorPopup } from "./visitor-popup";

/**
 * Server half of the visitor pop-up (owner, 2026-10-13): the on/off switch, seconds and days from Settings, and
 * whether the monthly smartphone / gift box offers are running (Admin → Monthly winner), so their ticks stay honest.
 */
export async function VisitorPopupSlot({ signedIn }: { signedIn: boolean }) {
  const s = await getSettings(["popup.on", "popup.seconds", "popup.snooze_days", "rewards.smartphone_card_on", "rewards.gift_box_card_on"]);
  return (
    <VisitorPopup
      signedIn={signedIn}
      config={{ enabled: s["popup.on"], seconds: s["popup.seconds"], snoozeDays: s["popup.snooze_days"], smartphone: s["rewards.smartphone_card_on"], giftBox: s["rewards.gift_box_card_on"] }}
    />
  );
}
