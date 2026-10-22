import "server-only";
import { requireEnv } from "@/lib/env";
import { backupLinksOn } from "@/lib/site-origin";
import { backupOrigin } from "@/lib/site-hosts";
import { createAdminClient } from "@/lib/supabase/admin";
import { LogPushSender } from "./log-sender";
import type { PushMessage, PushSender } from "./types";
import { WebPushSender } from "./web-push-sender";

export type { PushMessage };

export function getPushSender(): PushSender {
  const driver = process.env.PUSH_DRIVER ?? "log";
  switch (driver) {
    case "log":
      return new LogPushSender();
    case "webpush":
      return new WebPushSender({
        publicKey: requireEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY"),
        privateKey: requireEnv("VAPID_PRIVATE_KEY"),
        subject: process.env.VAPID_SUBJECT ?? "mailto:support@logocontest.bd",
      });
    default:
      throw new Error(`Unknown PUSH_DRIVER "${driver}". Use "log" or "webpush".`);
  }
}

/** A browser's PushSubscription.toJSON(), as sent from the client. */
export type BrowserSubscription = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

export function parseSubscription(input: unknown): { endpoint: string; p256dh: string; auth: string } | null {
  const s = input as BrowserSubscription | null;
  const endpoint = s?.endpoint;
  const p256dh = s?.keys?.p256dh;
  const auth = s?.keys?.auth;
  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") return null;
  if (!endpoint.startsWith("https://") || endpoint.length > 1000 || p256dh.length > 200 || auth.length > 100) return null;
  return { endpoint, p256dh, auth };
}

/** Saves (or moves to this user) the subscription of the browser the user is on. */
export async function savePushSubscription(userId: string, input: unknown, userAgent: string | null): Promise<boolean> {
  const sub = parseSubscription(input);
  if (!sub) return false;
  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .upsert({ user_id: userId, ...sub, user_agent: userAgent?.slice(0, 300) ?? null }, { onConflict: "endpoint" });
  if (error) console.error("[push] could not save subscription:", error.message);
  return !error;
}

/** Sends a notification to every browser where the user allowed notifications (or only this one). Never throws. */
export async function notifyUser(userId: string, message: PushMessage, endpoint?: string): Promise<number> {
  try {
    const db = createAdminClient();
    let query = db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
    if (endpoint) query = query.eq("endpoint", endpoint);
    const { data } = await query;
    if (!data?.length) return 0;
    const sender = getPushSender();
    // While Backup links is on, a tap opens the backup address (owner, 2026-10-21); otherwise the browser's own one.
    const backup = backupOrigin();
    const out = backup && message.url.startsWith("/") && !message.url.startsWith("//") && (await backupLinksOn()) ? { ...message, url: `${backup}${message.url}` } : message;
    let sent = 0;
    for (const row of data) {
      const result = await sender.send(row, out);
      if (result === "sent") {
        sent++;
        await db.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);
      } else if (result === "gone") {
        await db.from("push_subscriptions").delete().eq("id", row.id);
      }
    }
    return sent;
  } catch (e) {
    console.error("[push] notify failed:", e instanceof Error ? e.message : e);
    return 0;
  }
}
