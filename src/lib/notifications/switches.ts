import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { parseTierOff, type TierOff } from "@/lib/email/catalog";
import { getSettings } from "@/lib/settings";
import { channelOn, parseChannelsOff, typeOn, type Channel, type ChannelsOff } from "./admin-catalog";
import type { NotificationType } from "./types";

/** What the owner turned off in Admin › Notifications (owner, 2026-10-15). Read once per request. */
export async function channelsOff(): Promise<ChannelsOff> {
  if (!isSupabaseConfigured()) return {};
  try {
    return parseChannelsOff((await getSettings(["notifications.channels"]))["notifications.channels"]);
  } catch {
    return {};
  }
}

/** Designer emails turned off for Basic and for Pro designers (owner, 2026-10-15). */
export async function designerEmailsOff(): Promise<TierOff> {
  if (!isSupabaseConfigured()) return { basic: [], pro: [] };
  try {
    return parseTierOff((await getSettings(["notifications.designer_emails"]))["notifications.designer_emails"]);
  } catch {
    return { basic: [], pro: [] };
  }
}

/** Whether a row of Admin › Notifications goes out this way. */
export const noticeOn = async (id: string | undefined, channel: Channel) => channelOn(await channelsOff(), id, channel);

/** Whether this notification type goes out this way (bell or push). */
export const typeChannelOn = async (type: NotificationType, channel: Channel) => typeOn(await channelsOff(), type, channel);
