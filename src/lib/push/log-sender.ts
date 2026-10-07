import type { PushMessage, PushResult, PushSender, PushTarget } from "./types";

/** Local development driver: prints the notification to the server console instead of sending it. */
export class LogPushSender implements PushSender {
  async send(target: PushTarget, { title, body, url }: PushMessage): Promise<PushResult> {
    console.info(`[push:log] to=${new URL(target.endpoint).host} title="${title}" body="${body}" url=${url}`);
    return "sent";
  }
}
