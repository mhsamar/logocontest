"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { COMPRESS, compressImage, isCompressible } from "@/lib/images/compress";
import { useI18n } from "@/lib/i18n/client";
import { prepareChatFile, sendChatMessage } from "@/lib/pro/chat-actions";
import type { ChatMessage } from "@/lib/pro/chat";
import { Icon } from "./parts";

const FLAG_KEYS = ["phone", "email", "link", "payment"] as const;

/**
 * One contest chat (owner, 2026-10-13; Design/pro/pro-messages.html): the messages, a file, and the composer. A message
 * with contact or payment details gets a warning first; the sender can edit it or send it anyway (it is logged).
 * New messages arrive by refreshing every 15 seconds while the page is open.
 */
export function ChatThread({ entryId, messages }: { entryId: string; messages: ChatMessage[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [file, setFile] = useState<{ path: string; name: string; size: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [warning, setWarning] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 15_000);
    return () => window.clearInterval(id);
  }, [router]);

  const upload = async (picked: File) => {
    setError(null);
    setUploading(true);
    try {
      // Pictures are made light first (owner, 2026-10-14); other files go as they are.
      const f = isCompressible(picked) ? await compressImage(picked, COMPRESS.picture) : picked;
      const prep = await prepareChatFile({ entryId, name: f.name, size: f.size });
      if (!prep.ok) return setError(t(prep.error));
      const { error: up } = await createBrowserSupabase().storage.from("pro-files").uploadToSignedUrl(prep.path, prep.token, f, { contentType: f.type || "application/octet-stream" });
      if (up) return setError(t("pro.chat.errors.generic"));
      setFile({ path: prep.path, name: f.name, size: f.size });
    } finally {
      setUploading(false);
    }
  };

  const send = (confirmed: boolean) =>
    start(async () => {
      setError(null);
      const res = await sendChatMessage({ entryId, body, file, confirmed });
      if ("warning" in res) return setWarning(res.warning);
      if (!res.ok) return setError(t(res.error));
      setBody("");
      setFile(null);
      setWarning(null);
      router.refresh();
    });

  const time = (iso: string) => new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" }).format(new Date(iso));
  const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  const what = (warning ?? [])
    .filter((f): f is (typeof FLAG_KEYS)[number] => (FLAG_KEYS as readonly string[]).includes(f))
    .map((f) => t(`pro.chat.flags.${f}`))
    .join(", ");

  return (
    <>
      <div className="pr-msgs" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={`pr-m${m.mine ? " out" : ""}`}>
            {m.flags.length > 0 && <span className="flag">{t("pro.chat.flagged")}</span>}
            {m.body && <p>{m.body}</p>}
            {m.file && (
              <a className="file" href={m.file.url ?? "#"} target="_blank" rel="noreferrer" download={m.file.name}>
                <Icon name="file" size={20} />
                <span>
                  {m.file.name} · {kb(m.file.size)}
                </span>
                <Icon name="download" size={16} />
              </a>
            )}
            <em>
              {time(m.at)}
              {m.mine && m.read ? ` · ${t("pro.chat.seen")}` : ""}
            </em>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="pr-cmp">
        {warning && (
          <div className="pr-warn" role="alert">
            <b>{t("pro.chat.warnTitle")}</b>
            <span>{t("pro.chat.warnLead", { what })}</span>
            <div className="row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="pr-out sm" onClick={() => setWarning(null)}>
                {t("pro.chat.edit")}
              </button>
              <button type="button" className="pr-btn sm" onClick={() => send(true)} disabled={busy}>
                {t("pro.chat.sendAnyway")}
              </button>
            </div>
          </div>
        )}
        {file && (
          <span className="pr-filechip">
            <Icon name="file" size={16} />
            {file.name}
            <button type="button" onClick={() => setFile(null)} aria-label={t("pro.chat.remove")}>
              ×
            </button>
          </span>
        )}
        {error && (
          <p className="ck-err" role="alert">
            {error}
          </p>
        )}
        <div className="row">
          <label className="pr-att" aria-label={t("pro.chat.attach")} title={t("pro.chat.attach")}>
            <input type="file" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} disabled={uploading || busy} />
            <Icon name="clip" />
          </label>
          <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, 2000))} placeholder={uploading ? t("pro.chat.uploading") : t("pro.chat.write")} aria-label={t("pro.chat.write")} rows={1} />
          <button type="button" className="pr-btn sm" onClick={() => send(false)} disabled={busy || uploading || (!body.trim() && !file)}>
            <Icon name="send" size={16} />
            {t("pro.chat.send")}
          </button>
        </div>
        <p className="pr-safe">{t("pro.chat.safety")}</p>
      </div>
    </>
  );
}
