import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
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

/** Whether a row of Admin › Notifications goes out this way. */
export const noticeOn = async (id: string | undefined, channel: Channel) => channelOn(await channelsOff(), id, channel);

/** Whether this notification type goes out this way (bell or push). */
export const typeChannelOn = async (type: NotificationType, channel: Channel) => typeOn(await channelsOff(), type, channel);
