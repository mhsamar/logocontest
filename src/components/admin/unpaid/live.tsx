"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { AdminIcon } from "@/components/admin/icons";
import { useReadOnly } from "@/components/admin/read-only";
import { AdmCard, AdmEmpty } from "@/components/admin/ui";
import { useToast } from "@/components/ui/toast";
import type { HelpThread, LiveCard } from "@/lib/admin/unpaid-live";
import { reachLead } from "@/lib/admin/unpaid-followup-actions";
import { helpReply, offerHelp } from "@/lib/admin/unpaid-live-actions";
import { STAGES } from "@/lib/admin/unpaid-rules";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatTaka } from "@/lib/money";
import { activityOf, isHot, LAST_HELP_STAGE, OFFER_BODY_MAX, onPage, type AnswerKey } from "@/lib/wizard-live-rules";

/**
 * "Creating a contest right now" (owner, 2026-10-25; Design/unpaid-contests, phase 2): who is on Start a contest this
 * minute, their step and time on the page, Watch (their form answers as they fill them in) and Offer help (the one
 * message a visit may get, and its chat). Refreshes itself every few seconds; the page's 20-second refresh keeps it
 * as it is. Phone and email come masked from the server, and only for Unpaid · Manage.
 */

const CARDS_MS = 5_000;
const THREAD_MS = 3_000;
const QUICK = ["q1", "q2", "q3", "q4"] as const;
const SMALL_BTN = "inline-flex min-h-[34px] flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-[#E3E4E8] bg-surface px-3 text-[13px] font-bold text-ink hover:border-[#111216]";
const DARK_BTN = "inline-flex min-h-[34px] items-center gap-1.5 rounded-[10px] border border-[#2E4A3C] px-3 text-[13px] font-bold text-white hover:bg-white/10 disabled:opacity-50";
const LABEL = "text-[13px] font-extrabold text-[#A7C4B5]";
const SERVICE_STEP: Partial<Record<number, "brief" | "order" | "pay">> = { 2: "brief", 7: "order", 8: "pay" };
const FIELD_OF: Record<AnswerKey, string> = { brand: "brand", business: "business", businessOther: "business", links: "links", styles: "styles", colours: "colours", designersChoose: "colours", requirements: "requirements", deliverables: "requirements", files: "files", package: "prize", prize: "prize", days: "prize", upgrades: "prize" };

type Open = { visit: string; mode: "watch" | "help" };

export function LiveNow({ canManage, me }: { canManage: boolean; me: string }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const manage = canManage && !readOnly;
  const [data, setData] = useState<{ ready: boolean; cards: LiveCard[] } | null>(null);
  // Everyone seen while this page is open, so a panel keeps showing someone who just left.
  const [seen, setSeen] = useState<Record<string, LiveCard>>({});
  const [now, setNow] = useState(0);
  const [open, setOpen] = useState<Open | null>(null);

  useEffect(() => {
    let stop = false;
    let busy = false;
    const load = async () => {
      if (stop || busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const r = await fetch("/api/admin/unpaid/live", { cache: "no-store" });
        // Signed out or no longer allowed: stop asking.
        if (r.status === 401) stop = true;
        const j = r.ok ? ((await r.json()) as { ready: boolean; cards: LiveCard[] }) : null;
        if (j && !stop) {
          setData(j);
          setNow(Date.now());
          setSeen((s) => ({ ...s, ...Object.fromEntries(j.cards.map((c) => [c.visit, c])) }));
        }
      } catch {
        // The next try comes in a few seconds.
      } finally {
        busy = false;
      }
    };
    void load();
    const id = window.setInterval(load, CARDS_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      stop = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);

  const cards = data?.cards ?? [];
  // A service contest's own steps (Your brief, Prize and time, Review and pay) on the same 1..10 scale.
  const stepName = (n: number, service: string | null = null) => {
    const own = service ? SERVICE_STEP[n] : undefined;
    return own ? t(`services.wizard.steps.${own}`) : t(`admin.dashboard.steps.s${Math.min(Math.max(n, 1), STAGES)}` as MessageKey);
  };
  const time = (from: string) => {
    const p = onPage(now - Date.parse(from));
    return "h" in p ? t("admin.unpaid.fu.now.hours", { h: p.h, m: p.m }) : t(`admin.unpaid.fu.now.${p.unit}`, { n: p.n });
  };
  const person = (c: LiveCard) => c.name ?? t("admin.unpaid.fu.list.guest");
  const toggle = (visit: string, mode: Open["mode"]) => {
    const next = open?.visit === visit && open.mode === mode ? null : { visit, mode };
    setOpen(next);
  };
  const active = open ? (cards.find((c) => c.visit === open.visit) ?? seen[open.visit] ?? null) : null;
  const gone = Boolean(open && !cards.some((c) => c.visit === open.visit));

  return (
    <AdmCard as="section" id="live" className="flex scroll-mt-24 flex-col gap-3.5 p-5" aria-label={t("admin.unpaid.fu.now.title")} data-unpaid-live>
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h2 className="m-0 flex items-center text-[20px] font-semibold tracking-[-0.02em]">
            <span className="relative mr-2 flex size-2.5 shrink-0">
              {cards.length > 0 && <span className="absolute inline-flex size-full rounded-full bg-[#2BB673] opacity-60 motion-safe:animate-ping" />}
              <span className={cx("relative size-2.5 rounded-full", cards.length ? "bg-[#2BB673]" : "bg-[#C9CBD2]")} />
            </span>
            {t("admin.unpaid.fu.now.title")}
            {cards.length > 0 && <span className="ml-2 rounded-full bg-[#E4F5EC] px-[9px] py-0.5 text-[14px] font-bold text-[#14633C]">{cards.length}</span>}
          </h2>
          <p className="m-0 mt-1 text-[14px] text-muted">{t("admin.unpaid.fu.now.sub")}</p>
        </div>
        <span className="text-[12.5px] text-muted">{t("admin.unpaid.fu.now.updated")}</span>
      </div>

      {data && !data.ready ? (
        canManage ? <p className="m-0 rounded-[12px] bg-adm-sample-bg px-4 py-3 text-[14px] font-semibold text-adm-sample">{t("admin.unpaid.fu.now.notReady")}</p> : null
      ) : cards.length === 0 ? (
        <AdmEmpty>{t("admin.unpaid.fu.now.empty")}</AdmEmpty>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 min-[901px]:grid-cols-3">
          {cards.map((c) => (
            <LiveCardView key={c.visit} c={c} name={person(c)} time={time(c.startedAt)} stepName={stepName} open={open} onToggle={toggle} />
          ))}
        </ul>
      )}

      {open && active && open.mode === "watch" && <WatchPanel key={active.visit} visit={active.visit} name={person(active)} onClose={() => setOpen(null)} />}
      {open && active && open.mode === "help" && (
        <HelpPanel key={active.visit} c={active} name={person(active)} me={me} manage={manage} gone={gone} time={time(active.startedAt)} stepName={stepName} onClose={() => setOpen(null)} />
      )}
    </AdmCard>
  );
}

function LiveCardView({ c, name, time, stepName, open, onToggle }: { c: LiveCard; name: string; time: string; stepName: (n: number, service?: string | null) => string; open: Open | null; onToggle: (visit: string, mode: Open["mode"]) => void }) {
  const { t } = useI18n();
  const device = c.device ? t(`admin.unpaid.fu.devices.${c.device}` as MessageKey) : null;
  const where = [c.signedIn ? t("admin.unpaid.fu.now.signedIn") : c.city, device].filter(Boolean).join(" · ");
  const doing = useActivity(c);
  const hot = isHot(c);
  return (
    <li className={cx("flex flex-col gap-2.5 rounded-[16px] border p-3.5", hot ? "border-[#F2D9A8] bg-[linear-gradient(180deg,#FFFBF2,#fff)]" : "border-[#E9EAEE] bg-[linear-gradient(180deg,#fff,#FAFAFB)]")}>
      <div className="flex items-center gap-2.5">
        <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[11px] bg-[#F1F1F5] text-[#3A3C45]">
          <AdminIcon name={c.device === "desktop" ? "computer" : "device"} size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 truncate text-[15px] font-bold">
            {name}
            {c.isTest && <span className="rounded-full bg-[#F1F1F5] px-2 text-[11px] font-bold text-[#6A6D78]">{t("admin.unpaid.fu.now.test")}</span>}
          </span>
          <span className="block truncate text-[12.5px] text-muted">{[where, c.service ? t("admin.unpaid.fu.now.service", { service: c.service }) : null].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="relative flex size-2 shrink-0">
          <span className="absolute inline-flex size-full rounded-full bg-[#2BB673] opacity-60 motion-safe:animate-ping" />
          <span className="relative size-2 rounded-full bg-[#2BB673]" />
        </span>
      </div>
      <div className="flex flex-col gap-1.5 text-[13.5px]">
        <span>{t("admin.unpaid.fu.now.step", { n: c.stage, all: STAGES, step: stepName(c.stage, c.service) })}</span>
        <span className="h-1.5 overflow-hidden rounded-[9px] bg-[#EEEFF2]" aria-hidden>
          <span className="block h-full rounded-[9px] bg-[linear-gradient(90deg,#14633C,#2BB673)] motion-safe:transition-[width] motion-safe:duration-1000" style={{ width: `${(c.stage / STAGES) * 100}%` }} />
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-1.5 text-[12.5px] text-muted">
        <span className="inline-flex items-center gap-1">
          <AdminIcon name="unpaid" size={13} />
          {t("admin.unpaid.fu.now.onPage", { time })}
        </span>
        {doing && (
          <span className={cx("inline-flex items-center gap-1 font-bold", c.away ? "text-muted" : "text-[#14633C]")}>
            {doing}
            {!c.away && <Dots />}
          </span>
        )}
      </div>
      {c.offer && (
        <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-[#E6EEF8] px-2.5 py-0.5 text-[12px] font-bold text-[#24406B]">
          <AdminIcon name="chat" size={12} />
          {t("admin.unpaid.fu.now.helpSent")}
          {c.offer.unread > 0 && <span className="rounded-full bg-[#B3261E] px-1.5 text-white">{t("admin.unpaid.fu.now.unread", { n: c.offer.unread })}</span>}
        </span>
      )}
      <div className="flex gap-1.5">
        <button type="button" onClick={() => onToggle(c.visit, "watch")} aria-expanded={open?.visit === c.visit && open.mode === "watch"} className={SMALL_BTN}>
          <AdminIcon name="eye" size={14} />
          {t("admin.unpaid.fu.now.watch")}
        </button>
        <button type="button" onClick={() => onToggle(c.visit, "help")} aria-expanded={open?.visit === c.visit && open.mode === "help"} className={SMALL_BTN}>
          <AdminIcon name="chat" size={14} />
          {t("admin.unpaid.fu.now.offerHelp")}
        </button>
      </div>
    </li>
  );
}

function Dots() {
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1 rounded-full bg-[#2BB673] motion-safe:animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
      ))}
    </span>
  );
}

/** What they are doing, in words. */
function useActivity(c: LiveCard): string {
  const { t } = useI18n();
  const a = activityOf(c);
  const field = a.field ? t(`admin.unpaid.fu.now.fields.${FIELD_OF[a.field]}` as MessageKey) : "";
  if (a.kind === "typing" || a.kind === "changing") return t(`admin.unpaid.fu.now.activity.${a.kind}`, { field });
  if (a.kind === "picked") {
    const value = a.field === "business" && c.answers.business ? t(`wizard.businessTypes.${c.answers.business}` as MessageKey) : c.answers.package ? t(`wizard.packages.${c.answers.package}.name` as MessageKey) : field;
    return t("admin.unpaid.fu.now.activity.picked", { value });
  }
  return t(`admin.unpaid.fu.now.activity.${a.kind}`);
}

/** Their answers come from the server every few seconds while it is open (and each Watch is logged there). */
function WatchPanel({ visit, name, onClose }: { visit: string; name: string; onClose: () => void }) {
  const [c, setCard] = useState<LiveCard | null>(null);
  useEffect(() => {
    let stop = false;
    const load = async () => {
      if (stop || document.visibilityState !== "visible") return;
      try {
        const r = await fetch(`/api/admin/unpaid/live?watch=${visit}`, { cache: "no-store" });
        if (r.status === 401) stop = true;
        const j = r.ok ? ((await r.json()) as { card: LiveCard | null }) : null;
        if (j?.card && !stop) setCard(j.card);
      } catch {
        // The next try comes in a few seconds.
      }
    };
    void load();
    const id = window.setInterval(load, THREAD_MS);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [visit]);
  return c ? <WatchView c={c} name={name} gone={Boolean(c.gone)} onClose={onClose} /> : null;
}

function WatchView({ c, name, gone, onClose }: { c: LiveCard; name: string; gone: boolean; onClose: () => void }) {
  const { t, locale } = useI18n();
  const a = c.answers;
  const taka = (n: number) => formatTaka(n, locale);
  const dash = "—";
  const prize = a.package ? [a.package === "custom" ? (a.prize ? taka(a.prize) : t("wizard.packages.custom.name")) : t(`wizard.packages.${a.package}.name` as MessageKey), ...(a.upgrades ?? []).map((k) => t(`wizard.upgrades.${k}.name` as MessageKey))].join(" + ") : dash;
  const contact = c.contact === "hidden" ? t("admin.unpaid.fu.now.values.hidden") : c.contact ? [c.contact.mobile, c.contact.email ? "•••••@•••••" : null].filter(Boolean).join(" · ") || dash : c.signedIn ? t("admin.unpaid.fu.now.signedIn") : dash;
  const tiles: { key: string; label: string; value: string; stage: number }[] = [
    { key: "brand", label: c.service ? t("services.wizard.title") : t("admin.unpaid.fu.now.fields.brand"), value: a.brand || dash, stage: 2 },
    { key: "business", label: t("admin.unpaid.fu.now.fields.business"), value: a.business ? (a.business === "other" && a.businessOther ? a.businessOther : t(`wizard.businessTypes.${a.business}` as MessageKey)) : dash, stage: 3 },
    { key: "links", label: t("admin.unpaid.fu.now.fields.links"), value: a.links === undefined ? dash : a.links ? t("admin.unpaid.fu.now.values.links", { n: a.links }) : t("admin.unpaid.fu.now.values.noLinks"), stage: 4 },
    { key: "styles", label: t("admin.unpaid.fu.now.fields.styles"), value: a.styles?.length ? a.styles.map((s) => t(`wizard.styles.${s}` as MessageKey)).join(", ") : dash, stage: 5 },
    { key: "colours", label: t("admin.unpaid.fu.now.fields.colours"), value: a.designersChoose ? t("admin.unpaid.fu.now.values.designersChoose") : a.colours ? t("admin.unpaid.fu.now.values.colours", { n: a.colours }) : dash, stage: 5 },
    { key: "requirements", label: t("admin.unpaid.fu.now.fields.requirements"), value: [a.requirements ? t("admin.unpaid.fu.now.values.picked", { n: a.requirements + (a.deliverables ?? 0) }) : null, a.files ? t("admin.unpaid.fu.now.values.files", { n: a.files }) : null].filter(Boolean).join(" · ") || dash, stage: 6 },
    { key: "prize", label: t("admin.unpaid.fu.now.fields.prize"), value: a.days && a.package ? `${prize} · ${t("admin.unpaid.fu.now.values.days", { n: a.days })}` : prize, stage: 7 },
    { key: "contact", label: t("admin.unpaid.fu.now.fields.contact"), value: contact, stage: 1 },
    { key: "review", label: t("admin.unpaid.fu.now.fields.review"), value: c.stage === LAST_HELP_STAGE ? t("admin.unpaid.fu.now.values.openNow") : dash, stage: 8 },
    { key: "total", label: t("admin.unpaid.fu.now.fields.total"), value: c.total ? taka(c.total) : dash, stage: 8 },
  ];
  return (
    <div className="rounded-[16px] bg-[#0F1F17] p-4 text-white motion-safe:animate-rise" role="region" aria-label={t("admin.unpaid.fu.now.watching", { name })}>
      <div className="mb-3 flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <p className="m-0 text-[16px] font-bold">{t("admin.unpaid.fu.now.watching", { name })}</p>
          <p className="m-0 mt-0.5 text-[13px] text-[#A7C4B5]">{gone ? t("admin.unpaid.fu.now.left") : t("admin.unpaid.fu.now.watchSub")}</p>
        </div>
        <button type="button" onClick={onClose} className={DARK_BTN}>
          <AdminIcon name="close" size={14} />
          {t("admin.unpaid.fu.now.close")}
        </button>
      </div>
      <dl className="m-0 grid grid-cols-2 gap-2 min-[901px]:grid-cols-4">
        {tiles.map((f) => (
          <div key={f.key} className={cx("min-w-0 rounded-[12px] px-3 py-2.5", !gone && f.stage === c.stage ? "bg-[rgba(43,182,115,.18)] ring-1 ring-inset ring-[#2BB673] motion-safe:animate-pulse" : "bg-white/[.06]")}>
            <dt className="text-[12px] text-[#A7C4B5]">{f.label}</dt>
            <dd className="m-0 break-words text-[14px] font-bold">{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function HelpPanel({ c, name, me, manage, gone, time, stepName, onClose }: { c: LiveCard; name: string; me: string; manage: boolean; gone: boolean; time: string; stepName: (n: number, service?: string | null) => string; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const hello = (q: (typeof QUICK)[number]) => t("admin.unpaid.fu.now.offer.hello", { name: me, text: q === "q1" ? `${t("admin.unpaid.fu.now.offer.q1")} ${t("admin.unpaid.fu.now.offer.tail")}` : t(`admin.unpaid.fu.now.offer.${q}`) });
  const [quick, setQuick] = useState<(typeof QUICK)[number]>("q1");
  const [text, setText] = useState(() => hello("q1"));
  const [reply, setReply] = useState("");
  const [thread, setThread] = useState<HelpThread>(null);
  const [pending, start] = useTransition();

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/unpaid/live?thread=${c.visit}`, { cache: "no-store" });
      if (r.ok) setThread(((await r.json()) as { thread: HelpThread }).thread);
    } catch {
      // The next try comes in a few seconds.
    }
  }, [c.visit]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the chat is set when the server answers, not now
    void load();
    const id = window.setInterval(() => document.visibilityState === "visible" && void load(), THREAD_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const sent = Boolean(thread);
  const answered = Boolean(thread?.messages.some((m) => !m.fromAdmin));
  const blocked = c.stage > LAST_HELP_STAGE ? "atPayment" : gone ? "gone" : null;
  const send = () =>
    start(async () => {
      const r = await offerHelp(c.visit, text);
      if (!r.ok) return toast(t(r.error), "danger");
      await load();
    });
  const answer = () =>
    start(async () => {
      const r = await helpReply(c.visit, reply);
      if (!r.ok) return toast(t(r.error), "danger");
      setReply("");
      await load();
    });
  const call = () =>
    start(async () => {
      const r = c.leadKey ? await reachLead(c.leadKey, "call") : { ok: false as const };
      if (!r.ok || !("href" in r) || !r.href) return toast(t("admin.errors.generic"), "danger");
      window.location.href = r.href;
    });
  const preview = sent ? (thread?.messages.find((m) => m.fromAdmin)?.body ?? text) : text;

  return (
    <div className="grid gap-[18px] rounded-[16px] bg-[#0F1F17] p-4 text-white motion-safe:animate-rise min-[901px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]" role="region" aria-label={t("admin.unpaid.fu.now.offer.title", { name })}>
      <div className="flex min-w-0 flex-col gap-2.5">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <p className="m-0 text-[16px] font-bold">{t("admin.unpaid.fu.now.offer.title", { name })}</p>
            <p className="m-0 mt-0.5 text-[13px] text-[#A7C4B5]">{gone ? t("admin.unpaid.fu.now.errors.gone") : t("admin.unpaid.fu.now.offer.sub")}</p>
          </div>
          <button type="button" onClick={onClose} className={DARK_BTN}>
            <AdminIcon name="close" size={14} />
            {t("admin.unpaid.fu.now.close")}
          </button>
        </div>
        <p className="m-0 flex flex-wrap gap-3 text-[13px] text-[#A7C4B5]">
          <span>{t("admin.unpaid.fu.now.offer.onStep", { n: c.stage, step: stepName(c.stage, c.service) })}</span>
          <span className="inline-flex items-center gap-1">
            <AdminIcon name="unpaid" size={13} />
            {t("admin.unpaid.fu.now.onPage", { time })}
          </span>
          {c.device && (
            <span className="inline-flex items-center gap-1">
              <AdminIcon name={c.device === "desktop" ? "computer" : "device"} size={13} />
              {t(`admin.unpaid.fu.devices.${c.device}` as MessageKey)}
            </span>
          )}
        </p>

        {!sent && manage && (
          <>
            <span className={LABEL}>{t("admin.unpaid.fu.now.offer.quick")}</span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  aria-pressed={quick === q}
                  onClick={() => {
                    setQuick(q);
                    setText(hello(q));
                  }}
                  className={cx("rounded-[10px] px-[11px] py-[7px] text-left text-[13px] font-bold", quick === q ? "bg-[#2BB673] text-[#0F1F17]" : "bg-white/[.07] text-white hover:bg-white/[.12]")}
                >
                  {t(`admin.unpaid.fu.now.offer.${q}`)}
                </button>
              ))}
            </div>
            <label className={LABEL} htmlFor="help-message">
              {t("admin.unpaid.fu.now.offer.message")}
            </label>
            <textarea id="help-message" value={text} maxLength={OFFER_BODY_MAX} onChange={(e) => setText(e.target.value)} className="min-h-16 rounded-[12px] border border-[#2E4A3C] bg-white/5 px-3.5 py-3 text-[14px] text-[#E6EFEA] outline-none focus:border-[#2BB673]" />
            {blocked && <p className="m-0 text-[13px] font-bold text-[#F2C46D]">{t(`admin.unpaid.fu.now.errors.${blocked}`)}</p>}
          </>
        )}
        {!manage && !sent && <p className="m-0 text-[13px] text-[#A7C4B5]">{t("admin.unpaid.fu.now.offer.manageOnly")}</p>}
        {manage && (
          <div className="flex flex-wrap gap-2">
            {!sent && (
              <button type="button" disabled={pending || Boolean(blocked) || !text.trim()} onClick={send} className="inline-flex min-h-[42px] items-center gap-2 rounded-[12px] bg-[linear-gradient(180deg,#B3201B,#8B0000)] px-4 text-[14.5px] font-bold text-white disabled:opacity-50">
                <AdminIcon name="chat" size={15} />
                {t("admin.unpaid.fu.now.offer.send")}
              </button>
            )}
            {sent && (
              <span className="inline-flex min-h-[42px] items-center gap-2 rounded-[12px] bg-white/10 px-4 text-[14.5px] font-bold">
                <AdminIcon name="check" size={15} />
                {t("admin.unpaid.fu.now.offer.sent")}
              </span>
            )}
            <button type="button" disabled={pending || !c.hasNumber || !c.leadKey} title={!c.hasNumber ? t("admin.unpaid.fu.now.offer.noNumber") : undefined} onClick={call} className={cx(DARK_BTN, "min-h-[42px] px-4 text-[14.5px]")}>
              <AdminIcon name="phone" size={15} />
              {t("admin.unpaid.fu.now.offer.callInstead")}
            </button>
          </div>
        )}

        {sent && thread && (
          <div className="flex flex-col gap-1.5 border-t border-[#2E4A3C] pt-2" aria-live="polite">
            <span className={LABEL}>{t("admin.unpaid.fu.now.offer.replies")}</span>
            {thread.by && <span className="text-[12px] text-[#7E9A8B]">{t("admin.unpaid.fu.now.offer.by", { name: thread.by })}</span>}
            {thread.messages.map((m) =>
              m.kind === "text" ? (
                <div key={m.id} className={cx("max-w-[85%] rounded-[14px] px-3 py-2 text-[13.5px]", m.fromAdmin ? "self-end rounded-br-[4px] bg-[#14633C]" : "self-start rounded-bl-[4px] bg-white/[.08]")}>
                  <span className={cx("block text-[11.5px]", m.fromAdmin ? "text-[#CFEBDD]" : "text-[#A7C4B5]")}>{m.fromAdmin ? (m.by ?? t("admin.unpaid.fu.now.offer.you")) : name}</span>
                  <span className="whitespace-pre-line break-words">{m.body}</span>
                </div>
              ) : (
                <span key={m.id} className="self-center rounded-full bg-white/10 px-3 py-0.5 text-[12px] font-bold">
                  {m.kind === "call_me" ? t("admin.unpaid.fu.now.offer.callMe") : t("admin.unpaid.fu.now.offer.noThanks")}
                </span>
              ),
            )}
            {!answered && <span className="text-[12px] text-[#A7C4B5]">{thread.status === "seen" ? t("admin.unpaid.fu.now.offer.seen") : t("admin.unpaid.fu.now.offer.waiting")}</span>}
            {thread.typing && (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-[#A7C4B5]">
                {t("admin.unpaid.fu.now.offer.typing", { name })}
                <Dots />
              </span>
            )}
            {manage && answered && thread.status !== "declined" && (
              <form
                className="mt-1 flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (reply.trim()) answer();
                }}
              >
                <textarea value={reply} maxLength={OFFER_BODY_MAX} rows={2} onChange={(e) => setReply(e.target.value)} placeholder={t("admin.unpaid.fu.now.offer.write")} aria-label={t("admin.unpaid.fu.now.offer.write")} className="min-h-11 flex-1 resize-none rounded-[12px] border border-[#2E4A3C] bg-white/5 px-3 py-2 text-[14px] text-[#E6EFEA] outline-none focus:border-[#2BB673]" />
                <button type="submit" disabled={pending || !reply.trim()} className="min-h-11 rounded-[12px] bg-[#2BB673] px-4 text-[14px] font-bold text-[#0F1F17] disabled:opacity-50">
                  {t("admin.unpaid.fu.now.offer.reply")}
                </button>
              </form>
            )}
          </div>
        )}
        <p className="m-0 text-[12.5px] text-[#7E9A8B]">{t("admin.unpaid.fu.now.offer.footer")}</p>
      </div>

      {/* What they see: the card over their Start a contest page. */}
      <div className="flex min-w-0 flex-col">
        <span className={cx(LABEL, "mb-2")}>{t("admin.unpaid.fu.now.offer.preview")}</span>
        <div className="flex flex-1 items-center justify-center rounded-[16px] bg-[radial-gradient(circle_at_50%_30%,#1D3A2B,#0B1711)] p-3.5">
          <div className="relative flex h-[440px] w-[250px] max-w-full flex-col overflow-hidden rounded-[30px] bg-[#F4F5F7] p-3 text-[#111216] shadow-[0_0_0_7px_#222]">
            <div className="flex flex-col gap-2 opacity-55" aria-hidden>
              <span className="text-[12px] font-bold">{c.pos && c.of ? t("common.stepOf", { current: c.pos, total: c.of }) : stepName(c.stage, c.service)}</span>
              <span className="h-[34px] rounded-[10px] bg-white ring-1 ring-[#E3E4E8]" />
              <span className="h-[60px] rounded-[10px] bg-white ring-1 ring-[#E3E4E8]" />
              <span className="h-[22px] rounded-[10px] bg-white ring-1 ring-[#E3E4E8]" />
              <span className="mt-1 rounded-[10px] bg-[#8B0000] py-2 text-center text-[12px] font-bold text-white">{t("admin.unpaid.fu.now.offer.next")}</span>
            </div>
            <div className="absolute inset-x-2.5 bottom-3 rounded-[16px] bg-white p-3 shadow-[0_14px_30px_-8px_rgba(0,0,0,.35)]">
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- a small fixed icon */}
                <img src="/brand/logo-icon-tile.png" alt="" width={28} height={28} className="size-7 rounded-[9px]" />
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-[12px] font-bold">{t("wizard.help.from", { name: me })}</p>
                  <p className="m-0 flex items-center gap-1 text-[10.5px] text-[#14633C]">
                    <span className="size-1.5 rounded-full bg-[#2BB673]" />
                    {t("wizard.help.online")}
                  </p>
                </div>
                <span className="text-[#8A8C96]" aria-hidden>
                  ×
                </span>
              </div>
              <p className="m-0 my-2 line-clamp-4 whitespace-pre-line break-words text-[12.5px] leading-[1.4]">{preview}</p>
              <div className="flex gap-1.5 text-[11px] font-bold">
                <span className="flex-1 rounded-[8px] bg-[#111216] py-1.5 text-center text-white">{t("wizard.help.reply")}</span>
                <span className="flex-1 rounded-[8px] bg-[#111216] py-1.5 text-center text-white">{t("wizard.help.callMe")}</span>
                <span className="flex-1 rounded-[8px] bg-[#F1F1F5] py-1.5 text-center text-[#3A3C45]">{t("wizard.help.noThanks")}</span>
              </div>
            </div>
          </div>
        </div>
        {/* So the message can be written in their language. */}
        {c.locale && <span className="mt-1.5 text-[12px] text-[#7E9A8B]">{t(c.locale === "bn" ? "admin.unpaid.fu.now.offer.langBn" : "admin.unpaid.fu.now.offer.langEn")}</span>}
      </div>
    </div>
  );
}
