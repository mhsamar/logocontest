import type { EmailMessage, EmailSender } from "./types";

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

  async send({ to, subject, text }: EmailMessage): Promise<void> {
    const res = await this.fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: this.from, to: [to], subject, text }),
      signal: AbortSignal.timeout(15_000),
    });
    // The address and the code are never logged; only Resend's answer.
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}
