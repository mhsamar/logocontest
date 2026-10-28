"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { changedKey, DOING_MS, HELP_POLL_MS, LIVE_BEAT_MS, LIVE_THROTTLE_MS, type AnswerKey, type LiveAnswers } from "@/lib/wizard-live-rules";
import { wizardVisitId } from "./visit-id";

export type HelpMessage = { id: number; mine: boolean; kind: string; body: string; at: string };
export type HelpOffer = { status: string; from?: string; online?: boolean; canCall?: boolean; messages?: HelpMessage[] };
export type HelpAct = "seen" | "typing" | "reply" | "call_me" | "no_thanks";

const URL = "/api/wizard/live";
/** Answers that change this soon after the page opens are the page filling itself in (saved answers), not typing. */
const SETTLE_MS = 1500;

/**
 * "Creating a contest right now" (owner, 2026-10-25; Design/unpaid-contests, phase 2): tells the team which step this
 * visit is on and the form answers it is given (a fixed list, see wizard-live-rules), at once on a new step, at most
 * every few seconds while answering, and every 10 seconds while the page is open. Leaving says goodbye; `stage` 9 is
 * "went to payment" (Pay pressed). Brings back the one help message the team may send, and its chat (every 3 seconds
 * while it is open). Never awaited by the wizard, and never breaks it.
 */
export function useWizardLive(input: { on: boolean; service: string; stage: number; pos: number; of: number; contestId: string | null; answers: LiveAnswers }) {
  const { locale } = useI18n();
  const [offer, setOffer] = useState<HelpOffer | null>(null);
  const [closed, setClosed] = useState(false);
  const visit = useRef<string | null>(null);
  const openedAt = useRef(0);
  const latest = useRef(input);
  const before = useRef<LiveAnswers | null>(null);
  const doing = useRef<{ key: AnswerKey; at: number } | null>(null);
  const lastSent = useRef(0);
  const pending = useRef<number | null>(null);

  const body = useCallback(
    (extra: Record<string, unknown> = {}) => {
      const i = latest.current;
      const d = doing.current && Date.now() - doing.current.at < DOING_MS ? doing.current.key : null;
      return JSON.stringify({ v: visit.current, s: i.service, st: i.stage, p: i.pos, n: i.of, c: i.contestId, a: i.answers, d, loc: locale, away: document.visibilityState !== "visible", ...extra });
    },
    [locale],
  );
  /** True when the server took it (for a help action: stored it). A failed or refused ping keeps what is shown. */
  const post = useCallback(
    async (extra?: Record<string, unknown>): Promise<boolean> => {
      if (!visit.current || !latest.current.on) return false;
      lastSent.current = Date.now();
      try {
        const r = await fetch(URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: body(extra), cache: "no-store" });
        if (!r.ok) return false;
        const j = (await r.json()) as { offer: HelpOffer | null; took?: boolean };
        setOffer(j.offer ?? null);
        // A help action counts only when the server says it stored it.
        return extra?.h ? j.took === true : true;
      } catch {
        // A missed ping is fine: the next one comes in a few seconds.
        return false;
      }
    },
    [body],
  );
  // Leaving: sent even while the page unloads.
  const beacon = useCallback(
    (extra: Record<string, unknown>) => {
      if (!visit.current) return;
      try {
        navigator.sendBeacon(URL, new Blob([body(extra)], { type: "application/json" }));
      } catch {
        // ignore
      }
    },
    [body],
  );

  useEffect(() => {
    latest.current = input;
  });

  // Once: this tab's visit (a reload keeps it), and goodbye on leaving the page or the wizard.
  useEffect(() => {
    visit.current = wizardVisitId();
    openedAt.current = Date.now();
    const bye = () => beacon({ bye: true });
    const hide = () => (document.visibilityState === "hidden" ? beacon({ away: true }) : void post());
    window.addEventListener("pagehide", bye);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("pagehide", bye);
      document.removeEventListener("visibilitychange", hide);
      bye();
    };
  }, [beacon, post]);

  // A new step, a draft saved, Pay pressed: at once.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the offer is set when the server answers, not now
    if (input.on) void post();
  }, [input.on, input.stage, input.contestId, post]);

  // An answer changed: what they are doing now, sent at most every few seconds.
  const answersKey = JSON.stringify(input.answers);
  useEffect(() => {
    const now = JSON.parse(answersKey) as LiveAnswers;
    const settling = !input.on || Date.now() - openedAt.current < SETTLE_MS;
    const key = settling ? null : changedKey(before.current, now);
    before.current = input.on ? now : null;
    if (!key) return;
    doing.current = { key, at: Date.now() };
    if (pending.current !== null) return;
    const wait = Math.max(0, LIVE_THROTTLE_MS - (Date.now() - lastSent.current));
    pending.current = window.setTimeout(() => {
      pending.current = null;
      void post();
    }, wait);
  }, [answersKey, input.on, post]);
  useEffect(() => () => void (pending.current !== null && window.clearTimeout(pending.current)), []);

  // Still here: every 20 seconds while the page is visible, every 3 while a help chat is open on the screen. Timed from
  // the last thing sent (checked every few seconds, which costs nothing), so the gap never passes OFFER_FRESH_MS.
  const chatting = Boolean(offer && offer.status !== "declined" && !closed);
  useEffect(() => {
    const every = chatting ? HELP_POLL_MS : LIVE_BEAT_MS;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - lastSent.current >= every - 300) void post();
    }, Math.min(every, 5_000));
    return () => window.clearInterval(id);
  }, [chatting, post]);

  const act = useCallback((a: HelpAct, text?: string) => post({ h: { act: a, text } }), [post]);
  const close = useCallback(() => setClosed(true), []);
  return { offer, act, close };
}
