import "server-only";
import { isPermissionProblem } from "./rules";

/**
 * Facebook Page posts for contest cards (owner, 2026-10-19). The page ID and the Page access token live in Vercel
 * (FACEBOOK_PAGE_ID, FACEBOOK_PAGE_TOKEN): server only, never logged, never sent to the browser. The token goes in the
 * POST body, never in a URL.
 */

const GRAPH = () => `https://graph.facebook.com/${(process.env.FACEBOOK_GRAPH_VERSION ?? "v23.0").trim()}`;
const pageId = () => (process.env.FACEBOOK_PAGE_ID ?? "").trim();
const pageToken = () => (process.env.FACEBOOK_PAGE_TOKEN ?? "").trim();

export const facebookConfigured = () => Boolean(pageId() && pageToken());

export class FacebookError extends Error {
  constructor(
    public code: number | null,
    message: string,
    public permission: boolean,
  ) {
    super(message);
  }
}

/** What Facebook said, without anything secret (Facebook never echoes the token, and we cut the text short). */
function fail(status: number, body: { error?: { message?: string; code?: number; error_subcode?: number } }): FacebookError {
  const code = body.error?.code ?? null;
  const message = `${status}${code !== null ? ` (code ${code}${body.error?.error_subcode ? `/${body.error.error_subcode}` : ""})` : ""}: ${String(body.error?.message ?? "Facebook didn't accept the post").slice(0, 240)}`;
  return new FacebookError(code, message, isPermissionProblem(code, message));
}

export type FacebookPost = { postId: string; url: string };

/** A photo post of the card on the page, now or at `at` (Facebook's own scheduled publish, 10 minutes to 30 days ahead). */
export async function postPhoto(o: { imageUrl: string; caption: string; at?: Date | null }, fetcher: typeof fetch = fetch): Promise<FacebookPost> {
  if (!facebookConfigured()) throw new FacebookError(null, "The Facebook page key isn't set (FACEBOOK_PAGE_ID and FACEBOOK_PAGE_TOKEN in Vercel).", true);
  const form = new URLSearchParams({ url: o.imageUrl, caption: o.caption, access_token: pageToken() });
  if (o.at) {
    form.set("published", "false");
    form.set("scheduled_publish_time", String(Math.floor(o.at.getTime() / 1000)));
  }
  const res = await fetcher(`${GRAPH()}/${encodeURIComponent(pageId())}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; post_id?: string; error?: { message?: string; code?: number; error_subcode?: number } };
  if (!res.ok || body.error || !body.id) throw fail(res.status, body);
  // post_id is "<page>_<post>"; a scheduled photo only has the photo id until it goes out.
  const postId = body.post_id ?? body.id;
  const [page, post] = postId.includes("_") ? postId.split("_") : [pageId(), null];
  return { postId, url: post ? `https://www.facebook.com/${page}/posts/${post}` : `https://www.facebook.com/photo/?fbid=${body.id}` };
}
