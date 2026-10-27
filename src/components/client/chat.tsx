"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { COMPRESS, compressImage, isCompressible } from "@/lib/images/compress";
import { useI18n } from "@/lib/i18n/client";
import { prepareChatFile, sendChatMessage } from "@/lib/pro/chat-actions";
import type { ChatMessage } from "@/lib/pro/chat";
import { messageFlags } from "@/lib/pro/rules";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { CwIcon } from "./icons";

const FLAG_KEYS = ["phone", "email", "link", "payment"] as const;

/**
 * The client's chat about one design (owner, 2026-10-16; Design/client-premium/client-messages.html), on the existing
 * contest chat: same sending, files and checks. Phone numbers, emails, links and payment words get a warning while
 * typing, and again on Send (the message can be edited or sent anyway; it is logged). New messages every 15 seconds.
 */
export function ClientChat({ entryId, messages, context }: { entryId: string; messages: ChatMessage[]; context: React.ReactNode }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [file, setFile] = useState<{ path: string; name: string; size: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [warning, setWarning] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const list = useRef<HTMLDivElement>(null);
  const live = useMemo(() => (body.trim() ? messageFlags(body) : []), [body]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages.length]);
  // New messages: checked while the chat is in front of them (owner, 2026-10-27: every 15 s in any visible tab
  // re-downloaded the whole page).
  useEffect(() => {
    let missed = false;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) return void (missed = true);
      missed = false;
      router.refresh();
    }, 20_000);
    const back = () => {
      if (!missed || document.visibilityState !== "visible") return;
      missed = false;
      router.refresh();
    };
    window.addEventListener("focus", back);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", back);
    };
  }, [router]);

  const upload = async (picked: File) => {
    setError(null);
    setUploading(true);
    try {
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

  const tag = locale === "bn" ? "bn-BD" : "en-GB";
  const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date(iso));
  const today = dayKey(new Date().toISOString());
  const dayLabel = (iso: string) => (dayKey(iso) === today ? t("cw.chat.today") : new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso)));
  const time = (iso: string) => new Intl.DateTimeFormat(tag, { hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" }).format(new Date(iso));
  const size = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  const what = (flags: readonly string[]) =>
    flags
      .filter((f): f is (typeof FLAG_KEYS)[number] => (FLAG_KEYS as readonly string[]).includes(f))
      .map((f) => t(`pro.chat.flags.${f}`))
      .join(", ");

  return (
    <>
      <div className="pmsgs" ref={list} aria-live="polite" data-chat-messages>
        {context}
        {messages.length === 0 && <p className="pday">{t("cw.chat.first")}</p>}
        {messages.map((m, i) => (
          <div key={m.id} style={{ display: "contents" }}>
            {(i === 0 || dayKey(messages[i - 1].at) !== dayKey(m.at)) && <span className="pday">{dayLabel(m.at)}</span>}
            {m.body && (
              <div className={`pm ${m.mine ? "pout" : "pin"}`}>
                <p>{m.body}</p>
                <em>
                  {time(m.at)}
                  {m.mine && m.read ? ` · ${t("pro.chat.seen")}` : ""}
                  {m.flags.length > 0 ? ` · ${t("pro.chat.flagged")}` : ""}
                </em>
              </div>
            )}
            {m.file && (
              <div className={`pm ${m.mine ? "pout" : "pin"} file`}>
                <span className="pfi">
                  <CwIcon name="clip" size={18} />
                </span>
                <div>
                  <b>{m.file.name}</b>
                  <em>
                    {size(m.file.size)} · {time(m.at)}
                  </em>
                </div>
                {m.file.url && (
                  <a href={m.file.url} target="_blank" rel="noreferrer" download={m.file.name} aria-label={t("cw.chat.download", { name: m.file.name })}>
                    <CwIcon name="download" size={18} />
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {(warning || live.length > 0) && (
        <div className="cwarn" role={warning ? "alert" : "status"} data-chat-warning>
          <b>{t("pro.chat.warnTitle")}</b>
          <span>{t("pro.chat.warnLead", { what: what(warning ?? live) })}</span>
          {warning && (
            <div className="row">
              <button type="button" className="dout sm" onClick={() => setWarning(null)}>
                {t("pro.chat.edit")}
              </button>
              <button type="button" className="dbtn sm" onClick={() => send(true)} disabled={busy}>
                {t("pro.chat.sendAnyway")}
              </button>
            </div>
          )}
        </div>
      )}
      {file && (
        <p className="cwarn" style={{ background: "#F4F5F7", boxShadow: "none", color: "#3A3C45" }}>
          <span>
            <CwIcon name="clip" size={14} /> {file.name} · {size(file.size)}{" "}
            <button type="button" onClick={() => setFile(null)} style={{ border: 0, background: "none", color: "#B3261E", fontWeight: 700, cursor: "pointer" }}>
              {t("pro.chat.remove")}
            </button>
          </span>
        </p>
      )}
      {error && (
        <p className="calert bad" role="alert" style={{ margin: "0 16px 8px" }}>
          {error}
        </p>
      )}
      <div className="pcmp">
        <label className="dic sm" aria-label={t("pro.chat.attach")} title={t("pro.chat.attach")}>
          <input type="file" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} disabled={uploading || busy} />
          <CwIcon name="clip" size={18} />
        </label>
        <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, 2000))} placeholder={uploading ? t("pro.chat.uploading") : t("cw.chat.write")} aria-label={t("cw.chat.write")} rows={1} data-chat-input />
        <button type="button" className="dbtn sm" onClick={() => send(false)} disabled={busy || uploading || (!body.trim() && !file)} data-chat-send>
          <CwIcon name="send" size={16} />
          {t("pro.chat.send")}
        </button>
      </div>
      <p className="psafe">
        <CwIcon name="lock" size={14} />
        {t("cw.chat.safety")}
      </p>
    </>
  );
}
