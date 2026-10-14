import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { cityFrom, deviceFromUserAgent, ipFrom } from "@/lib/auth/device";

const SEEN_COOKIE = "lc_seen";
/** When this login was last checked (owner, 2026-10-14: logins and devices): once a minute is enough. */
const SESSION_COOKIE = "lc_sess";

/**
 * Refreshes the Supabase session cookie and returns the signed-in user id, if any. Once a minute it also records this
 * login (device, browser, IP, place) and asks whether it was signed out: by the device limit, an admin, or, for staff,
 * being idle or closing every admin tab. Then `ended` says why and the cookies are cleared.
 */
export async function updateSession(request: NextRequest): Promise<{ response: NextResponse; userId: string | null; ended: string | null }> {
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
  const sessionId = (data?.claims?.session_id as string | undefined) ?? null;
  const secure = process.env.NODE_ENV === "production";

  let ended: string | null = null;
  if (userId && sessionId) {
    const now = Date.now();
    const [who, at] = (request.cookies.get(SESSION_COOKIE)?.value ?? "").split(":");
    if (who !== sessionId.slice(0, 8) || !(Number(at) > now - 60_000 && Number(at) <= now)) {
      const ua = request.headers.get("user-agent");
      const info = deviceFromUserAgent(ua);
      const { data: state, error } = await supabase.rpc("session_touch", {
        p_session: sessionId,
        p_ip: ipFrom(request.headers.get("x-forwarded-for"), request.headers.get("x-real-ip")),
        p_country: request.headers.get("x-vercel-ip-country"),
        p_city: cityFrom(request.headers.get("x-vercel-ip-city")),
        p_device: info.device,
        p_browser: info.browser,
        p_os: info.os,
        p_ua: ua ? ua.slice(0, 400) : null,
      });
      // Before migration 0055 the function doesn't exist: nothing changes.
      if (!error && typeof state === "string" && state.startsWith("ended")) {
        ended = state.split(":")[1] || "admin";
        await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
        response.cookies.delete("lc_as");
        return { response, userId: null, ended };
      }
      if (!error) response.cookies.set(SESSION_COOKIE, `${sessionId.slice(0, 8)}:${now}`, { path: "/", maxAge: 3600, httpOnly: true, sameSite: "lax", secure });
    }
  }

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
      response.cookies.set(SEEN_COOKIE, `${userId.slice(0, 8)}:${now}`, { path: "/", maxAge: 3600, httpOnly: true, sameSite: "lax", secure });
    }
  }

  return { response, userId, ended };
}
