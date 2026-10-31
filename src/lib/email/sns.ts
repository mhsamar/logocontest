import { createVerify } from "node:crypto";

/**
 * Amazon SES bounce and complaint reports (owner, 2026-11-01), delivered by Amazon SNS to /api/email/ses-events. Pure
 * apart from fetching AWS's signing certificate: every message is checked against AWS's signature before anything in
 * it is believed, and only links on AWS's own SNS hosts are ever opened.
 */

export type SnsMessage = {
  Type: string;
  MessageId: string;
  TopicArn: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  Subject?: string;
  SubscribeURL?: string;
  Token?: string;
};

export type Suppression = { email: string; reason: "bounce" | "complaint"; detail: string | null };

/** An https link on an SNS host of AWS (sns.<region>.amazonaws.com), e.g. its certificate or a subscribe link. */
export function isSnsUrl(raw: unknown, pem = false): raw is string {
  if (typeof raw !== "string") return false;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/.test(u.hostname) && (!pem || u.pathname.endsWith(".pem"));
  } catch {
    return false;
  }
}

export function parseSns(raw: string): SnsMessage | null {
  let m: Record<string, unknown>;
  try {
    m = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  const str = (k: string) => (typeof m[k] === "string" ? (m[k] as string) : null);
  const need = ["Type", "MessageId", "TopicArn", "Message", "Timestamp", "SignatureVersion", "Signature", "SigningCertURL"];
  if (need.some((k) => str(k) === null)) return null;
  return {
    Type: str("Type")!,
    MessageId: str("MessageId")!,
    TopicArn: str("TopicArn")!,
    Message: str("Message")!,
    Timestamp: str("Timestamp")!,
    SignatureVersion: str("SignatureVersion")!,
    Signature: str("Signature")!,
    SigningCertURL: str("SigningCertURL")!,
    ...(str("Subject") !== null ? { Subject: str("Subject")! } : {}),
    ...(str("SubscribeURL") !== null ? { SubscribeURL: str("SubscribeURL")! } : {}),
    ...(str("Token") !== null ? { Token: str("Token")! } : {}),
  };
}

/** The text AWS signed, as its SNS documentation lays it out for each kind of message. */
export function stringToSign(m: SnsMessage): string {
  const keys =
    m.Type === "Notification" ? ["Message", "MessageId", ...(m.Subject !== undefined ? ["Subject"] : []), "Timestamp", "TopicArn", "Type"] : ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"];
  return keys.map((k) => `${k}\n${(m as Record<string, string | undefined>)[k] ?? ""}\n`).join("");
}

/** Whether AWS signed this message (SignatureVersion 1 = SHA1, 2 = SHA256) with the certificate at its SNS link. */
export async function verifySns(m: SnsMessage, certificate: (url: string) => Promise<string>): Promise<boolean> {
  if (!isSnsUrl(m.SigningCertURL, true)) return false;
  const algorithm = m.SignatureVersion === "1" ? "RSA-SHA1" : m.SignatureVersion === "2" ? "RSA-SHA256" : null;
  if (!algorithm) return false;
  try {
    const pem = await certificate(m.SigningCertURL);
    return createVerify(algorithm).update(stringToSign(m), "utf8").verify(pem, m.Signature, "base64");
  } catch {
    return false;
  }
}

/**
 * The addresses a report says to stop emailing: a permanent bounce (the mailbox doesn't exist) or a spam complaint.
 * A temporary bounce (a full mailbox) changes nothing. Both SES formats: identity notifications (notificationType) and
 * configuration-set events (eventType).
 */
export function suppressionsFrom(message: string): Suppression[] {
  let n: Record<string, unknown>;
  try {
    n = JSON.parse(message) as Record<string, unknown>;
  } catch {
    return [];
  }
  const kind = (n.notificationType ?? n.eventType) as string | undefined;
  const list = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  const clean = (e: unknown) => (typeof e === "string" ? e.trim().toLowerCase().replace(/^.*<([^>]+)>$/, "$1") : "");
  const ok = (e: string) => e.length > 3 && e.length <= 254 && e.includes("@");
  if (kind === "Bounce") {
    const b = (n.bounce ?? {}) as Record<string, unknown>;
    if (b.bounceType !== "Permanent") return [];
    return list(b.bouncedRecipients)
      .map((r) => ({ email: clean(r.emailAddress), reason: "bounce" as const, detail: typeof r.diagnosticCode === "string" ? r.diagnosticCode.slice(0, 300) : typeof b.bounceSubType === "string" ? b.bounceSubType : null }))
      .filter((s) => ok(s.email));
  }
  if (kind === "Complaint") {
    const c = (n.complaint ?? {}) as Record<string, unknown>;
    return list(c.complainedRecipients)
      .map((r) => ({ email: clean(r.emailAddress), reason: "complaint" as const, detail: typeof c.complaintFeedbackType === "string" ? c.complaintFeedbackType : null }))
      .filter((s) => ok(s.email));
  }
  return [];
}
