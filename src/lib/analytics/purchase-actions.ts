"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { viewingAs } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { freshPurchase } from "./meta-pixel";

/**
 * Meta Pixel Purchase (owner, 2026-10-24): may this browser send the Purchase for this contest payment? Yes only for
 * the paying client themself (not staff using "Log in as"), a real paid contest payment (not a QA test code), within
 * 48 hours, and only once across all their devices (payments.pixel_sent_at, migration 0074).
 */
export async function claimPurchasePixel(paymentId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !/^[0-9a-f-]{36}$/i.test(paymentId)) return false;
  const user = await getCurrentUser();
  if (!user || user.role !== "client" || (await viewingAs(user.id))) return false;
  const db = createAdminClient();
  const { data: p } = await db.from("payments").select("client_id, purpose, status, paid_at, raw_response").eq("id", paymentId).maybeSingle();
  if (!p || p.client_id !== user.id || p.purpose !== "contest" || p.status !== "paid") return false;
  if (!freshPurchase(p.paid_at ? new Date(p.paid_at as string) : null)) return false;
  // A QA transaction ID: the flow was tested, no money came in.
  if ((p.raw_response as Record<string, unknown> | null)?.qa === "1") return false;
  const { data, error } = await db.from("payments").update({ pixel_sent_at: new Date().toISOString() }).eq("id", paymentId).is("pixel_sent_at", null).select("id").maybeSingle();
  // Before migration 0074 there is no column yet: then only this browser's own guard applies.
  if (error) return error.code === "PGRST204" || error.code === "42703";
  return Boolean(data);
}
