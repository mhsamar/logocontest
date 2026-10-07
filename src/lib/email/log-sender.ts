import type { EmailMessage, EmailSender } from "./types";

/** Local development driver: prints the email to the server console instead of sending it. */
export class LogEmailSender implements EmailSender {
  async send({ to, subject, text }: EmailMessage): Promise<void> {
    console.info(`\n[email:log] to=${to}\n[email:log] subject: ${subject}\n${text.replace(/^/gm, "[email:log] ")}\n`);
  }
}
