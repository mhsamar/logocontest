import type { SmsSender } from "./types";

/** Local development driver: prints the SMS to the server console instead of sending it. */
export class LogSmsSender implements SmsSender {
  async send(to: string, message: string): Promise<void> {
    console.info(`\n[sms:log] to=${to}\n[sms:log] ${message}\n`);
  }
}
