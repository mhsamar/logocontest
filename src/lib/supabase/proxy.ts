import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const SEEN_COOKIE = "lc_seen";

/** Refreshes the Supabase session cookie and returns the signed-in user id, if any. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const userId = (data?.claims?.sub as string | undefined) ?? null;

  // "Last seen" for the home page's online count (migration 0037): at most once a minute per signed-in user. The
  // cookie keeps the time of the last mark so most requests skip the database; touch_last_seen checks the minute too.
  if (userId) {
    const now = Date.now();
    const seen = Number(request.cookies.get(SEEN_COOKIE)?.value?.split(":")[1]);
    if (request.cookies.get(SEEN_COOKIE)?.value?.split(":")[0] !== userId.slice(0, 8) || !(seen > now - 60_000 && seen <= now)) {
      await supabase.rpc("touch_last_seen").then(
        () => {},
        () => {},
      );
      response.cookies.set(SEEN_COOKIE, `${userId.slice(0, 8)}:${now}`, { path: "/", maxAge: 3600, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    }
  }

  return { response, userId };
}
