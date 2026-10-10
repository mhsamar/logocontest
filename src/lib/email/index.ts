import "server-only";
import { headers } from "next/headers";
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

/** Absolute origin for links in emails: SITE_URL if set, otherwise the current request's host. */
export async function siteOrigin(): Promise<string> {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}
