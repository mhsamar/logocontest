import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing route for the emailed password-reset link. Exchanges Supabase's
 * one-time token for a session, then shows "Set a new password".
 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const fail = new URL("/forgot-password?expired=1", request.url);
  if (!tokenHash || type !== "recovery") return NextResponse.redirect(fail);

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
  if (error) return NextResponse.redirect(fail);
  return NextResponse.redirect(new URL("/reset-password", request.url));
}
