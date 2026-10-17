import { NextResponse, type NextRequest } from "next/server";
import { clientPathFor, OLD_CLIENT_PATH } from "@/lib/client/rules";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateSession } from "@/lib/supabase/proxy";

const SIGNED_IN_ONLY = ["/admin"];

export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.next();

  const { response, userId, ended } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  // This login was signed out (owner, 2026-10-14): a page goes to the sign-in page with the reason; anything else just
  // carries on signed out.
  const isPage = request.method === "GET" && !pathname.startsWith("/api/") && (request.headers.get("accept") ?? "").includes("text/html");
  if (ended && isPage) {
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|apple-icon|icon$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
