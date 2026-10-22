"use server";

import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { translatorFor } from "@/lib/content/texts";
import type { MessageKey } from "@/lib/i18n/translate";
import { notifyUser, pushIsMine, savePushSubscription, viewingAs } from "./index";

/**
 * "Phone notifications" (owner, 2026-10-22): anyone signed in turns on browser notifications on each phone or computer
 * they use (admins in the account menu, designers and clients in Settings and on the dashboard), then sends a test.
 */

/** The signed-in person, unless the Super admin is looking through their account ("Log in as"): the admin's own
 * phone must not start getting that person's notifications. */
async function me() {
  const user = await getCurrentUser();
  return user && !(await viewingAs(user.id)) ? user : null;
}

const isEndpoint = (endpoint: unknown): endpoint is string => typeof endpoint === "string" && endpoint.startsWith("https://") && endpoint.length <= 1000;

export async function savePushHere(subscription: unknown): Promise<boolean> {
  const user = await me();
  if (!user) return false;
  return savePushSubscription(user.id, subscription, (await headers()).get("user-agent"));
}

/** Whether this browser gets the signed-in person's notifications now (read only: never moves the subscription);
 * "viewing" while the Super admin looks through this account, where the switch is hidden. */
export async function pushStatusHere(endpoint: string | null): Promise<"mine" | "notMine" | "viewing"> {
  const user = await getCurrentUser();
  if (!user) return "notMine";
  if (await viewingAs(user.id)) return "viewing";
  return isEndpoint(endpoint) && (await pushIsMine(user.id, endpoint)) ? "mine" : "notMine";
}

const TEST: Record<string, { body: MessageKey; url: string }> = {
  admin: { body: "admin.push.testBody", url: "/admin" },
  designer: { body: "push.device.testDesigner", url: "/dashboard" },
  client: { body: "push.device.testClient", url: "/client" },
};

/** A test notification to this browser only. "none": it isn't saved for this person or can't be reached;
 * "driverOff": the server isn't set up to send them. */
export async function testPushHere(endpoint: string): Promise<"sent" | "none" | "driverOff"> {
  const user = await me();
  if (!user || !isEndpoint(endpoint)) return "none";
  if (process.env.PUSH_DRIVER !== "webpush" || !process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return "driverOff";
  const test = TEST[user.role] ?? TEST.client;
  const t = await translatorFor(user.locale);
  const sent = await notifyUser(user.id, { title: t("brand.name"), body: t(test.body), url: test.url }, endpoint);
  return sent > 0 ? "sent" : "none";
}
