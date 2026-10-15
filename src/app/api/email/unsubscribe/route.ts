import { readUnsubscribe, setOneEmail } from "@/lib/email/prefs";

/**
 * One-click unsubscribe (RFC 8058) from the List-Unsubscribe header Gmail and others show next to the sender
 * (owner, 2026-10-15). A plain visit goes to the page, which asks first, so link scanners never unsubscribe anyone.
 */
export async function POST(req: Request) {
  const q = new URL(req.url).searchParams;
  const who = readUnsubscribe(q.get("u"), q.get("k"), q.get("s"));
  if (!who) return new Response("Invalid link", { status: 400 });
  return (await setOneEmail(who.userId, who.key, false)) ? new Response("Unsubscribed") : new Response("Try again", { status: 500 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  return Response.redirect(new URL(`/email/unsubscribe${url.search}`, url.origin), 303);
}
