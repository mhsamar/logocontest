"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { HELP_BODY_MAX } from "@/lib/wizard-live-rules";
import type { HelpAct, HelpOffer } from "./use-wizard-live";

/** Space between the card and the bar; and how high it sits when the bar is off the screen (above the support button). */
const GAP = 8;
const CLEAR = 88;

/**
 * The one help message the team may send on Start a contest (owner, 2026-10-25; Design/unpaid-contests, phase 2):
 * Reply, Call me or No thanks (× says no thanks too, and it never comes back this visit). Only inside the wizard, so
 * never on a payment page; the wizard also hides it while the content rules are open and once Pay is pressed. It
 * keeps clear of the wizard's Next / Pay bar (`above`) wherever that is on the screen, and of the support button, and
 * asks the wizard for room under its last fields (`onSpace`) so it never sits over them (the terms tick on Review).
 */
export function HelpCard({ offer, act, hidden, above, onClose, onSpace }: { offer: HelpOffer | null; act: (a: HelpAct, text?: string) => Promise<boolean>; hidden: boolean; above: RefObject<HTMLElement | null>; onClose: () => void; onSpace: (px: number) => void }) {
  const { t } = useI18n();
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [gone, setGone] = useState(false);
  const [lift, setLift] = useState(CLEAR);
  // Said once for screen readers when the message arrives (the card itself is added at the end of the page).
  const [news, setNews] = useState("");
  const busy = useRef(false);
  const typedAt = useRef(0);
  const list = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLElement>(null);
  const messages = offer?.messages ?? [];
  const shown = Boolean(offer && offer.status !== "declined" && messages.length && !gone && !hidden);
  const status = offer?.status;

  // They saw it: the admin's panel says so.
  useEffect(() => {
    if (shown && status === "sent") void act("seen");
  }, [shown, status, act]);
  // Never over the Next / Pay button: above the bar when it is on the screen (under it when there is no room above),
  // else low on the screen, clear of the support button. Follows scrolling and size changes.
  useEffect(() => {
    if (!shown) return;
    let frame = 0;
    let room = -1;
    const place = () => {
      frame = 0;
      const h = card.current?.offsetHeight ?? 0;
      // Room for the card under the last fields; the bar moves, so place again once the page has made it.
      if (h + GAP !== room) {
        room = h + GAP;
        onSpace(room);
        frame = window.requestAnimationFrame(place);
        return;
      }
      const bar = above.current?.getBoundingClientRect();
      const vh = window.innerHeight;
      let next = CLEAR;
      if (bar && bar.bottom > 0 && bar.top < vh) {
        if (bar.top - GAP >= h + GAP) next = vh - bar.top + GAP;
        else if (vh - bar.bottom - GAP >= h + GAP) next = GAP;
        else next = Math.min(vh - bar.top + GAP, Math.max(GAP, vh - h - GAP));
      }
      setLift(Math.round(next));
    };
    const soon = () => {
      if (!frame) frame = window.requestAnimationFrame(place);
    };
    soon();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(soon);
    if (above.current) ro?.observe(above.current);
    // The corner video's room moves the bar without resizing it: its parent grows (owner, 2026-10-26).
    if (above.current?.parentElement) ro?.observe(above.current.parentElement);
    if (card.current) ro?.observe(card.current);
    window.addEventListener("scroll", soon, { passive: true });
    window.addEventListener("resize", soon);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      ro?.disconnect();
      window.removeEventListener("scroll", soon);
      window.removeEventListener("resize", soon);
      onSpace(0);
    };
  }, [shown, above, onSpace]);
  const first = messages[0]?.body ?? "";
  useEffect(() => {
    if (!shown || !first) return;
    const id = window.setTimeout(() => setNews(`${t("wizard.help.label")}: ${first}`), 300);
    return () => window.clearTimeout(id);
  }, [shown, first, t]);
  // Newest message in view.
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages.length, writing]);

  // Only ever in the browser: the message comes from the page's own ping.
  if (!shown || !offer || typeof document === "undefined") return null;
  // Added empty with the card and filled a moment later, so screen readers announce it.
  const said = (
    <span role="status" className="sr-only">
      {news}
    </span>
  );
  const answered = messages.some((m) => m.mine);
  const calling = offer.status === "call_me";
  // One at a time (Enter and a click together send once); what didn't go through stays in the box.
  const say = async (a: HelpAct, text?: string) => {
    if (busy.current) return false;
    busy.current = true;
    setSending(true);
    setFailed(false);
    const took = await act(a, text);
    busy.current = false;
    setSending(false);
    setFailed(!took);
    return took;
  };
  // Closing before answering is "No thanks"; after a reply it only hides the card. The keyboard goes back to the wizard.
  const decline = () => {
    above.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    setGone(true);
    onClose();
    if (!answered) void act("no_thanks");
  };
  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    if (await say("reply", text)) setDraft("");
  };
  const btn = "min-h-11 flex-1 rounded-[10px] px-2 text-[14px] font-bold disabled:opacity-60";

  return createPortal(
    <>
    {said}
    <section
      ref={card}
      role="dialog"
      aria-modal="false"
      aria-label={t("wizard.help.label")}
      // Not while choosing a word in a Bangla (or other) keyboard.
      onKeyDown={(e) => e.key === "Escape" && !e.nativeEvent.isComposing && decline()}
      style={{ bottom: lift }}
      className="fixed inset-x-3 z-50 max-h-[70vh] overflow-y-auto rounded-[16px] bg-white p-3.5 text-[#111216] shadow-[0_14px_30px_-8px_rgba(0,0,0,.35)] ring-1 ring-black/5 motion-safe:animate-rise min-[721px]:inset-x-auto min-[721px]:right-6 min-[721px]:w-[360px]"
    >
      <div className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- a small fixed icon */}
        <img src="/brand/logo-icon-tile.png" alt="" width={36} height={36} className="size-9 shrink-0 rounded-[10px]" />
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-[14px] font-bold">{offer.from ? t("wizard.help.from", { name: offer.from }) : t("wizard.help.team")}</p>
          {offer.online && (
            <p className="m-0 flex items-center gap-1.5 text-[12px] font-semibold text-[#14633C]">
              <span className="size-1.5 rounded-full bg-[#2BB673]" />
              {t("wizard.help.online")}
            </p>
          )}
        </div>
        <button type="button" onClick={decline} aria-label={t("wizard.help.close")} className="flex size-9 shrink-0 items-center justify-center rounded-[10px] text-[20px] leading-none text-[#8A8C96] hover:bg-[#F1F1F5]">
          ×
        </button>
      </div>

      <div ref={list} aria-live="polite" className="mt-2 flex max-h-48 flex-col gap-1.5 overflow-y-auto">
        {messages.map((m) =>
          m.kind === "call_me" ? (
            <p key={m.id} className="m-0 self-center rounded-full bg-[#E4F5EC] px-3 py-1 text-[12.5px] font-bold text-[#14633C]">
              {t("wizard.help.asked")}
            </p>
          ) : m.kind === "text" && m.body ? (
            <p key={m.id} className={cx("m-0 max-w-[88%] whitespace-pre-line break-words rounded-[14px] px-3 py-2 text-[14.5px] leading-snug", m.mine ? "self-end rounded-br-[4px] bg-[#111216] text-white" : "self-start rounded-bl-[4px] bg-[#F1F1F5]")}>
              {m.body}
            </p>
          ) : null,
        )}
      </div>
      {calling && <p className="m-0 mt-2 text-[13.5px] font-semibold text-[#14633C]">{t("wizard.help.calling")}</p>}
      {failed && (
        <p role="alert" className="m-0 mt-2 text-[13px] font-semibold text-[#B3261E]">
          {t("wizard.help.failed")}
        </p>
      )}

      {writing || answered ? (
        <form
          className="mt-2.5 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <textarea
            value={draft}
            maxLength={HELP_BODY_MAX}
            rows={2}
            // Only after they pressed Reply, never on its own.
            autoFocus={writing}
            onChange={(e) => {
              setDraft(e.target.value);
              // "is typing" for the admin, at most every few seconds.
              if (Date.now() - typedAt.current > 4000) {
                typedAt.current = Date.now();
                void act("typing");
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={t("wizard.help.placeholder")}
            aria-label={t("wizard.help.placeholder")}
            className="min-h-11 flex-1 resize-none rounded-[10px] border border-[#E3E4E8] px-3 py-2 text-[15px] outline-none focus:border-[#111216]"
          />
          <button type="submit" disabled={sending || !draft.trim()} className={cx(btn, "flex-none bg-[#111216] px-4 text-white")}>
            {t("wizard.help.send")}
          </button>
        </form>
      ) : null}
      {!answered && (
        <div className="mt-2.5 flex gap-1.5">
          {!writing && (
            <button type="button" onClick={() => setWriting(true)} className={cx(btn, "bg-[#111216] text-white")}>
              {t("wizard.help.reply")}
            </button>
          )}
          {offer.canCall && !calling && (
            <button type="button" disabled={sending} onClick={() => void say("call_me")} className={cx(btn, "bg-[#111216] text-white")}>
              {t("wizard.help.callMe")}
            </button>
          )}
          <button type="button" onClick={decline} className={cx(btn, "bg-[#F1F1F5] text-[#3A3C45]")}>
            {t("wizard.help.noThanks")}
          </button>
        </div>
      )}
      {answered && offer.canCall && !calling && (
        <button type="button" disabled={sending} onClick={() => void say("call_me")} className="mt-2 text-[13.5px] font-bold text-[#111216] underline underline-offset-2">
          {t("wizard.help.callMe")}
        </button>
      )}
    </section>
    </>,
    document.body,
  );
}
