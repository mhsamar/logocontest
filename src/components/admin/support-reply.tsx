"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ChatView } from "@/components/support/chat-view";
import { markThreadRead, replySupport, setThreadStatus } from "@/lib/support/actions";
import type { SupportMessage } from "@/lib/support/queries";
import { useI18n } from "@/lib/i18n/client";
import { useReadOnly } from "./read-only";

/** A-24: the open conversation, with reply box and Close / Reopen. */
export function SupportThreadPanel({ threadId, status, messages }: { threadId: string; status: "open" | "closed"; messages: SupportMessage[] }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const router = useRouter();
  const [busy, run] = useTransition();
  const count = messages.length;
  useEffect(() => {
    void markThreadRead(threadId);
  }, [threadId, count]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {readOnly ? (
        <p className="border-b border-line bg-[#fff7e0] px-4 py-2 text-xs text-[#7a5300]">{t("admin.support.noAccess")}</p>
      ) : (
        <div className="flex justify-end border-b border-line px-3 py-2">
          <Button
            variant="secondary"
            loading={busy}
            onClick={() =>
              run(async () => {
                await setThreadStatus(threadId, status === "open" ? "closed" : "open");
                router.refresh();
              })
            }
          >
            {t(status === "open" ? "admin.support.closeThread" : "admin.support.reopen")}
          </Button>
        </div>
      )}
      <ChatView
        className="min-h-0 flex-1"
        messages={messages}
        side="admin"
        canSend={!readOnly}
        emptyText=""
        send={async (body) => {
          const res = await replySupport(threadId, body);
          if (!res.ok) return res.error;
          router.refresh();
          return null;
        }}
      />
    </div>
  );
}
