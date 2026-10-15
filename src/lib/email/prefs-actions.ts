"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { readUnsubscribe, setEmailOff, setOneEmail } from "./prefs";

/** Email settings on the profile page: the emails the logged-in person turned off. */
export async function saveEmailPrefs(off: string[]): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !Array.isArray(off)) return { ok: false };
  const ok = await setEmailOff(user.id, off);
  if (ok) refresh();
  return { ok };
}

/** The Unsubscribe link's page: no login, the signed link is enough. `on` true undoes it. */
export async function setFromLink(input: { u: string; k: string; s: string; on: boolean }): Promise<{ ok: boolean }> {
  const who = readUnsubscribe(input.u, input.k, input.s);
  if (!who) return { ok: false };
  return { ok: await setOneEmail(who.userId, who.key, input.on) };
}
