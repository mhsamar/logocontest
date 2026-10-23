"use client";

import { useEffect } from "react";
import { endPixelStart, markPixel, pixelDone, trackPixel } from "@/lib/analytics/meta-pixel";
import { claimPurchasePixel } from "@/lib/analytics/purchase-actions";

// How long to wait for Meta's library (fbevents.js) before giving up in this browser.
const WAIT_MS = 10_000;
const STEP_MS = 250;

/**
 * Meta Pixel Purchase (owner, 2026-10-24): rendered for the client of a contest that is live, after the server confirmed
 * the payment. Sent once per payment across all their devices (the server keeps the first claim), with what the client
 * paid in taka. The next contest started in this tab then counts as a new start.
 */
export function PurchasePixel({ paymentId, value }: { paymentId: string; value: number }) {
  useEffect(() => {
    const key = `purchase:${paymentId}`;
    if (typeof window.fbq !== "function" || pixelDone(key)) return;
    endPixelStart();
    // The base code's stub exists even when an ad blocker stops Meta's library; only the loaded library can send. A
    // browser that can't send doesn't use up the one claim, so another device or a later visit still can.
    let waited = 0;
    const timer = window.setInterval(() => {
      const loaded = typeof (window.fbq as { callMethod?: unknown } | undefined)?.callMethod === "function";
      if (!loaded && (waited += STEP_MS) < WAIT_MS) return;
      window.clearInterval(timer);
      if (!loaded) return;
      // Sent even if the client has already moved on: the server has kept the claim for this browser.
      void claimPurchasePixel(paymentId)
        .then((ok) => (ok ? trackPixel(key, "Purchase", { value, currency: "BDT" }) : markPixel(key)))
        .catch(() => undefined);
    }, STEP_MS);
  }, [paymentId, value]);
  return null;
}
