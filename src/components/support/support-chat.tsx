"use client";

import { useCallback, useEffect, useState } from "react";
import { loadMyChat, sendSupportMessage } from "@/lib/support/actions";
import type { SupportMessage } from "@/lib/support/queries";
import { useI18n } from "@/lib/i18n/client";
import { ChatView } from "./chat-view";

/** S-01: the user's chat with the team. Loads on open and checks for replies every 5 seconds. */
export function SupportChat({ initial, className }: { initial?: SupportMessage[]; className?: string }) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<SupportMessage[]>(initial ?? []);
  const reload = useCallback(async () => {
    const res = await loadMyChat();
    if (res.ok) setMessages(res.messages);
  }, []);
  useEffect(() => {
    const first = window.setTimeout(reload, initial ? 5000 : 0);
    const id = window.setInterval(() => document.visibilityState === "visible" && reload(), 5000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [reload, initial]);
  return (
    <ChatView
      className={className}
      messages={messages}
      side="user"
      emptyText={t("support.empty")}
      send={async (body) => {
        const res = await sendSupportMessage(body);
        if (!res.ok) return res.error;
        await reload();
        return null;
      }}
    />
  );
}
