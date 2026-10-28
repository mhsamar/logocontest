"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { askForPerson, loadMyChat, sendSupportMessage } from "@/lib/support/actions";
import type { SupportMessage, SupportThread } from "@/lib/support/queries";
import { useI18n } from "@/lib/i18n/client";
import { ChatView } from "./chat-view";

/**
 * S-01: the user's chat with support. Loads on open and checks for replies every 5 seconds. The AI assistant answers
 * first (owner, 2026-10-15); "Talk to a person" hands the chat to the team, and the line above the box says who has it.
 */
export function SupportChat({ initial, initialThread, initialAssistant, className }: { initial?: SupportMessage[]; initialThread?: SupportThread | null; initialAssistant?: boolean; className?: string }) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<SupportMessage[]>(initial ?? []);
  const [thread, setThread] = useState<SupportThread | null>(initialThread ?? null);
  const [assistant, setAssistant] = useState(initialAssistant ?? false);
  const [asking, ask] = useTransition();
  const reload = useCallback(async () => {
    const res = await loadMyChat();
    if (!res.ok) return;
    setMessages(res.messages);
    setThread(res.thread);
    setAssistant(res.assistant);
  }, []);
  useEffect(() => {
    const first = window.setTimeout(reload, initial ? 5000 : 0);
    // Only while the chat is in use (owner, 2026-10-28); coming back to the window checks at once.
    const id = window.setInterval(() => document.visibilityState === "visible" && document.hasFocus() && reload(), 5000);
    const onFocus = () => void reload();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [reload, initial]);

  // A new chat, or a closed one, starts with the assistant again.
  const mode = !thread || thread.status === "closed" ? "ai" : thread.mode;
  const withAi = assistant && mode === "ai";
  const above = withAi ? (
    <div className="flex items-center justify-between gap-2 border-t border-line bg-surface px-3 pt-2.5 text-[13px] text-muted">
      <span>✨ {t("support.ai.assistant")}</span>
      <button
        type="button"
        disabled={asking}
        onClick={() =>
          ask(async () => {
            await askForPerson();
            await reload();
          })
        }
        className="rounded-full px-3 py-1.5 font-bold text-primary ring-1 ring-primary/30 hover:bg-tint disabled:opacity-50"
      >
        {t("support.ai.talkToPerson")}
      </button>
    </div>
  ) : mode === "waiting" ? (
    <p className="m-0 border-t border-line bg-[#FFF8EC] px-3 py-2 text-[13px] font-semibold text-[#6B4A00]">{t("support.ai.waiting")}</p>
  ) : thread ? (
    <p className="m-0 border-t border-line bg-surface px-3 py-2 text-[13px] text-muted">{t("support.ai.withTeam")}</p>
  ) : null;

  return (
    <ChatView
      className={className}
      messages={messages}
      side="user"
      emptyText={assistant ? t("support.ai.hello") : t("support.empty")}
      typing={withAi}
      above={above}
      send={async (body) => {
        const res = await sendSupportMessage(body);
        if (!res.ok) return res.error;
        await reload();
        return null;
      }}
    />
  );
}
