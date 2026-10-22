"use client";

import { useEffect, useState, useTransition } from "react";
import { saveAdminPush, testAdminPush } from "@/lib/admin/push-actions";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { pushSupported, subscribeToPush } from "@/lib/push/client";
import { AdminIcon } from "./icons";

type State = "checking" | "off" | "on" | "blocked" | "iphone" | "unsupported" | "server";

/** iPhone and iPad (which calls itself a Mac) show web notifications only for a site added to the Home Screen. */
const appleTouch = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

async function browserSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** From this browser alone, so the block shows at once. */
async function currentState(): Promise<{ state: State; subscription: PushSubscription | null }> {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return { state: "server", subscription: null };
  if (!pushSupported()) return { state: appleTouch() ? "iphone" : "unsupported", subscription: null };
  if (Notification.permission === "denied") return { state: "blocked", subscription: null };
  if (Notification.permission !== "granted") return { state: "off", subscription: null };
  const subscription = await browserSubscription();
  return { state: subscription ? "on" : "off", subscription };
}

/**
 * "Phone notifications" in the admin account menu (owner, 2026-10-22): turn on browser notifications on this phone
 * or computer, then send a test to see they arrive.
 */
export function PushSwitch() {
  const { t } = useI18n();
  const [state, setState] = useState<State>("checking");
  const [note, setNote] = useState<MessageKey | null>(null);
  const [broken, setBroken] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    let live = true;
    currentState()
      .then(({ state: s, subscription }) => {
        if (!live) return;
        setState(s);
        // This browser may have been saved for another account since (one browser, one subscription): take it back.
        if (subscription) saveAdminPush(subscription.toJSON()).then((ok) => live && !ok && setState("off"), () => undefined);
      })
      .catch(() => live && setState("off"));
    return () => {
      live = false;
    };
  }, []);

  // After "Turn on again" dropped the old subscription, a failure leaves this browser without one.
  const fail = (renew: boolean) => {
    if (renew) setState("off");
    setNote("admin.push.failed");
  };

  const turnOn = (renew: boolean) =>
    start(async () => {
      setNote(null);
      try {
        // "Turn on again": drop this browser's old subscription so the browser makes a fresh one.
        if (renew) await (await browserSubscription())?.unsubscribe();
        const subscription = await subscribeToPush();
        if (!subscription) {
          if (Notification.permission === "denied") setState("blocked");
          else fail(renew);
          return;
        }
        if (!(await saveAdminPush(subscription))) return fail(renew);
        setState("on");
        setBroken(false);
        setNote("admin.push.turnedOn");
      } catch {
        fail(renew);
      }
    });

  const test = () =>
    start(async () => {
      setNote(null);
      try {
        const endpoint = (await browserSubscription())?.endpoint;
        if (!endpoint) return fail(true);
        const result = await testAdminPush(endpoint);
        setBroken(result === "none");
        setNote(result === "sent" ? "admin.push.testSent" : result === "driverOff" ? "admin.push.driverOff" : "admin.push.testFailed");
      } catch {
        setNote("admin.push.testFailed");
      }
    });

  if (state === "checking") return null;
  const lead: MessageKey = state === "server" ? "admin.push.driverOff" : `admin.push.${state}`;
  const button = "inline-flex h-11 shrink-0 items-center gap-2 rounded-[12px] px-[18px] text-[15px] font-bold disabled:opacity-60";

  return (
    <div className="-mt-px flex flex-col gap-2.5 border-y border-adm-line-soft px-4 py-3.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-adm-bg text-primary">
          <AdminIcon name="bell" size={18} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-snug">
          <strong className="text-[15.5px] font-bold">{t("admin.push.title")}</strong>
          <span className="text-sm text-muted">{t(lead)}</span>
        </div>
      </div>
      {(state === "off" || state === "on") && (
        <div className="flex flex-wrap justify-end gap-2">
          {(state === "off" || broken) && (
            <button type="button" role="menuitem" onClick={() => turnOn(state === "on")} disabled={pending} className={`${button} bg-primary text-white hover:bg-adm-deep`}>
              {t(state === "on" ? "admin.push.turnOnAgain" : "admin.push.turnOn")}
            </button>
          )}
          {state === "on" && (
            <button type="button" role="menuitem" onClick={test} disabled={pending} className={`${button} bg-tint text-primary hover:bg-[#f6dad8]`}>
              {t("admin.push.test")}
            </button>
          )}
        </div>
      )}
      <p role="status" className="m-0 text-sm font-semibold text-adm-strong empty:-mt-2.5">
        {note ? t(note) : ""}
      </p>
    </div>
  );
}
