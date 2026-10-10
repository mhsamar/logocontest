import { describe, expect, it, vi } from "vitest";
import { ResendEmailSender } from "@/lib/email/resend-sender";

describe("Resend email sender (owner, 2026-10-10)", () => {
  it("sends the email to Resend with the key and the sender", async () => {
    const fetcher = vi.fn(async () => ({ ok: true, status: 200, text: async () => "{}" })) as unknown as typeof fetch;
    await new ResendEmailSender("re_test", "logocontest.bd <no-reply@logocontest.bd>", fetcher).send({ to: "a@example.com", subject: "Code", text: "123456" });
    const [url, init] = (fetcher as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    expect(JSON.parse(init.body as string)).toEqual({ from: "logocontest.bd <no-reply@logocontest.bd>", to: ["a@example.com"], subject: "Code", text: "123456" });
  });

  it("fails loudly when Resend refuses", async () => {
    const fetcher = vi.fn(async () => ({ ok: false, status: 403, text: async () => "domain not verified" })) as unknown as typeof fetch;
    await expect(new ResendEmailSender("re_test", "x <no-reply@logocontest.bd>", fetcher).send({ to: "a@example.com", subject: "s", text: "t" })).rejects.toThrow(/403/);
  });
});
