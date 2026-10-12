import { offersOn } from "@/lib/rewards/program";
import { getSettings } from "@/lib/settings";
import { VisitorPopup } from "./visitor-popup";

/**
 * Server half of the visitor pop-up (owner, 2026-10-13): the on/off switch, seconds and days from Settings, and
 * whether the monthly smartphone / gift box offers are running (Admin → Monthly winner), so their ticks stay honest.
 */
export async function VisitorPopupSlot({ signedIn }: { signedIn: boolean }) {
  const [s, on] = await Promise.all([getSettings(["popup.on", "popup.seconds", "popup.snooze_days"]), offersOn()]);
  return (
    <VisitorPopup
      signedIn={signedIn}
      config={{ enabled: s["popup.on"], seconds: s["popup.seconds"], snoozeDays: s["popup.snooze_days"], smartphone: on.smartphone, giftBox: on.giftBox }}
    />
  );
}
