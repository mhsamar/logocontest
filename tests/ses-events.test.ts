import { createSign, generateKeyPairSync } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isSnsUrl, parseSns, stringToSign, suppressionsFrom, verifySns, type SnsMessage } from "@/lib/email/sns";

// Owner, 2026-11-01: Amazon SES bounces and spam complaints stop the site emailing those addresses.

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
const TOPIC = "arn:aws:sns:ap-southeast-2:111122223333:logocontest-ses-events";
const CERT = "https://sns.ap-southeast-2.amazonaws.com/SimpleNotificationService-abc.pem";
const sign = (m: Omit<SnsMessage, "Signature">, version = "2"): SnsMessage => {
  const full = { ...m, SignatureVersion: version, Signature: "" } as SnsMessage;
  full.Signature = createSign(version === "1" ? "RSA-SHA1" : "RSA-SHA256").update(stringToSign(full)).sign(privateKey, "base64");
  return full;
};
const bounce = (type: string, email = "Gone@Example.com") => JSON.stringify({ notificationType: "Bounce", bounce: { bounceType: type, bouncedRecipients: [{ emailAddress: email, diagnosticCode: "550 5.1.1 user unknown" }] } });
const note = (message: string, topic = TOPIC) => sign({ Type: "Notification", MessageId: "m1", TopicArn: topic, Message: message, Timestamp: "2026-11-01T10:00:00.000Z", SignatureVersion: "2", SigningCertURL: CERT });

describe("SNS messages from AWS", () => {
  it("only AWS's own SNS links are opened", () => {
    expect(isSnsUrl(CERT, true)).toBe(true);
    expect(isSnsUrl("https://sns.ap-southeast-2.amazonaws.com/?Action=ConfirmSubscription&Token=x")).toBe(true);
    for (const bad of ["http://sns.ap-southeast-2.amazonaws.com/a.pem", "https://sns.amazonaws.com.evil.com/a.pem", "https://evil.com/sns.ap-southeast-2.amazonaws.com/a.pem", "https://s3.amazonaws.com/a.pem"]) expect(isSnsUrl(bad, true), bad).toBe(false);
    expect(isSnsUrl("https://sns.ap-southeast-2.amazonaws.com/a.txt", true)).toBe(false);
  });

  it("believes a message only with AWS's signature, in both signature versions", async () => {
    const cert = async () => publicKey;
    expect(await verifySns(note(bounce("Permanent")), cert)).toBe(true);
    const v1 = sign({ Type: "Notification", MessageId: "m1", TopicArn: TOPIC, Message: "x", Timestamp: "t", SignatureVersion: "1", SigningCertURL: CERT }, "1");
    expect(await verifySns(v1, cert)).toBe(true);
    expect(await verifySns({ ...note(bounce("Permanent")), Message: bounce("Permanent", "someone@else.com") }, cert)).toBe(false);
    expect(await verifySns({ ...note("x"), SigningCertURL: "https://evil.com/a.pem" }, cert)).toBe(false);
    expect(await verifySns({ ...note("x"), SignatureVersion: "9" }, cert)).toBe(false);
    expect(parseSns("not json")).toBeNull();
    expect(parseSns(JSON.stringify({ Type: "Notification" }))).toBeNull();
  });

  it("stops a permanent bounce and a complaint, never a full mailbox", () => {
    expect(suppressionsFrom(bounce("Permanent"))).toEqual([{ email: "gone@example.com", reason: "bounce", detail: "550 5.1.1 user unknown" }]);
    expect(suppressionsFrom(bounce("Transient"))).toEqual([]);
    expect(suppressionsFrom(JSON.stringify({ eventType: "Complaint", complaint: { complaintFeedbackType: "abuse", complainedRecipients: [{ emailAddress: "Name <spam@example.com>" }] } }))).toEqual([{ email: "spam@example.com", reason: "complaint", detail: "abuse" }]);
    expect(suppressionsFrom(JSON.stringify({ notificationType: "Delivery" }))).toEqual([]);
    expect(suppressionsFrom("garbage")).toEqual([]);
  });
});

// ---- The route ------------------------------------------------------------------------------------------------------

const saved = vi.hoisted(() => ({ rows: [] as unknown[], fail: false }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ upsert: async (rows: unknown[]) => (saved.fail ? { error: { message: "down" } } : (saved.rows.push(...rows), { error: null })) }) }),
}));

describe("/api/email/ses-events", () => {
  const opened: string[] = [];
  beforeEach(() => {
    saved.rows = [];
    saved.fail = false;
    opened.length = 0;
    vi.stubEnv("SES_EVENTS_TOPIC_ARN", TOPIC);
    vi.stubGlobal("fetch", async (url: string) => (opened.push(url), url.endsWith(".pem") ? new Response(publicKey) : new Response("ok")));
  });
  const post = async (body: unknown) => (await import("@/app/api/email/ses-events/route")).POST(new Request("https://logocontest.bd/api/email/ses-events", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

  it("saves the addresses of a signed report from our topic", async () => {
    expect((await post(note(bounce("Permanent")))).status).toBe(200);
    expect(saved.rows).toEqual([{ email: "gone@example.com", reason: "bounce", detail: "550 5.1.1 user unknown" }]);
  });

  it("refuses another topic, a forged message and junk; asks SNS to retry when the save fails", async () => {
    expect((await post(note(bounce("Permanent"), "arn:aws:sns:ap-southeast-2:999:other"))).status).toBe(403);
    expect((await post({ ...note(bounce("Permanent")), Message: bounce("Permanent", "x@y.com") })).status).toBe(403);
    expect((await post("junk")).status).toBe(403);
    expect(saved.rows).toEqual([]);
    saved.fail = true;
    expect((await post(note(bounce("Permanent")))).status).toBe(500);
  });

  it("confirms the subscription by opening AWS's link only", async () => {
    const sub = (url: string) => sign({ Type: "SubscriptionConfirmation", MessageId: "s1", TopicArn: TOPIC, Message: "confirm", Timestamp: "t", SignatureVersion: "2", SigningCertURL: CERT, SubscribeURL: url, Token: "tok" });
    expect((await post(sub("https://sns.ap-southeast-2.amazonaws.com/?Action=ConfirmSubscription&Token=tok"))).status).toBe(200);
    expect(opened).toContain("https://sns.ap-southeast-2.amazonaws.com/?Action=ConfirmSubscription&Token=tok");
    expect((await post(sub("https://evil.com/confirm"))).status).toBe(400);
    expect(opened).not.toContain("https://evil.com/confirm");
  });

  it("is off without a topic", async () => {
    vi.stubEnv("SES_EVENTS_TOPIC_ARN", "");
    expect((await post(note(bounce("Permanent")))).status).toBe(404);
  });
});
