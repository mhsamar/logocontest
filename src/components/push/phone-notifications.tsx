"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { usePushDevice } from "@/lib/push/use-push-device";

const LATER_KEY = "lc-push-later";
const LATER_DAYS = 30;

/**
 * "Phone notifications" for designers and clients (owner, 2026-10-22): in Settings (always shown), and as a small card
 * on the designer dashboard (`prompt`) while this device can turn them on; "Not now" hides the card for 30 days.
 */
export function PhoneNotifications({ role, prompt = false }: { role: "designer" | "client"; prompt?: boolean }) {
  const { t } = useI18n();
  const { state, note, broken, pending, turnOn, test } = usePushDevice();
  // Read once in the browser; the first render shows nothing either way ("checking"), so server and browser agree.
  const [later, setLater] = useState(() => {
    if (!prompt || typeof window === "undefined") return prompt;
    try {
      return Date.now() - Number(window.localStorage.getItem(LATER_KEY) ?? 0) < LATER_DAYS * 86_400_000;
    } catch {
      return false;
    }
  });

  const hideForNow = () => {
    setLater(true);
    try {
      window.localStorage.setItem(LATER_KEY, String(Date.now()));
    } catch {
      // Private window: hidden until the page reloads.
    }
  };

  // Nothing while loading, or while the Super admin looks through this account ("Log in as").
  if (state === "checking" || state === "viewing") return null;
  // The card asks only where it can help: this device can turn them on, or it's an iPhone not yet on the Home Screen.
  if (prompt && (later || !(state === "off" || state === "iphone" || (state === "on" && note)))) return null;

  const lead: MessageKey =
    state === "off" ? (role === "designer" ? "push.device.leadDesigner" : "push.device.leadClient") : state === "server" ? "push.device.driverOff" : `push.device.${state}`;
  const buttons = (state === "off" || state === "on") && (
    <div className="flex flex-wrap gap-2">
      {(state === "off" || broken) && (
        <Button onClick={() => turnOn(state === "on")} disabled={pending}>
          {t(state === "on" ? "push.device.turnOnAgain" : "push.device.turnOn")}
        </Button>
      )}
      {state === "on" && (
        <Button variant="secondary" onClick={test} disabled={pending}>
          {t("push.device.test")}
        </Button>
      )}
      {prompt && state !== "on" && (
        <Button variant="ghost" onClick={hideForNow}>
          {t("push.device.later")}
        </Button>
      )}
    </div>
  );
  const status = (
    <p role="status" className="m-0 text-[15px] font-semibold text-ink empty:hidden">
      {note ? t(`push.device.${note}`) : ""}
    </p>
  );

  if (!prompt)
    return (
      <div className="space-y-3">
        <p className="m-0 text-[15px] text-muted">{t(lead)}</p>
        {buttons}
        {status}
      </div>
    );

  return (
    <section aria-labelledby="push-prompt" className="flex flex-col gap-3 rounded-[18px] border border-line bg-surface p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
      <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-tint text-primary">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <h2 id="push-prompt" className="m-0 text-[17px] font-bold">
          {t("push.device.promptTitle")}
        </h2>
        <p className="m-0 text-[15px] text-muted">{t(state === "iphone" ? "push.device.iphone" : "push.device.promptBody")}</p>
        {status}
      </div>
      {state === "iphone" ? (
        <Button variant="ghost" onClick={hideForNow} className="self-start sm:self-center">
          {t("push.device.later")}
        </Button>
      ) : (
        buttons
      )}
    </section>
  );
}
