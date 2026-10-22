"use server";

import { headers } from "next/headers";
import { adminUser } from "@/lib/admin/core";
import { translatorFor } from "@/lib/content/texts";
import { notifyUser, savePushSubscription } from "@/lib/push";

/**
 * "Phone notifications" in the admin account menu (owner, 2026-10-22): staff turn on browser notifications on each
 * phone or computer they use, so payments and withdrawals to check reach them at once.
 */
export async function saveAdminPush(subscription: unknown): Promise<boolean> {
  const me = await adminUser();
  if (!me) return false;
  return savePushSubscription(me.id, subscription, (await headers()).get("user-agent"));
}

/** A test notification to this browser only. "none": it isn't saved for this admin or it can't be reached;
 * "driverOff": the server isn't set up to send them. */
export async function testAdminPush(endpoint: string): Promise<"sent" | "none" | "driverOff"> {
  const me = await adminUser();
  if (!me || typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 1000) return "none";
  if (process.env.PUSH_DRIVER !== "webpush" || !process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return "driverOff";
  const t = await translatorFor(me.locale);
  const sent = await notifyUser(me.id, { title: t("brand.name"), body: t("admin.push.testBody"), url: "/admin" }, endpoint);
  return sent > 0 ? "sent" : "none";
}
