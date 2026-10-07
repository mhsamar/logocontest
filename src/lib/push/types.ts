export type PushMessage = { title: string; body: string; url: string };

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

/** "gone" means the browser unsubscribed; the subscription should be deleted. */
export type PushResult = "sent" | "gone" | "failed";

/** Browser push notifications (BLUEPRINT §12). */
export interface PushSender {
  send(target: PushTarget, message: PushMessage): Promise<PushResult>;
}
