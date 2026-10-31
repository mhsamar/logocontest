import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { parseTierOff, type TierOff } from "@/lib/email/catalog";
import { getSettings } from "@/lib/settings";
import { channelOn, parseChannelsOff, parseRoleEmailsOff, typeOn, type Channel, type ChannelsOff, type RoleEmailsOff } from "./admin-catalog";
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

/** Emails of notices for everyone turned off for clients or for designers (owner, 2026-10-31). */
export async function roleEmailsOff(): Promise<RoleEmailsOff> {
  if (!isSupabaseConfigured()) return { client: [], designer: [] };
  try {
    return parseRoleEmailsOff((await getSettings(["notifications.role_emails"]))["notifications.role_emails"]);
  } catch {
    return { client: [], designer: [] };
  }
}

/** Whether a row of Admin › Notifications goes out this way; for an email, to a person with this role. */
export const noticeOn = async (id: string | undefined, channel: Channel, role?: string | null) =>
  channelOn(await channelsOff(), id, channel, role === undefined ? undefined : { off: await roleEmailsOff(), role });

/** Whether this notification type goes out this way (bell or push). */
export const typeChannelOn = async (type: NotificationType, channel: Channel) => typeOn(await channelsOff(), type, channel);
