import { NextResponse, type NextRequest } from "next/server";
import { SHORT_LINK } from "@/lib/cards/rules";
import { clientPathFor, OLD_CLIENT_PATH } from "@/lib/client/rules";
import { isSupabaseConfigured } from "@/lib/env";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { isLocalizedPath, LANG_PARAM, langOf, localizedPath, LOCALE_HEADER, splitLangPath } from "@/lib/i18n/lang-path";
import { NO_PIXEL_HEADER, noPixelPath } from "@/lib/analytics/meta-pixel";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateSession } from "@/lib/supabase/proxy";

const SIGNED_IN_ONLY = ["/admin"];

/**
 * Languages by address (owner, 2026-11-03): a public page is always Bangla at its plain address and always English
 * under /en, which is served here from the same page, for every visitor and search engine. Nobody is redirected by
 * country, IP or cookie; a visitor who may want English sees a "View in English" bar instead (EnglishHint). An old
 * ?lang= address moves to the clean one (301 for public pages). Pages without an /en address follow the cookie.
 */
// Private areas never read ?lang= (Admin › Legal uses it for the document's language); their switches use the cookie.
const NO_LANG_PARAM = /^\/(api|admin|admin-login|client|dashboard)(\/|$)/;
const YEAR = 60 * 60 * 24 * 365;

const keepLanguage = (response: NextResponse, locale: string) => {
  response.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: YEAR, sameSite: "lax" });
  return response;
};

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const { locale: prefixed, path } = splitLangPath(pathname);
  const localized = isLocalizedPath(path);
  const reading = request.method === "GET";

  // ?lang=bn / ?lang=en: on to the clean address, and the choice is kept.
  const asked = reading && !NO_LANG_PARAM.test(path) ? langOf(searchParams) : null;
  if (asked) {
    const rest = new URLSearchParams(searchParams);
    rest.delete(LANG_PARAM);
    const q = rest.toString();
    const to = localized ? localizedPath(`${path}${q ? `?${q}` : ""}`, asked) : `${path}${q ? `?${q}` : ""}`;
    return keepLanguage(NextResponse.redirect(new URL(to, request.url), localized ? 301 : 307), asked);
  }
  // /en on a page that has no English address: the page itself, in English.
  if (prefixed && !localized) return keepLanguage(NextResponse.redirect(new URL(`${path}${request.nextUrl.search}`, request.url), 307), "en");
  const lang = localized ? (prefixed ?? "bn") : null;
  if (lang) request.headers.set(LOCALE_HEADER, lang);
  else request.headers.delete(LOCALE_HEADER);
  // Pages that never get the Meta Pixel (Admin, signed unsubscribe links); the root layout reads this.
  if (noPixelPath(path)) request.headers.set(NO_PIXEL_HEADER, "1");
  else request.headers.delete(NO_PIXEL_HEADER);
  let response = await route(request, path, lang);
  // The English address is drawn by the same page as the Bangla one.
  if (prefixed && !response.headers.get("location")) {
    const rewrite = NextResponse.rewrite(new URL(`${path}${request.nextUrl.search}`, request.url), { request: { headers: request.headers } });
    for (const c of response.cookies.getAll()) rewrite.cookies.set(c);
    response = rewrite;
  }
  // Only a page opened in the browser keeps the language, never Next.js fetching a link ahead of time (those don't ask
  // for HTML). A browser's own early load of a Google result does count: its cookie is kept only if it is opened.
  const opened = (request.headers.get("accept") ?? "").includes("text/html");
  // Only English is remembered this way: a Bangla page is also what everyone lands on, not a choice.
  if (prefixed && reading && opened && request.cookies.get(LOCALE_COOKIE)?.value !== "en") keepLanguage(response, "en");
  return response;
}

async function route(request: NextRequest, pathname: string, lang: "en" | "bn" | null): Promise<NextResponse> {
  if (!isSupabaseConfigured()) return NextResponse.next({ request });

  const { response, userId, ended } = await updateSession(request);
  const { search } = request.nextUrl;

  // The short link on contest cards (owner, 2026-10-19): /c/LC-0012 opens contest number 12. Client profiles
  // (/c/<username>) never look like this, so they are untouched.
  const short = request.method === "GET" ? SHORT_LINK.exec(pathname) : null;
  if (short) {
    const { data: c } = await createAdminClient().from("contests").select("slug").eq("contest_number", Number(short[1])).maybeSingle();
    // In the address's language, so an English card's link (/en/c/LC-0012) opens the English page.
    if (c?.slug) return NextResponse.redirect(new URL(localizedPath(`/contest/${c.slug}`, lang ?? "bn"), request.url), 307);
  }

  // This login was signed out (owner, 2026-10-14): a page goes to the sign-in page with the reason; anything else just
  // carries on signed out.
  const isPage = request.method === "GET" && !pathname.startsWith("/api/") && (request.headers.get("accept") ?? "").includes("text/html");
  // Not a resume link (owner, 2026-10-26): it signs the client in by itself, without the sign-in page.
  if (ended && isPage && !pathname.startsWith("/r/")) {
    const url = request.nextUrl.clone();
    const admin = pathname === "/admin" || pathname.startsWith("/admin/");
    url.pathname = admin ? "/admin-login" : "/login";
    url.search = `?ended=${encodeURIComponent(ended)}&next=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(url);
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }

  // A signed-in client opening an old address (a notification, an email, a bookmark) goes straight to the client
  // workspace (owner, 2026-10-17): before, the old page drew the site's menu and footer, then moved on.
  // The home page too: a signed-in client's home is their workspace dashboard.
  if (userId && isPage && (OLD_CLIENT_PATH.test(pathname) || pathname === "/")) {
    const { data: me } = await createAdminClient().from("profiles").select("role").eq("id", userId).maybeSingle();
    const to = me?.role === "client" ? (pathname === "/" ? "/client" : clientPathFor(pathname + search)) : null;
    if (to && to !== pathname + search) {
      const redirect = NextResponse.redirect(new URL(to, request.url));
      for (const c of response.cookies.getAll()) redirect.cookies.set(c);
      return redirect;
    }
  }

  // A logged-out visitor opening the client workspace goes to the client login at once (QA, 2026-10-18): before, the
  // page drew nothing for a second and then moved on.
  if (!userId && isPage && (pathname === "/client" || pathname.startsWith("/client/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?as=client&next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  // Optimistic check only. Real authorization happens in each page via policies.
  if (!userId && SIGNED_IN_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    // The admin panel has its own sign-in page (owner, 2026-10-10).
    url.pathname = pathname === "/admin" || pathname.startsWith("/admin/") ? "/admin-login" : "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Not the picture routes (owner, 2026-10-27): they need no login, and the CDN keeps them. Nor (owner, 2026-10-28:
  // every run is billed) the background pings, jobs, webhooks and files for search engines: each checks its own login
  // or secret, and none needs the ?lang= or Pixel headers.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|apple-icon|icon$|api/img/|api/avatar/|api/email/image/|api/site-img/|api/track$|api/wizard/live$|api/live-designers$|api/cron/|api/cards/win/|api/cards/monthly/|api/payments/stripe/|api/email/ses-events$|api/popup-event$|api/pro/view$|api/pro/event$|.*opengraph-image|sitemap\\.xml$|robots\\.txt$|llms\\.txt$|ads\\.txt$|.*\\.webmanifest$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
