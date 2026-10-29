import webpush, { WebPushError } from "web-push";
import type { PushMessage, PushResult, PushSender, PushTarget } from "./types";

/** Sends real notifications through each browser's push service (Web Push with VAPID keys). */
export class WebPushSender implements PushSender {
  constructor(keys: { publicKey: string; privateKey: string; subject: string }) {
    webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
  }

  async send(target: PushTarget, message: PushMessage): Promise<PushResult> {
    try {
      await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(message),
        // A push service that doesn't answer gives up after 10 s instead of holding the request (review, 2026-10-29).
        { TTL: 24 * 3600, timeout: 10_000 },
      );
      return "sent";
    } catch (e) {
      if (e instanceof WebPushError && (e.statusCode === 404 || e.statusCode === 410)) return "gone";
      console.error("[push] send failed:", e instanceof Error ? e.message : e);
      return "failed";
    }
  }
}
