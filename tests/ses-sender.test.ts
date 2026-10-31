import { afterEach, describe, expect, it, vi } from "vitest";
import { FallbackEmailSender, SesEmailSender, signV4 } from "@/lib/email/ses-sender";
import { EmailSendError, type EmailSender } from "@/lib/email/types";

// Owner, 2026-11-01: Amazon SES first, Resend as the backup.

vi.mock("server-only", () => ({}));

describe("AWS Signature Version 4", () => {
  // AWS's own test suite (aws-sig-v4-test-suite: get-vanilla, post-vanilla).
  const base = { path: "/", body: "", region: "us-east-1", service: "service", accessKeyId: "AKIDEXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY", now: new Date("2015-08-30T12:36:00Z"), headers: { Host: "example.amazonaws.com", "X-Amz-Date": "20150830T123600Z" } };

  it("matches AWS's published signatures", () => {
    expect(signV4({ ...base, method: "GET" })).toBe("AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31");
    expect(signV4({ ...base, method: "POST" })).toBe("AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=5da7c1a2acd57cee7505fc6676e4e544621c30862966e37dddb68e92efbe5d6b");
  });
});

const message = { to: "client@example.com", subject: "Hi", text: "Plain", html: "<p>Designed</p>", replyTo: "support@logocontest.bd", headers: { "List-Unsubscribe": "<https://logocontest.bd/u>" } };
const config = { region: "ap-south-1", accessKeyId: "AKIDTEST", secretAccessKey: "secret", from: "logocontest.bd <no-reply@logocontest.bd>" };

describe("SesEmailSender", () => {
  it("sends one SES v2 email, signed, with the text, the design, reply-to and the unsubscribe header", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetcher = (async (url: string, init: RequestInit) => (calls.push({ url, init }), new Response(JSON.stringify({ MessageId: "m-1" }), { status: 200 }))) as unknown as typeof fetch;
    const receipt = await new SesEmailSender(config, fetcher, () => new Date("2026-11-01T09:30:00Z")).send(message);
    expect(receipt).toEqual({ id: "ses:m-1" });
    expect(calls[0].url).toBe("https://email.ap-south-1.amazonaws.com/v2/email/outbound-emails");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["X-Amz-Date"]).toBe("20261101T093000Z");
    expect(headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDTEST\/20261101\/ap-south-1\/ses\/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=[0-9a-f]{64}$/);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      FromEmailAddress: config.from,
      Destination: { ToAddresses: ["client@example.com"] },
      ReplyToAddresses: ["support@logocontest.bd"],
      Content: { Simple: { Subject: { Data: "Hi", Charset: "UTF-8" }, Body: { Text: { Data: "Plain", Charset: "UTF-8" }, Html: { Data: "<p>Designed</p>", Charset: "UTF-8" } }, Headers: [{ Name: "List-Unsubscribe", Value: "<https://logocontest.bd/u>" }] } },
    });
  });

  it("a refusal is not retried; throttling and outages are", async () => {
    const answer = (status: number) => (async () => new Response("no", { status })) as unknown as typeof fetch;
    await expect(new SesEmailSender(config, answer(400)).send(message)).rejects.toMatchObject({ retry: false });
    await expect(new SesEmailSender(config, answer(429)).send(message)).rejects.toMatchObject({ retry: true });
    await expect(new SesEmailSender(config, answer(503)).send(message)).rejects.toMatchObject({ retry: true });
  });
});

describe("SES first, Resend as the backup", () => {
  const ok = (id: string): EmailSender => ({ send: async () => ({ id }) });
  const bad = (retry: boolean): EmailSender => ({ send: async () => Promise.reject(new EmailSendError("nope", retry)) });

  it("uses Resend only when SES can't send, and fails only when both can't", async () => {
    const told: string[] = [];
    expect(await new FallbackEmailSender(ok("ses"), ok("resend"), (e) => told.push(e)).send(message)).toEqual({ id: "ses" });
    expect(told).toEqual([]);
    expect(await new FallbackEmailSender(bad(false), ok("resend"), (e) => told.push(e)).send(message)).toEqual({ id: "resend" });
    expect(told).toEqual(["nope"]);
    await expect(new FallbackEmailSender(bad(false), bad(false)).send(message)).rejects.toMatchObject({ retry: false });
    await expect(new FallbackEmailSender(bad(true), bad(false)).send(message)).rejects.toMatchObject({ retry: true });
  });
});

describe("EMAIL_DRIVER", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("picks SES, SES with Resend, and asks for the SES keys", async () => {
    const { getEmailSender } = await import("@/lib/email");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_DRIVER", "ses+resend");
    vi.stubEnv("SES_ACCESS_KEY_ID", "");
    vi.stubEnv("SES_SECRET_ACCESS_KEY", "");
    expect(() => getEmailSender()).toThrow(/SES_ACCESS_KEY_ID/);
    vi.stubEnv("SES_ACCESS_KEY_ID", "AKIDTEST");
    vi.stubEnv("SES_SECRET_ACCESS_KEY", "secret");
    expect(getEmailSender()).toBeInstanceOf(FallbackEmailSender);
    vi.stubEnv("EMAIL_DRIVER", "ses");
    expect(getEmailSender()).toBeInstanceOf(SesEmailSender);
  });
});
