"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useToast } from "@/components/ui/toast";
import type { AlertPop } from "@/lib/admin/unpaid-alert-rules";
import { reachLead } from "@/lib/admin/unpaid-followup-actions";
import { useI18n } from "@/lib/i18n/client";
import { markRead } from "@/lib/notifications/actions";
import type { ShownNotification } from "@/lib/notifications/render";
import { AdminIcon } from "./icons";

const EVERY_MS = 15_000;
/** At most this many pop-ups at once (one on a phone, so the page stays usable); the rest are in the bell. */
const SHOWN = 3;
const PHONE = "(max-width: 640px)";

/** A short two-note chime made in the browser (no sound file). Browsers allow it only after the admin clicked the page. */
function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [880, 1175].forEach((hz, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = hz;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.16);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + i * 0.16 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.16 + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.16);
      o.stop(ctx.currentTime + i * 0.16 + 0.32);
    });
    window.setTimeout(() => void ctx.close(), 900);
  } catch {
    // No sound on this browser: the pop-up still shows.
  }
}

/**
 * The admin panel's bell (the admin's own notifications) and the unpaid instant alerts (owner, 2026-10-26;
 * Design/unpaid-contests §2): new ones pop up top-right, stacked, with Call now / Open / close, and an optional sound.
 * The server decides who gets which, quiet hours and the switches; Call now goes through the logged Call.
 */
export function AdminAlerts() {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<ShownNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [pops, setPops] = useState<AlertPop[]>([]);
  const [canCall, setCanCall] = useState(false);
  const [phone, setPhone] = useState(false);
  const [pending, start] = useTransition();
  const after = useRef<string | null>(null);
  const seen = useRef(new Set<string>());
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (busy.current || document.visibilityState !== "visible") return;
    busy.current = true;
    try {
      const r = await fetch(`/api/admin/alerts${after.current ? `?after=${encodeURIComponent(after.current)}` : ""}`, { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { now: string; unread: number; items: ShownNotification[]; pops: AlertPop[]; sound: boolean; canCall: boolean };
      setItems(j.items);
      setUnread(j.unread);
      setCanCall(j.canCall);
      // Only what came in while this page is open pops up; the rest is in the bell.
      after.current = j.now;
      const fresh = j.pops.filter((p) => !seen.current.has(p.id));
      fresh.forEach((p) => seen.current.add(p.id));
      if (fresh.length) {
        setPops((cur) => [...fresh.reverse(), ...cur].slice(0, 10));
        if (j.sound) chime();
      }
    } catch {
      // The next try comes in a few seconds.
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    void load();
    // A window left open behind others checks once a minute (owner, 2026-10-27: database traffic).
    let lastAt = Date.now();
    const id = window.setInterval(() => {
      if (!document.hasFocus() && Date.now() - lastAt < 60_000) return;
      lastAt = Date.now();
      void load();
    }, EVERY_MS);
    const onShow = () => void load();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [load]);

  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const close = (id: string) => setPops((cur) => cur.filter((p) => p.id !== id));
  const open = (p: AlertPop) => {
    close(p.id);
    void markRead(p.id).then(load);
    if (p.link) router.push(p.link);
  };
  const call = (p: AlertPop) =>
    start(async () => {
      const r = p.key ? await reachLead(p.key, "call") : { ok: false as const };
      if (!r.ok || !("href" in r) || !r.href) return toast(t("admin.errors.generic"), "danger");
      close(p.id);
      void markRead(p.id);
      window.location.href = r.href;
    });
  const max = phone ? 1 : SHOWN;
  const shown = pops.slice(0, max);

  return (
    <>
      <NotificationBell items={items} unread={unread} onRead={() => void load()} buttonClass="relative flex size-11 items-center justify-center rounded-[12px] border border-adm-line bg-surface text-adm-strong hover:bg-adm-bg" panelClass="z-[60]! max-sm:fixed max-sm:inset-x-3 max-sm:top-[76px] max-sm:mt-0 max-sm:w-auto" />
      {shown.length > 0 && (
        <div className="fixed right-3 top-[78px] z-[55] flex w-[min(390px,calc(100vw-1.5rem))] flex-col gap-2 sm:right-7" aria-live="polite">
          {shown.map((p) => (
            <div key={p.id} role="status" className="flex gap-3 rounded-[18px] bg-[#111216] p-3.5 text-white shadow-[0_18px_40px_-12px_rgba(0,0,0,.45)] motion-safe:animate-toast-in">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-[linear-gradient(180deg,#B3201B,#8B0000)]">
                <AdminIcon name="bell" size={18} className="origin-top motion-safe:animate-wiggle" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <b className="text-[14.5px]">
                  {p.title} · {t("admin.unpaid.alerts.pop.justNow")}
                </b>
                <p className="m-0 break-words text-[13.5px] text-[#C9CBD2]">{p.line}</p>
                <span className="mt-1.5 flex flex-wrap gap-1.5">
                  {canCall && p.key && (
                    <button type="button" disabled={pending} onClick={() => call(p)} className="inline-flex min-h-[34px] items-center gap-1.5 rounded-[10px] bg-[linear-gradient(180deg,#B3201B,#8B0000)] px-3 text-[13px] font-bold disabled:opacity-60">
                      <AdminIcon name="phone" size={14} />
                      {t("admin.unpaid.alerts.pop.call")}
                    </button>
                  )}
                  {p.link && (
                    <Link prefetch={false} href={p.link} onClick={(e) => (e.preventDefault(), open(p))} className="inline-flex min-h-[34px] items-center rounded-[10px] border border-white/20 px-3 text-[13px] font-bold hover:bg-white/10">
                      {t("admin.unpaid.alerts.pop.open")}
                    </Link>
                  )}
                </span>
              </div>
              <button type="button" onClick={() => close(p.id)} aria-label={t("admin.unpaid.alerts.pop.close")} className="flex size-8 shrink-0 items-center justify-center rounded-[10px] text-[#C9CBD2] hover:bg-white/10">
                <AdminIcon name="close" size={16} />
              </button>
            </div>
          ))}
          {pops.length > max && <span className="self-end rounded-full bg-[#111216] px-3 py-1 text-[12.5px] font-bold text-white">{t("admin.unpaid.alerts.pop.more", { n: pops.length - max })}</span>}
        </div>
      )}
    </>
  );
}
