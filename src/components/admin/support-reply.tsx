"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ChatView } from "@/components/support/chat-view";
import { assignThread, backToAssistant, markThreadRead, replySupport, setThreadStatus } from "@/lib/support/actions";
import type { SupportMessage, SupportThread } from "@/lib/support/queries";
import { useI18n } from "@/lib/i18n/client";
import { useReadOnly } from "./read-only";
import { ADM_INPUT } from "./ui";

/**
 * A-24: the open conversation, with reply box and Close / Reopen. AI assistant (owner, 2026-10-15): who has the chat,
 * why the AI handed it over, "Assign to me", "Assign to…" a colleague, and "Give back to AI".
 */
export function SupportThreadPanel({ thread, messages, staff, meId }: { thread: SupportThread; messages: SupportMessage[]; staff: { id: string; name: string }[]; meId: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const readOnly = useReadOnly();
  const router = useRouter();
  const [busy, run] = useTransition();
  const threadId = thread.id;
  const count = messages.length;
  useEffect(() => {
    void markThreadRead(threadId);
  }, [threadId, count]);
  const act = (fn: () => Promise<{ ok: boolean; error?: unknown }>, done?: string) =>
    run(async () => {
      const res = await fn();
      if (!res.ok) return toast(t((res as { error: Parameters<typeof t>[0] }).error), "danger");
      if (done) toast(done);
      router.refresh();
    });
  const open = thread.status === "open";
  const mineNow = thread.mode === "human" && thread.assignedTo === meId;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {open && (thread.mode !== "human" || thread.handoverReason) && (
        <div className="border-b border-line bg-surface px-4 py-2 text-[13px]">
          {thread.mode === "ai" && <p className="m-0 text-[#6D28D9]">✨ {t("admin.support.aiHas")}</p>}
          {thread.mode === "waiting" && <p className="m-0 font-bold text-[#B45309]">{t("admin.support.modes.waiting")}</p>}
          {thread.handoverReason && thread.mode !== "ai" && <p className="m-0 text-muted">{t("admin.support.why", { reason: thread.handoverReason })}</p>}
        </div>
      )}
      {readOnly ? (
        <p className="border-b border-line bg-[#fff7e0] px-4 py-2 text-xs text-[#7a5300]">{t("admin.support.noAccess")}</p>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-line px-3 py-2">
          {open && thread.mode === "human" && thread.assignedName && <span className="mr-auto text-[13px] font-semibold text-muted">{t("admin.support.modes.human", { name: thread.assignedName })}</span>}
          {open && !mineNow && (
            <Button variant="secondary" loading={busy} onClick={() => act(() => assignThread(threadId, "me"))}>
              {t("admin.support.assignToMe")}
            </Button>
          )}
          {open && staff.length > 1 && (
            <select
              aria-label={t("admin.support.assignTo")}
              value=""
              disabled={busy}
              onChange={(e) => {
                const to = e.target.value;
                const name = staff.find((s) => s.id === to)?.name ?? "";
                if (to) act(() => assignThread(threadId, to), t("admin.support.assigned", { name }));
              }}
              className={`${ADM_INPUT} !min-h-10 !w-auto max-w-[14rem]`}
            >
              <option value="">{t("admin.support.assignTo")}</option>
              {staff
                .filter((s) => s.id !== thread.assignedTo)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          )}
          {open && thread.mode !== "ai" && (
            <Button variant="ghost" loading={busy} onClick={() => act(() => backToAssistant(threadId))}>
              ✨ {t("admin.support.backToAi")}
            </Button>
          )}
          <Button variant="secondary" loading={busy} onClick={() => act(() => setThreadStatus(threadId, open ? "closed" : "open"))}>
            {t(open ? "admin.support.closeThread" : "admin.support.reopen")}
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
