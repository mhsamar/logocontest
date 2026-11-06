"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AdminIcon } from "@/components/admin/icons";
import { useToast } from "@/components/ui/toast";
import { reachLead, resumeLinkFor } from "@/lib/admin/unpaid-followup-actions";
import { fillMessage, MESSAGE_KEYS, needsLink, pickMessage, SALUTES, type MessageKey, type Salute } from "@/lib/admin/unpaid-messages";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { showLogAfterReach } from "./reached";

const CHIP = "inline-flex min-h-9 items-center rounded-[10px] px-3 text-[13px] font-bold transition-colors";
const OUTLINE = "inline-flex min-h-10 items-center gap-2 rounded-[12px] border border-[#E3E4E8] bg-surface px-3.5 text-[14px] font-bold text-ink hover:border-primary hover:text-primary disabled:opacity-50";

/**
 * Ready messages (owner, 2026-11-06): the one to send now is picked from where the client stopped and how often they
 * were contacted, with their name, the logo's name, the link and the bKash number in. The team can change it, copy it,
 * or send it on WhatsApp or by SMS (each send is logged first, like the buttons above, and opens "Log a follow-up").
 */
export function ReadyMessages(props: { leadKey: string; name: string | null; logo: string; atPayment: boolean; contacts: number; startedAt: string; bkash: string | null; canLink: boolean; hasMobile: boolean; openHref?: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const suggested = pickMessage({ atPayment: props.atPayment, contacts: props.contacts, startedAt: new Date(props.startedAt) });
  const [key, setKey] = useState<MessageKey>(suggested);
  const [salute, setSalute] = useState<Salute>("both");
  const [link, setLink] = useState<string | null>(null);
  const [edited, setEdited] = useState<string | null>(null);
  const text = edited ?? fillMessage(key, { name: props.name, logo: props.logo, salute, link, bkash: props.bkash });

  // The client's resume link, once, when a message with a link is used (logged like Copy resume link).
  const withLink = async (): Promise<string> => {
    if (edited !== null || !needsLink(key) || !props.canLink || link) return text;
    const r = await resumeLinkFor(props.leadKey);
    if (!r.ok) return text;
    setLink(r.link);
    return fillMessage(key, { name: props.name, logo: props.logo, salute, link: r.link, bkash: props.bkash });
  };
  const copy = () =>
    start(async () => {
      const full = await withLink();
      await navigator.clipboard?.writeText(full).then(
        () => toast(t("admin.unpaid.msg.copied")),
        () => toast(t("admin.errors.generic"), "danger"),
      );
    });
  const send = (channel: "whatsapp" | "sms") => {
    // Opened now, in the click, so Safari doesn't block it; it goes to WhatsApp once the click is logged.
    const tab = channel === "whatsapp" ? window.open("", "_blank") : null;
    start(async () => {
      const full = await withLink();
      const r = await reachLead(props.leadKey, channel);
      if (!r.ok || !r.href) {
        tab?.close();
        return toast(t("admin.errors.generic"), "danger");
      }
      const href = channel === "whatsapp" ? `${r.href}?text=${encodeURIComponent(full)}` : `${r.href}?body=${encodeURIComponent(full)}`;
      showLogAfterReach(router, props.leadKey, channel, props.openHref);
      if (tab) {
        tab.opener = null;
        tab.location.href = href;
      } else window.location.href = href;
    });
  };

  return (
    <section className="flex flex-col gap-3 rounded-[16px] border border-adm-line p-4" data-ready-messages>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="m-0 text-[17px] font-semibold">{t("admin.unpaid.msg.title")}</h3>
        <span className="text-[12.5px] text-muted">{t("admin.unpaid.msg.hint")}</span>
      </div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("admin.unpaid.msg.which")}>
        {MESSAGE_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={key === k}
            onClick={() => (setKey(k), setEdited(null))}
            className={cx(CHIP, key === k ? "bg-[#111216] text-white" : "bg-[#F4F5F7] text-ink hover:bg-[#ECEDF0]")}
          >
            {t(`admin.unpaid.msg.keys.${k}`)}
            {k === suggested && <span className={cx("ml-1.5 rounded-full px-1.5 text-[11px]", key === k ? "bg-white/20" : "bg-[#FFE27A] text-[#3A2A00]")}>{t("admin.unpaid.msg.now")}</span>}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[12.5px] font-bold text-muted">{t("admin.unpaid.msg.salute")}</span>
        {SALUTES.map((s) => (
          <button key={s} type="button" aria-pressed={salute === s} onClick={() => (setSalute(s), setEdited(null))} className={cx(CHIP, "min-h-8", salute === s ? "bg-[#111216] text-white" : "bg-[#F4F5F7] text-ink")}>
            {t(`admin.unpaid.msg.salutes.${s}`)}
          </button>
        ))}
      </div>
      <textarea value={text} onChange={(e) => setEdited(e.target.value)} rows={6} lang="bn" className="min-h-[140px] rounded-[12px] border border-[#DCDEE3] px-3.5 py-3 text-[14.5px] leading-relaxed text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary" />
      {needsLink(key) && !props.canLink && <p className="m-0 text-[12.5px] text-muted">{t("admin.unpaid.msg.noLink")}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={OUTLINE} disabled={pending} onClick={copy}>
          <AdminIcon name="link" size={15} />
          {t("admin.unpaid.msg.copy")}
        </button>
        {props.hasMobile && (
          <>
            <button type="button" className={OUTLINE} disabled={pending} onClick={() => send("whatsapp")}>
              <AdminIcon name="whatsapp" size={15} />
              {t("admin.unpaid.msg.whatsapp")}
            </button>
            <button type="button" className={OUTLINE} disabled={pending} onClick={() => send("sms")}>
              <AdminIcon name="sms" size={15} />
              {t("admin.unpaid.msg.sms")}
            </button>
          </>
        )}
        {edited !== null && (
          <button type="button" className="min-h-10 px-2 text-[13.5px] font-bold text-primary underline" onClick={() => setEdited(null)}>
            {t("admin.unpaid.msg.reset")}
          </button>
        )}
      </div>
    </section>
  );
}
