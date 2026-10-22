"use client";

import { useEffect, useState, useTransition } from "react";
import { browserSubscription, pushSupported, subscribeToPush } from "./client";
import { pushStatusHere, savePushHere, testPushHere } from "./actions";

export type PushState = "checking" | "off" | "on" | "blocked" | "iphone" | "unsupported" | "server" | "viewing";
export type PushNote = "turnedOn" | "failed" | "testSent" | "testFailed" | "driverOff";

/** iPhone and iPad (which calls itself a Mac) show web notifications only for a site added to the Home Screen. */
const appleTouch = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** This browser's state; "on" only when its subscription is saved for the person signed in now. */
async function currentState(): Promise<PushState> {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return "server";
  const supported = pushSupported();
  const subscription = supported && Notification.permission === "granted" ? await browserSubscription() : null;
  // One browser, one subscription: another account here may have it, or Log out stopped it.
  const status = await pushStatusHere(subscription?.endpoint ?? null);
  if (status === "viewing") return "viewing";
  if (!supported) return appleTouch() ? "iphone" : "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "off";
  return status === "mine" ? "on" : "off";
}

/**
 * "Phone notifications" on this device (owner, 2026-10-22), shared by the admin account menu and the designers' and
 * clients' Settings: whether this browser can and does get them, Turn on, Turn on again (a fresh subscription when the
 * old one stopped working), and a test sent to this browser only. Nothing moves a browser's notifications to another
 * account by itself: only pressing Turn on does.
 */
export function usePushDevice() {
  const [state, setState] = useState<PushState>("checking");
  const [note, setNote] = useState<PushNote | null>(null);
  const [broken, setBroken] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    let live = true;
    currentState()
      .then((s) => live && setState(s))
      .catch(() => live && setState("off"));
    return () => {
      live = false;
    };
  }, []);

  // After "Turn on again" dropped the old subscription, a failure leaves this browser without one.
  const fail = (renew: boolean) => {
    if (renew) setState("off");
    setNote("failed");
  };

  const turnOn = (renew = false) =>
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
        if (!(await savePushHere(subscription))) return fail(renew);
        setState("on");
        setBroken(false);
        setNote("turnedOn");
      } catch {
        fail(renew);
      }
    });

  const test = () =>
    start(async () => {
      setNote(null);
      try {
        const endpoint = (await browserSubscription())?.endpoint;
        // The browser dropped it meanwhile: show Turn on again from scratch.
        if (!endpoint) return setState("off");
        const result = await testPushHere(endpoint);
        setBroken(result === "none");
        setNote(result === "sent" ? "testSent" : result === "driverOff" ? "driverOff" : "testFailed");
      } catch {
        setBroken(true);
        setNote("testFailed");
      }
    });

  return { state, note, broken, pending, turnOn, test };
}
