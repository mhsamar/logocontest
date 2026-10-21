import "server-only";
import { LogEmailSender } from "./log-sender";
import { ResendEmailSender } from "./resend-sender";
import type { EmailSender } from "./types";

export type { EmailSender };

export function getEmailSender(): EmailSender {
  const driver = process.env.EMAIL_DRIVER ?? "log";
  switch (driver) {
    case "log":
      return new LogEmailSender();
    case "resend": {
      const key = process.env.RESEND_API_KEY;
      if (!key) throw new Error("Missing environment variable RESEND_API_KEY. See .env.example.");
      return new ResendEmailSender(key, process.env.EMAIL_FROM || "logocontest.bd <no-reply@logocontest.bd>");
    }
    default:
      throw new Error(`Unknown EMAIL_DRIVER "${driver}". Use "log" or "resend".`);
  }
}
