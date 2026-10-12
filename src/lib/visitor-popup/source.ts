import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { SOURCE_COOKIE, SOURCE_POPUP } from "./rules";

/**
 * Sign-ups that started from the visitor pop-up (owner, 2026-10-13). The pop-up buttons set a first-party cookie for
 * this visit (and add ?src=popup to the link); the account actions read it once, here, and clear it.
 */
export async function takeSignupSource(): Promise<typeof SOURCE_POPUP | null> {
  const jar = await cookies();
  if (jar.get(SOURCE_COOKIE)?.value !== SOURCE_POPUP) return null;
  try {
    jar.delete(SOURCE_COOKIE);
  } catch {
    // Only server actions may change cookies; reading is enough elsewhere.
  }
  return SOURCE_POPUP;
}

/** Saves where the new account came from. Never blocks sign-up (before migration 0044 the column doesn't exist). */
export async function saveSignupSource(userId: string, source: string | null): Promise<void> {
  if (!source) return;
  const { error } = await createAdminClient().from("profiles").update({ signup_source: source }).eq("id", userId);
  if (error) console.warn("[popup] signup source not saved:", error.message);
}
