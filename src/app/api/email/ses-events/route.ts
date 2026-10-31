import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isSnsUrl, parseSns, suppressionsFrom, verifySns } from "@/lib/email/sns";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Amazon SES bounces and spam complaints (owner, 2026-11-01): Amazon SNS posts them here. Only messages from the one
 * topic in SES_EVENTS_TOPIC_ARN, signed by AWS, are read. The first message confirms the subscription; after that each
 * permanent bounce or complaint puts the address on email_suppressions, so the site emails it no more. Addresses are
 * never logged.
 */

const certificates = new Map<string, Promise<string>>();
const certificate = (url: string) => {
  if (!certificates.has(url)) {
    certificates.set(
      url,
      fetch(url, { signal: AbortSignal.timeout(10_000) }).then((r) => {
        if (!r.ok) throw new Error(`certificate ${r.status}`);
        return r.text();
      }),
    );
    certificates.get(url)!.catch(() => certificates.delete(url));
  }
  return certificates.get(url)!;
};

export async function POST(req: Request) {
  const topic = process.env.SES_EVENTS_TOPIC_ARN;
  if (!topic) return new NextResponse("Not found", { status: 404 });
  const m = parseSns(await req.text());
  if (!m || m.TopicArn !== topic || !(await verifySns(m, certificate))) return new NextResponse("Forbidden", { status: 403 });

  if (m.Type === "SubscriptionConfirmation") {
    if (!isSnsUrl(m.SubscribeURL)) return new NextResponse("Bad request", { status: 400 });
    const res = await fetch(m.SubscribeURL, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
    console.info(`[ses-events] subscription ${res?.ok ? "confirmed" : "not confirmed"}`);
    return new NextResponse(null, { status: res?.ok ? 200 : 502 });
  }
  if (m.Type !== "Notification") return new NextResponse(null, { status: 200 });

  const list = suppressionsFrom(m.Message);
  if (list.length && isSupabaseConfigured()) {
    const { error } = await createAdminClient()
      .from("email_suppressions")
      .upsert(list.map((s) => ({ email: s.email, reason: s.reason, detail: s.detail })), { onConflict: "email" });
    // A failure answers 500 so SNS tries again later.
    if (error) {
      console.error("[ses-events] save failed:", error.message);
      return new NextResponse(null, { status: 500 });
    }
    console.info(`[ses-events] ${list.length} address(es) stopped (${list[0].reason})`);
  }
  return new NextResponse(null, { status: 200 });
}
