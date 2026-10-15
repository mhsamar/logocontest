import { EmailSendError, type EmailMessage, type EmailReceipt, type EmailSender } from "./types";

/**
 * Real emails through Resend (owner, 2026-10-10): https://resend.com. Free for 3,000 emails a month,
 * at most 100 a day. The sending address must be on a domain verified in Resend (logocontest.bd).
 */
export class ResendEmailSender implements EmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async send({ to, subject, text, html, replyTo, headers }: EmailMessage): Promise<EmailReceipt> {
    const body: Record<string, unknown> = { from: this.from, to: [to], subject, text };
    if (html) body.html = html;
    if (replyTo) body.reply_to = replyTo;
    if (headers && Object.keys(headers).length) body.headers = headers;
    let res: Response;
    try {
      res = await this.fetcher("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e) {
      throw new EmailSendError(`Resend unreachable: ${e instanceof Error ? e.message : String(e)}`, true);
    }
    // The address and the content are never logged; only Resend's answer.
    if (!res.ok) throw new EmailSendError(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`, res.status === 429 || res.status >= 500);
    const json = (await res.json().catch(() => null)) as { id?: unknown } | null;
    return { id: typeof json?.id === "string" ? json.id : null };
  }
}
