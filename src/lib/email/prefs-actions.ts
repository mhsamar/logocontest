"use server";

import { readUnsubscribe, setOneEmail } from "./prefs";

/** The Unsubscribe link's page: no login, the signed link is enough. `on` true undoes it. */
export async function setFromLink(input: { u: string; k: string; s: string; on: boolean }): Promise<{ ok: boolean }> {
  const who = readUnsubscribe(input.u, input.k, input.s);
  if (!who) return { ok: false };
  return { ok: await setOneEmail(who.userId, who.key, input.on) };
}
