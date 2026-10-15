import { describe, expect, it, vi } from "vitest";
import { ResendEmailSender } from "@/lib/email/resend-sender";
import { EmailSendError } from "@/lib/email/types";

const reply = (status: number, body: unknown) => ({ ok: status < 300, status, text: async () => JSON.stringify(body), json: async () => body });

describe("Resend email sender (owner, 2026-10-10)", () => {
  it("sends the email to Resend with the key and the sender, and returns Resend's id", async () => {
    const fetcher = vi.fn(async () => reply(200, { id: "msg_123" })) as unknown as typeof fetch;
    const receipt = await new ResendEmailSender("re_test", "logocontest.bd <no-reply@logocontest.bd>", fetcher).send({ to: "a@example.com", subject: "Code", text: "123456" });
    const [url, init] = (fetcher as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    expect(JSON.parse(init.body as string)).toEqual({ from: "logocontest.bd <no-reply@logocontest.bd>", to: ["a@example.com"], subject: "Code", text: "123456" });
    expect(receipt).toEqual({ id: "msg_123" });
  });

  it("sends the designed email, the reply-to address and the unsubscribe headers (owner, 2026-10-15)", async () => {
    const fetcher = vi.fn(async () => reply(200, { id: "msg_1" })) as unknown as typeof fetch;
    await new ResendEmailSender("re_test", "x <no-reply@logocontest.bd>", fetcher).send({ to: "a@example.com", subject: "s", text: "t", html: "<p>t</p>", replyTo: "support@logocontest.bd", headers: { "List-Unsubscribe": "<https://x>" } });
    const body = JSON.parse((fetcher as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0][1].body as string);
    expect(body).toMatchObject({ html: "<p>t</p>", reply_to: "support@logocontest.bd", headers: { "List-Unsubscribe": "<https://x>" } });
  });

  it("fails loudly when Resend refuses, and says whether trying again can help", async () => {
    const refused = vi.fn(async () => reply(403, "domain not verified")) as unknown as typeof fetch;
    const err = await new ResendEmailSender("re_test", "x <no-reply@logocontest.bd>", refused).send({ to: "a@example.com", subject: "s", text: "t" }).catch((e) => e);
    expect(err).toBeInstanceOf(EmailSendError);
    expect(err.message).toMatch(/403/);
    expect(err.retry).toBe(false);
    const busy = vi.fn(async () => reply(429, "slow down")) as unknown as typeof fetch;
    expect((await new ResendEmailSender("k", "x <a@b.c>", busy).send({ to: "a@example.com", subject: "s", text: "t" }).catch((e) => e)).retry).toBe(true);
  });
});
