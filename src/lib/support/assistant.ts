import "server-only";
import { adminIdsWith } from "@/lib/admin/recipients";
import { translatorFor } from "@/lib/content/texts";
import { siteOrigin } from "@/lib/email";
import { isSupabaseConfigured } from "@/lib/env";
import { aiConfigured, callTool, textBlock } from "@/lib/logo-check/ai";
import { notifyWithPush } from "@/lib/notifications/broadcast";
import { siteUrl } from "@/lib/seo";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASSISTANT_TOOL, conversationText, dhakaMidnight, readAnswer, systemPrompt, wantsHuman, type ChatLine } from "./ai-rules";
import { pageList, personInfo, siteInfo } from "./knowledge";
import { preview } from "./rules";

/**
 * The AI support assistant (owner, 2026-10-15). It answers a support chat first; when a person is needed it says so
 * in the chat, the chat waits for the team ("Needs a person" in Admin › Support) and every support staff member gets a
 * bell and push. A staff member takes it and chats; the assistant stays quiet until the chat is closed or given back.
 */

export type ChatUser = { id: string; name: string; role: "client" | "designer"; locale: "en" | "bn"; emailVerifiedAt?: string | Date | null };

const db = () => createAdminClient();

/** The assistant answers when Settings › Support chat has it on and an AI key is set. */
export async function assistantOn(): Promise<boolean> {
  if (!aiConfigured()) return false;
  return (await getSettings(["support.ai_enabled"]))["support.ai_enabled"];
}

// What the site says about itself changes rarely: built at most every 10 minutes per server.
let info: { at: number; text: string } | null = null;
async function cachedSiteInfo(): Promise<string> {
  if (info && Date.now() - info.at < 600_000) return info.text;
  const text = await siteInfo();
  info = { at: Date.now(), text };
  return text;
}

async function origin(): Promise<string> {
  try {
    return process.env.SITE_URL ? siteUrl() : await siteOrigin();
  } catch {
    return siteUrl();
  }
}

/** The chat so far, for the AI. */
async function lines(threadId: string): Promise<ChatLine[]> {
  const { data } = await db().from("support_messages").select("from_admin, is_ai, body").eq("thread_id", threadId).order("created_at", { ascending: false }).limit(20);
  return (data ?? [])
    .reverse()
    .map((m) => ({ who: m.from_admin ? (m.is_ai ? "assistant" : "team") : "person", text: m.body as string }) as ChatLine);
}

async function postAi(threadId: string, text: string) {
  const { error } = await db().rpc("post_ai_message", { p_thread: threadId, p_body: text });
  if (error) throw new Error(error.message);
}

/** Hands the chat to the team: the assistant's last word, "Needs a person", and a bell + push for support staff. */
export async function handOver(threadId: string, user: ChatUser, reason: string, reply: string): Promise<void> {
  await postAi(threadId, reply).catch((e) => console.error("[support-ai] post:", e instanceof Error ? e.message : e));
  const { data: t } = await db().from("support_threads").select("unread_by_admin").eq("id", threadId).maybeSingle();
  await db()
    .from("support_threads")
    .update({ mode: "waiting", handed_over_at: new Date().toISOString(), handover_reason: reason.slice(0, 300), assigned_to: null, assigned_at: null, unread_by_admin: Math.max(1, (t?.unread_by_admin as number | undefined) ?? 0) })
    .eq("id", threadId);
  await notifyWithPush(await adminIdsWith("support.view"), "support_message_admin", { name: user.name, reason: preview(reason) }, `/admin/support?thread=${threadId}`, user.id);
}

/** The assistant's answer to the person's newest message. Never throws: a failure hands the chat to the team. */
export async function answerWithAi(threadId: string, user: ChatUser): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const t = await translatorFor(user.locale);
  try {
    const chat = await lines(threadId);
    const last = [...chat].reverse().find((l) => l.who === "person")?.text ?? "";
    // Asking for a person always reaches the team, without asking the AI.
    if (wantsHuman(last)) return handOver(threadId, user, "Asked to talk to a person.", t("support.ai.handedOver"));

    const limit = (await getSettings(["support.ai_daily_limit"]))["support.ai_daily_limit"];
    const { count } = await db().from("support_messages").select("id", { count: "exact", head: true }).eq("thread_id", threadId).eq("is_ai", true).gte("created_at", dhakaMidnight(new Date()).toISOString());
    if ((count ?? 0) >= limit) return handOver(threadId, user, "Reached the assistant's daily limit.", t("support.ai.limit"));

    const [site, person, base] = await Promise.all([cachedSiteInfo(), personInfo(user), origin()]);
    const system = systemPrompt({ role: user.role, siteInfo: site, person, pages: pageList(base) });
    const res = await callTool<unknown>(system, [textBlock(`CONVERSATION:\n${conversationText(chat)}\n\nWrite the assistant's next message to the person.`)], ASSISTANT_TOOL, 1200);
    const answer = readAnswer(res.data);
    if (!answer) throw new Error("The AI gave no usable answer");
    if (answer.handover) return handOver(threadId, user, answer.reason, answer.reply);
    await postAi(threadId, answer.reply);
    // Answered by the assistant: nothing for the team to read.
    await db().from("support_threads").update({ unread_by_admin: 0 }).eq("id", threadId).eq("mode", "ai");
  } catch (e) {
    console.error("[support-ai]", e instanceof Error ? e.message : e);
    await handOver(threadId, user, "The assistant could not answer (AI error).", t("support.ai.unavailable"));
  }
}
