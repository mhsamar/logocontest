import "server-only";

/**
 * Whether a Google Drive link opens for anyone (owner, 2026-10-11). A file or folder shared as "Anyone with the
 * link" opens without signing in; a private one sends the visitor to Google sign-in; a wrong one is "not found".
 * When Google can't be reached the link is accepted, so a network hiccup never blocks the winner.
 */
export async function driveLinkAccess(url: string, hops = 0): Promise<"public" | "private" | "missing" | "unknown"> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; logocontest.bd link check)" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    await res.body?.cancel().catch(() => {});
    if (res.status >= 200 && res.status < 300) return "public";
    if (res.status === 404) return "missing";
    if (res.status >= 300 && res.status < 400) {
      const to = res.headers.get("location") ?? "";
      if (/accounts\.google\.com|ServiceLogin/i.test(to)) return "private";
      // Google moves some links to their usual address (e.g. open?id= to file/d/); follow that once.
      if (hops < 2 && /^https:\/\/(drive|docs)\.google\.com\//.test(to)) return driveLinkAccess(to, hops + 1);
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}
