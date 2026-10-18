import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { PINTEREST_API } from "./rules";

/**
 * Pinterest API v5 calls (owner, 2026-10-19). The app keys live in Vercel (PINTEREST_APP_ID, PINTEREST_APP_SECRET);
 * they never reach the browser. Tokens are stored encrypted with a key made from the app secret.
 */

export const pinterestConfigured = () => Boolean(process.env.PINTEREST_APP_ID && process.env.PINTEREST_APP_SECRET);
export const pinterestAppId = () => process.env.PINTEREST_APP_ID ?? "";

const key = () => createHash("sha256").update(`logocontest-pinterest:${process.env.PINTEREST_APP_SECRET ?? ""}`).digest();

/** AES-256-GCM: iv.tag.data, base64url. A new app secret makes old tokens unreadable (connect again). */
export function sealToken(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function openToken(sealed: string): string | null {
  try {
    const [iv, tag, data] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
    const d = createDecipheriv("aes-256-gcm", key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export class PinterestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, headers, ...rest } = init;
  const res = await fetch(`${PINTEREST_API}${path}`, {
    ...rest,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new PinterestError(res.status, String(body.message ?? body.error_description ?? body.error ?? res.statusText).slice(0, 300));
  return body as T;
}

export type Tokens = { access_token: string; refresh_token?: string; expires_in?: number; refresh_token_expires_in?: number; scope?: string };

/** Code → tokens, or refresh token → new tokens. The app keys go in the Basic header, never in the URL. */
function tokenRequest(form: Record<string, string>): Promise<Tokens> {
  const basic = Buffer.from(`${process.env.PINTEREST_APP_ID}:${process.env.PINTEREST_APP_SECRET}`).toString("base64");
  return call<Tokens>("/oauth/token", { method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form).toString() });
}

export const exchangeCode = (code: string, redirectUri: string) => tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
export const refreshTokens = (refreshToken: string) => tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });

export const accountOf = (token: string) => call<{ username?: string }>("/user_account", { token });

export type Board = { id: string; name: string; privacy?: string };
export async function boardsOf(token: string): Promise<Board[]> {
  const out: Board[] = [];
  let bookmark: string | undefined;
  for (let i = 0; i < 5; i++) {
    const q = new URLSearchParams({ page_size: "100", ...(bookmark ? { bookmark } : {}) });
    const page = await call<{ items?: Board[]; bookmark?: string | null }>(`/boards?${q}`, { token });
    out.push(...(page.items ?? []).map((b) => ({ id: b.id, name: b.name, privacy: b.privacy })));
    if (!page.bookmark) break;
    bookmark = page.bookmark;
  }
  return out;
}

export function createPin(token: string, pin: { boardId: string; title: string; description: string; altText: string; link: string; imageUrl: string }) {
  return call<{ id: string }>("/pins", {
    method: "POST",
    token,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ board_id: pin.boardId, title: pin.title, description: pin.description, alt_text: pin.altText, link: pin.link, media_source: { source_type: "image_url", url: pin.imageUrl } }),
  });
}
