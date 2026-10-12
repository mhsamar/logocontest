"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import { postHandoverMessage } from "@/lib/handover/actions";
import { useI18n } from "@/lib/i18n/client";

type Message = { id: string; body: string; createdAt: string; mine: boolean; fromClient: boolean; author: string };

/**
 * The delivery chat (owner, 2026-10-12): the client writes what to change, the designer answers and sends the files
 * again, as often as needed until the client approves. Read-only once the files are approved.
 */
export function HandoverChat({ handoverId, messages, open, viewer }: { handoverId: string; messages: Message[]; open: boolean; viewer: "client" | "designer" }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const when = (iso: string) => new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" }).format(new Date(iso));

  const send = () =>
    start(async () => {
      setError(null);
      const res = await postHandoverMessage({ handoverId, body });
      if (!res.ok) return setError(t(res.error.key, res.error.params));
      setBody("");
      router.refresh();
    });

  return (
    <section aria-labelledby={`chat-${handoverId}`} className="space-y-3">
      <div>
        <h3 id={`chat-${handoverId}`} className="m-0 text-lg font-semibold text-ink">
          {t("handover.chat.title")}
        </h3>
        <p className="m-0 mt-0.5 text-sm text-muted">{open ? t(viewer === "client" ? "handover.chat.leadClient" : "handover.chat.leadDesigner") : t("handover.chat.closedNote")}</p>
      </div>
      {messages.length === 0 ? (
        <p className="m-0 rounded-2xl bg-chip px-4 py-3 text-sm text-muted">{t("handover.chat.empty")}</p>
      ) : (
        <ol className="m-0 flex max-h-[420px] list-none flex-col gap-2 overflow-y-auto p-0">
          {messages.map((m) => (
            <li key={m.id} className={cx("flex", m.mine ? "justify-end" : "justify-start")}>
              <div className={cx("max-w-[85%] rounded-2xl px-3.5 py-2.5", m.mine ? "bg-[#FBECEB] text-ink" : "bg-chip text-ink")}>
                <p className="m-0 text-[12.5px] font-bold text-muted">
                  {m.mine ? t("handover.chat.you") : `${m.author} · ${t(m.fromClient ? "handover.chat.client" : "handover.chat.designer")}`} · {when(m.createdAt)}
                </p>
                <p className="m-0 mt-0.5 whitespace-pre-line break-words text-[15px]">{m.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {open && (
        <div className="space-y-2">
          <label className="sr-only" htmlFor={`chat-box-${handoverId}`}>
            {t("handover.chat.placeholder")}
          </label>
          <textarea
            id={`chat-box-${handoverId}`}
            rows={3}
            maxLength={1000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("handover.chat.placeholder")}
            className="w-full resize-y rounded-xl border border-[#DCDEE3] bg-white px-3 py-2.5 text-[15px] text-ink focus:outline-2 focus:outline-offset-1 focus:outline-primary"
          />
          {error && <Alert tone="danger">{error}</Alert>}
          <Button onClick={send} loading={busy} disabled={!body.trim()}>
            {t("handover.chat.send")}
          </Button>
        </div>
      )}
    </section>
  );
}
