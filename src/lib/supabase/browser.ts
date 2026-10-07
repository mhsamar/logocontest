"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Browser client, used only to upload to signed URLs created by the server. */
export function createBrowserSupabase() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
