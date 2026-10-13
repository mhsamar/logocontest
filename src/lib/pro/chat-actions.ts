"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import type { MessageKey } from "@/lib/i18n/translate";
import { notifyWithPush } from "@/lib/notifications/broadcast";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { chatContext, PRO_FILES_BUCKET } from "./chat";
import { messageFlags } from "./rules";
import { logProActivity } from "./subscription";

type Fail = { ok: false; error: MessageKey };
const FILE_MAX = 20 * 1024 * 1024;
const SAFE_NAME = /[^\p{L}\p{N}._ -]/gu;

/** A one-time link to upload a file into this chat (up to 20 MB). */
export async function prepareChatFile(input: { entryId: string; name: string; size: number }): Promise<{ ok: true; path: string; token: string } | Fail> {
  const user = await getCurrentUser();
  const ctx = await chatContext(input.entryId, user);
  if (!user || !ctx) return { ok: false, error: "pro.chat.errors.closed" };
  if (!(input.size > 0 && input.size <= FILE_MAX)) return { ok: false, error: "pro.chat.errors.fileSize" };
  const ext = (input.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  const path = `chat/${ctx.entryId}/${randomUUID()}.${ext}`;
  try {
    const up = await getFileStorage().createUploadUrl(PRO_FILES_BUCKET, path);
    return { ok: true, path: up.path, token: up.token };
  } catch {
    return { ok: false, error: "pro.chat.errors.generic" };
  }
}

/**
 * Sends a message in a contest chat. A message with a phone number, email, link or payment words is not sent at
 * first: the sender sees a warning and may change it or send it anyway; sent ones are kept with their flags and
 * logged for admins. No hiring: this chat is only about this contest and this design.
 */
export async function sendChatMessage(input: { entryId: string; body: string; file?: { path: string; name: string; size: number } | null; confirmed?: boolean }): Promise<{ ok: true } | { ok: false; warning: string[] } | Fail> {
  const user = await getCurrentUser();
  const ctx = await chatContext(input.entryId, user);
  if (!user || !ctx) return { ok: false, error: "pro.chat.errors.closed" };
  const body = (input.body ?? "").replace(/\r\n/g, "\n").trim().slice(0, 2000);
  const file = input.file && input.file.path.startsWith(`chat/${ctx.entryId}/`) ? input.file : null;
  if (!body && !file) return { ok: false, error: "pro.chat.errors.empty" };
  if (file && !(await getFileStorage().exists(PRO_FILES_BUCKET, file.path).catch(() => false))) return { ok: false, error: "pro.chat.errors.generic" };
  const flags = messageFlags(body);
  if (flags.length && !input.confirmed) return { ok: false, warning: flags };

  const { error } = await createAdminClient()
    .from("contest_messages")
    .insert({
      contest_id: ctx.contestId,
      entry_id: ctx.entryId,
      client_id: ctx.clientId,
      designer_id: ctx.designerId,
      sender_id: user.id,
      body,
      file_path: file?.path ?? null,
      file_name: file ? file.name.replace(SAFE_NAME, "").slice(0, 120) || "file" : null,
      file_size: file ? Math.max(0, Math.round(file.size)) : null,
      flags,
    });
  if (error) return { ok: false, error: "pro.chat.errors.generic" };
  if (flags.length) await logProActivity(user.id, "chat_flagged", ctx.designerId, null, { entry: ctx.entryId, flags });
  await notifyWithPush([ctx.other.id], "pro_message", { name: user.name, number: ctx.entryNumber, brand: ctx.brand }, `/dashboard/messages?entry=${ctx.entryId}`, user.id);
  refresh();
  return { ok: true };
}
