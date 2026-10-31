import { createHash, createHmac } from "node:crypto";
import { EmailSendError, type EmailMessage, type EmailReceipt, type EmailSender } from "./types";

/**
 * Real emails through Amazon SES (owner, 2026-11-01): paid per email, no monthly plan, no daily cap once out of the
 * sandbox. SES API v2 (SendEmail) over plain fetch, signed with AWS Signature Version 4, so no AWS package is needed.
 * The sending address must be on a domain verified in SES in this region (logocontest.bd).
 */

export type SesConfig = { region: string; accessKeyId: string; secretAccessKey: string; from: string; configurationSet?: string };

const sha256 = (data: string) => createHash("sha256").update(data, "utf8").digest("hex");
const hmac = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data, "utf8").digest();

/** "20261101T093000Z" and "20261101". */
export const amzDates = (now: Date) => {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return { stamp, day: stamp.slice(0, 8) };
};

/**
 * The Authorization header of AWS Signature Version 4 for one request without a query string. `headers` are the
 * headers to sign (lower-case names), host and x-amz-date among them.
 */
export function signV4(input: { method: string; path: string; headers: Record<string, string>; body: string; region: string; service: string; accessKeyId: string; secretAccessKey: string; now: Date }): string {
  const { stamp, day } = amzDates(input.now);
  const names = Object.keys(input.headers).map((h) => h.toLowerCase()).sort();
  const lower = Object.fromEntries(Object.entries(input.headers).map(([k, v]) => [k.toLowerCase(), v]));
  const canonicalHeaders = names.map((n) => `${n}:${String(lower[n]).trim().replace(/\s+/g, " ")}\n`).join("");
  const signed = names.join(";");
  const canonical = [input.method, input.path, "", canonicalHeaders, signed, sha256(input.body)].join("\n");
  const scope = `${day}/${input.region}/${input.service}/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", stamp, scope, sha256(canonical)].join("\n");
  const key = hmac(hmac(hmac(hmac(`AWS4${input.secretAccessKey}`, day), input.region), input.service), "aws4_request");
  const signature = createHmac("sha256", key).update(toSign, "utf8").digest("hex");
  return `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signed}, Signature=${signature}`;
}

export class SesEmailSender implements EmailSender {
  constructor(
    private readonly config: SesConfig,
    private readonly fetcher: typeof fetch = fetch,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async send({ to, subject, text, html, replyTo, headers, from }: EmailMessage): Promise<EmailReceipt> {
    const { region } = this.config;
    const host = `email.${region}.amazonaws.com`;
    const path = "/v2/email/outbound-emails";
    const utf8 = (data: string) => ({ Data: data, Charset: "UTF-8" });
    const body = JSON.stringify({
      FromEmailAddress: from || this.config.from,
      Destination: { ToAddresses: [to] },
      ...(replyTo ? { ReplyToAddresses: [replyTo] } : {}),
      ...(this.config.configurationSet ? { ConfigurationSetName: this.config.configurationSet } : {}),
      Content: {
        Simple: {
          Subject: utf8(subject),
          Body: { Text: utf8(text), ...(html ? { Html: utf8(html) } : {}) },
          // List-Unsubscribe for one-click unsubscribe in Gmail, as with Resend.
          ...(headers && Object.keys(headers).length ? { Headers: Object.entries(headers).map(([Name, Value]) => ({ Name, Value })) } : {}),
        },
      },
    });
    const now = this.clock();
    const signedHeaders = { host, "content-type": "application/json", "x-amz-date": amzDates(now).stamp };
    const authorization = signV4({ method: "POST", path, headers: signedHeaders, body, region, service: "ses", accessKeyId: this.config.accessKeyId, secretAccessKey: this.config.secretAccessKey, now });
    let res: Response;
    try {
      res = await this.fetcher(`https://${host}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Amz-Date": signedHeaders["x-amz-date"], Authorization: authorization },
        body,
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e) {
      throw new EmailSendError(`SES unreachable: ${e instanceof Error ? e.message : String(e)}`, true);
    }
    // The address and the content are never logged; only SES's answer.
    if (!res.ok) throw new EmailSendError(`SES ${res.status}: ${(await res.text()).slice(0, 200)}`, res.status === 429 || res.status >= 500);
    const json = (await res.json().catch(() => null)) as { MessageId?: unknown } | null;
    return { id: typeof json?.MessageId === "string" ? `ses:${json.MessageId}` : null };
  }
}

/**
 * Two providers (owner, 2026-11-01): Amazon SES first, Resend when SES can't send that email (an outage, the sandbox,
 * a sending address not verified there, a refused key), so an email is never lost to one provider. Throws only when
 * both failed, retrying only if either could still work.
 */
export class FallbackEmailSender implements EmailSender {
  constructor(
    private readonly primary: EmailSender,
    private readonly backup: EmailSender,
    private readonly onFallback: (error: string) => void = (error) => console.warn(`[email] SES failed, sent by Resend instead: ${error}`),
  ) {}

  async send(message: EmailMessage): Promise<EmailReceipt> {
    let first: EmailSendError;
    try {
      return await this.primary.send(message);
    } catch (e) {
      first = e instanceof EmailSendError ? e : new EmailSendError(e instanceof Error ? e.message : String(e), true);
    }
    try {
      const receipt = await this.backup.send(message);
      this.onFallback(first.message);
      return receipt;
    } catch (e) {
      const second = e instanceof EmailSendError ? e : new EmailSendError(e instanceof Error ? e.message : String(e), true);
      throw new EmailSendError(`${first.message} | then ${second.message}`, first.retry || second.retry);
    }
  }
}
