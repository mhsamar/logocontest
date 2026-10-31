import "server-only";
import { LogEmailSender } from "./log-sender";
import { ResendEmailSender } from "./resend-sender";
import { FallbackEmailSender, SesEmailSender } from "./ses-sender";
import type { EmailSender } from "./types";

export type { EmailSender };

export function getEmailSender(): EmailSender {
  const driver = process.env.EMAIL_DRIVER ?? "log";
  switch (driver) {
    case "log":
      return new LogEmailSender();
    case "resend":
      return resend();
    // Amazon SES (owner, 2026-11-01); "ses+resend" sends by Resend when SES can't.
    case "ses":
      return ses();
    case "ses+resend":
      return new FallbackEmailSender(ses(), resend());
    default:
      throw new Error(`Unknown EMAIL_DRIVER "${driver}". Use "log", "resend", "ses" or "ses+resend".`);
  }
}

const FROM = () => process.env.EMAIL_FROM || "logocontest.bd <no-reply@logocontest.bd>";

function resend(): EmailSender {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Missing environment variable RESEND_API_KEY. See .env.example.");
  return new ResendEmailSender(key, FROM());
}

/** SES_* rather than AWS_*: Vercel keeps the AWS_ names for itself. */
function ses(): EmailSender {
  const accessKeyId = process.env.SES_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SES_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) throw new Error("Missing environment variables SES_ACCESS_KEY_ID / SES_SECRET_ACCESS_KEY. See .env.example.");
  return new SesEmailSender({ region: process.env.SES_REGION || "ap-south-1", accessKeyId, secretAccessKey, from: FROM(), configurationSet: process.env.SES_CONFIGURATION_SET || undefined });
}
