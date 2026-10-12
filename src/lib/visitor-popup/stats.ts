import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PopupEvent } from "./rules";

export const POPUP_RANGES = [7, 30, 90] as const;
export type PopupRange = (typeof POPUP_RANGES)[number];
export const readPopupRange = (v: unknown): PopupRange => (POPUP_RANGES as readonly number[]).includes(Number(v)) ? (Number(v) as PopupRange) : 7;

export type PopupStats = {
  /** False until migration 0044 has made the table and the column. */
  ready: boolean;
  shown: number;
  clickClient: number;
  clickDesigner: number;
  closed: number;
  never: number;
  signupClients: number;
  signupDesigners: number;
  /** Oldest first, one entry per day (Dhaka time). */
  days: { day: string; shown: number; signups: number }[];
};

const dhakaDay = (d: Date) => new Date(d.getTime() + 6 * 3_600_000).toISOString().slice(0, 10);

/** Admin Analytics card (owner, 2026-10-13): pop-up events and the sign-ups that started from it. */
export async function popupStats(range: PopupRange, now = new Date()): Promise<PopupStats> {
  const days = Array.from({ length: range }, (_, i) => dhakaDay(new Date(now.getTime() - (range - 1 - i) * 86_400_000)));
  const empty: PopupStats = { ready: false, shown: 0, clickClient: 0, clickDesigner: 0, closed: 0, never: 0, signupClients: 0, signupDesigners: 0, days: days.map((day) => ({ day, shown: 0, signups: 0 })) };
  if (!isSupabaseConfigured()) return empty;
  // From the start of the first day, Dhaka time.
  const since = new Date(`${days[0]}T00:00:00+06:00`).toISOString();
  const db = createAdminClient();
  const [events, people] = await Promise.all([
    db.from("popup_events").select("event, created_at").gte("created_at", since).order("created_at").limit(50_000),
    db.from("profiles").select("role, created_at").eq("signup_source", "popup").gte("created_at", since).limit(10_000),
  ]);
  if (events.error || people.error) return empty;

  const out: PopupStats = { ...empty, ready: true, days: days.map((day) => ({ day, shown: 0, signups: 0 })) };
  const byDay = new Map(out.days.map((d) => [d.day, d]));
  const count: Record<PopupEvent, number> = { popup_shown: 0, popup_click_client: 0, popup_click_designer: 0, popup_closed: 0, popup_never: 0 };
  for (const e of events.data ?? []) {
    const k = e.event as PopupEvent;
    if (k in count) count[k] += 1;
    if (k === "popup_shown") {
      const d = byDay.get(dhakaDay(new Date(e.created_at as string)));
      if (d) d.shown += 1;
    }
  }
  for (const p of people.data ?? []) {
    if (p.role === "designer") out.signupDesigners += 1;
    else out.signupClients += 1;
    const d = byDay.get(dhakaDay(new Date(p.created_at as string)));
    if (d) d.signups += 1;
  }
  return {
    ...out,
    shown: count.popup_shown,
    clickClient: count.popup_click_client,
    clickDesigner: count.popup_click_designer,
    closed: count.popup_closed,
    never: count.popup_never,
  };
}

/** Sign-ups ÷ shown, in percent with one decimal (0 when it was never shown). */
export const conversionPercent = (signups: number, shown: number) => (shown > 0 ? Math.round((signups / shown) * 1000) / 10 : 0);
