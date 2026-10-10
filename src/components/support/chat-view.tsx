"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { SupportMessage } from "@/lib/support/queries";
import { MESSAGE_MAX } from "@/lib/support/rules";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";

/**
 * One support conversation (S-01, A-24). `side` decides whose messages sit on the right.
 * `send` returns an error key or null; the parent reloads the messages afterwards.
 */
export function ChatView({
  messages,
  side,
  send,
  canSend = true,
  emptyText,
  className,
}: {
  messages: SupportMessage[];
  side: "user" | "admin";
  send: (body: string) => Promise<MessageKey | null>;
  canSend?: boolean;
  emptyText: string;
  className?: string;
}) {
  const { t, locale } = useI18n();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, run] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const count = messages.length;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [count]);

  const time = (iso: string) => new Date(iso).toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" });
  const submit = () =>
    run(async () => {
      setError(null);
      const err = await send(text);
      if (err) return setError(t(err));
      setText("");
    });

  return (
    <div className={cx("flex min-h-0 flex-col", className)}>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {count === 0 && <p className="py-8 text-center text-sm text-muted">{emptyText}</p>}
        {messages.map((m) => {
          const mine = side === "admin" ? m.fromAdmin : !m.fromAdmin;
          return (
            <div key={m.id} className={cx("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cx("max-w-[85%] rounded-[18px] px-4 py-2.5 text-[15px]", mine ? "rounded-br-md bg-[image:var(--gradient-red)] text-white" : "rounded-bl-md border border-line bg-surface text-ink")}>
                {m.fromAdmin && side === "user" && <p className="mb-0.5 text-xs font-bold text-primary">{m.broadcast ? t("support.fromTeam") : t("support.team")}</p>}
                {m.fromAdmin && side === "admin" && m.senderName && <p className="mb-0.5 text-xs font-semibold opacity-80">{m.senderName}</p>}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={cx("mt-1 text-[0.6875rem]", mine ? "text-white/70" : "text-muted")}>{time(m.createdAt)}</p>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      {canSend && (
        <form
          className="border-t border-line bg-surface p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) submit();
          }}
        >
          {error && (
            <div className="mb-2">
              <Alert tone="danger">{error}</Alert>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  if (text.trim()) submit();
                }
              }}
              rows={Math.min(5, Math.max(1, text.split("\n").length))}
              maxLength={MESSAGE_MAX}
              placeholder={t(side === "admin" ? "admin.support.replyPlaceholder" : "support.placeholder")}
              aria-label={t(side === "admin" ? "admin.support.reply" : "support.placeholder")}
              className="min-h-11 flex-1 resize-none rounded-[14px] bg-chip px-3.5 py-2.5 text-[15px] text-ink ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button type="submit" loading={busy} disabled={!text.trim()}>
              {t("support.send")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
