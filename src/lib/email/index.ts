import "server-only";
import { headers } from "next/headers";
import { LogEmailSender } from "./log-sender";
import type { EmailSender } from "./types";

export type { EmailSender };

export function getEmailSender(): EmailSender {
  const driver = process.env.EMAIL_DRIVER ?? "log";
  switch (driver) {
    case "log":
      return new LogEmailSender();
    default:
      throw new Error(`Unknown EMAIL_DRIVER "${driver}". Real providers are added in milestone 9.`);
  }
}

/** Absolute origin for links in emails: SITE_URL if set, otherwise the current request's host. */
export async function siteOrigin(): Promise<string> {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}
