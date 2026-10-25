"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { AdminIcon, type AdminIconName } from "@/components/admin/icons";
import { useReadOnly } from "@/components/admin/read-only";
import { AdmCheckbox } from "@/components/admin/ui";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { closeAsFake, findLeadsByContact, followUpDone, logFollowUp, planFollowUp, reachLead } from "@/lib/admin/unpaid-followup-actions";
import { FAKE_REASONS, HOWS, isContactSearch, NEXT_PRESETS, RESULTS, unpaidHref, type How, type NextPreset, type Result, type UnpaidQuery } from "@/lib/admin/unpaid-rules";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";

/**
 * Admin › Unpaid contests, follow-ups (owner, 2026-10-25; Design/unpaid-contests): the parts you click. Each one goes
 * through a server action that checks Unpaid · Manage and writes the audit log; they hide themselves for view-only
 * staff. Phone numbers come from the server only when the click is logged.
 */

const CHIP = "inline-flex min-h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13.5px] font-bold transition-colors";
const chip = (on: boolean, danger = false) => cx(CHIP, on ? (danger ? "bg-[#B3261E] text-white" : "bg-[#111216] text-white") : danger ? "bg-[#F4F5F7] text-[#B3261E] hover:bg-[#FFE9E7]" : "bg-[#F4F5F7] text-ink hover:bg-[#ECEDF0]");
const OUTLINE = "inline-flex min-h-11 items-center gap-2 rounded-[12px] border border-[#E3E4E8] bg-surface px-4 text-[14.5px] font-bold text-ink hover:border-primary hover:text-primary disabled:opacity-50";
const SELECT = "h-10 min-w-[160px] rounded-[10px] border border-[#E3E4E8] bg-surface px-3 text-[13.5px] font-bold text-ink";

type Channel = "call" | "whatsapp" | "sms" | "email";
const NOTE_EVENT = "lc-unpaid-note";
const ICON: Record<Channel, AdminIconName> = { call: "phone", whatsapp: "whatsapp", sms: "sms", email: "mail" };

function useReach(leadKey: string) {
  const toast = useToast();
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const go = (channel: Channel) => {
    // Opened now, in the click, so Safari doesn't block it; it goes to WhatsApp once the click is logged.
    const tab = channel === "whatsapp" ? window.open("", "_blank") : null;
    start(async () => {
      const r = await reachLead(leadKey, channel);
      if (!r.ok || !r.href) {
        tab?.close();
        return toast(t("admin.errors.generic"), "danger");
      }
      if (tab) {
        tab.opener = null;
        tab.location.href = r.href;
      } else if (channel === "whatsapp") window.open(r.href, "_blank", "noopener,noreferrer");
      else window.location.href = r.href;
    });
  };
  return { go, pending };
}

/** Call, WhatsApp, SMS and Email in the lead's details: each click is logged, then opens the phone or mail app. */
export function ReachButtons({ leadKey, has }: { leadKey: string; has: { mobile: boolean; email: boolean } }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const { go, pending } = useReach(leadKey);
  if (readOnly) return null;
  return (
    <>
      {has.mobile && (
        <>
          <button type="button" disabled={pending} onClick={() => go("call")} className="inline-flex min-h-11 items-center gap-2 rounded-[12px] bg-[image:var(--gradient-red)] px-4 text-[14.5px] font-bold text-white hover:brightness-110 disabled:opacity-60">
            <AdminIcon name="phone" size={16} />
            {t("admin.unpaid.fu.list.call")}
          </button>
          <button type="button" disabled={pending} onClick={() => go("whatsapp")} className={OUTLINE}>
            <AdminIcon name="whatsapp" size={16} />
            {t("admin.unpaid.fu.list.whatsapp")}
          </button>
          <button type="button" disabled={pending} onClick={() => go("sms")} className={OUTLINE}>
            <AdminIcon name="sms" size={16} />
            {t("admin.unpaid.fu.details.sms")}
          </button>
        </>
      )}
      {has.email && (
        <button type="button" disabled={pending} onClick={() => go("email")} className={OUTLINE}>
          <AdminIcon name="mail" size={16} />
          {t("admin.unpaid.fu.details.email")}
        </button>
      )}
    </>
  );
}

/** The row's small Call and WhatsApp buttons, and Add note (opens the form as a note). */
export function QuickReach({ leadKey, has, noteHref }: { leadKey: string; has: { mobile: boolean }; noteHref: string }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const { go, pending } = useReach(leadKey);
  if (readOnly) return null;
  const btn = "relative z-10 flex size-8 items-center justify-center rounded-[9px] border border-[#E3E4E8] bg-surface text-adm-strong hover:bg-[#111216] hover:text-white disabled:opacity-50";
  return (
    <span className="flex gap-1.5">
      {has.mobile &&
        (["call", "whatsapp"] as const).map((c) => (
          <button key={c} type="button" disabled={pending} onClick={() => go(c)} title={t(`admin.unpaid.fu.list.${c}`)} aria-label={t(`admin.unpaid.fu.list.${c}`)} className={btn}>
            <AdminIcon name={ICON[c]} size={15} />
          </button>
        ))}
      <Link
        href={noteHref}
        scroll={false}
        title={t("admin.unpaid.fu.list.addNote")}
        aria-label={t("admin.unpaid.fu.list.addNote")}
        className={btn}
        // The lead may be open already (no remount): tell its form directly.
        onClick={() => window.setTimeout(() => window.dispatchEvent(new CustomEvent(NOTE_EVENT, { detail: leadKey })), 150)}
      >
        <AdminIcon name="note" size={15} />
      </Link>
    </span>
  );
}

/** The masked number and email, and "Show number and email" (logged). */
export function RevealContact({ leadKey, masked, hasEmail }: { leadKey: string; masked: string | null; hasEmail: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const readOnly = useReadOnly();
  const [shown, setShown] = useState<{ mobile: string | null; email: string | null } | null>(null);
  const [pending, start] = useTransition();
  const reveal = () =>
    start(async () => {
      const r = await reachLead(leadKey, "reveal");
      if (!r.ok) return toast(t("admin.errors.generic"), "danger");
      setShown({ mobile: r.mobile ?? null, email: r.email ?? null });
    });
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5">
      <span className="inline-flex items-center gap-2">
        <AdminIcon name="phone" size={15} className="text-muted" />
        <b className="font-mono text-[14.5px]">{shown ? (shown.mobile ?? "—") : (masked ?? "—")}</b>
      </span>
      <span className="inline-flex min-w-0 items-center gap-2">
        <AdminIcon name="mail" size={15} className="text-muted" />
        <b className="truncate text-[14.5px]">{shown ? (shown.email ?? t("admin.unpaid.fu.details.noEmail")) : hasEmail ? "•••••@•••••" : t("admin.unpaid.fu.details.noEmail")}</b>
      </span>
      {!shown && !readOnly && (
        <button type="button" disabled={pending} onClick={reveal} className="text-[13.5px] font-bold text-primary hover:underline disabled:opacity-50">
          {t("admin.unpaid.fu.details.reveal")}
        </button>
      )}
    </span>
  );
}

/** An hour from now in Dhaka, as a date-time field wants it ("2026-10-25T18:30"). */
const nowLocal = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 16);

/** Next follow-up chips, with a date-time box for "Pick date & time". */
function NextPicker({ value, onChange, picked, onPicked, idPrefix, canKeep }: { value: NextPreset; onChange: (v: NextPreset) => void; picked: string; onPicked: (v: string) => void; idPrefix: string; canKeep: boolean }) {
  const { t } = useI18n();
  return (
    <>
      <div role="radiogroup" className="flex flex-wrap gap-1.5">
        {NEXT_PRESETS.filter((p) => p !== "keep" || canKeep).map((p) => (
          <button key={p} type="button" role="radio" aria-checked={value === p} onClick={() => onChange(p)} className={chip(value === p)}>
            {t(`admin.unpaid.fu.next.${p}`)}
          </button>
        ))}
      </div>
      {value === "pick" && (
        <label htmlFor={`${idPrefix}-when`} className="flex flex-col gap-1 text-[13px] font-extrabold text-adm-strong">
          {t("admin.unpaid.fu.log.when")}
          <input id={`${idPrefix}-when`} type="datetime-local" value={picked} onChange={(e) => onPicked(e.target.value)} className="h-10 w-full max-w-[260px] rounded-[10px] border border-[#DCDEE3] px-3 text-[14px] font-medium" />
        </label>
      )}
    </>
  );
}

function OwnerSelect({ id, owners, value, onChange }: { id: string; owners: { id: string; name: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={SELECT}>
      {owners.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}

/** "Log a follow-up" (handoff §6): how, result, what was said, next follow-up, who. Result "Fake contest" opens Close as fake. */
export function LogFollowUp({ leadKey, owners, ownerId, planned }: { leadKey: string; owners: { id: string; name: string }[]; ownerId: string; planned: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const readOnly = useReadOnly();
  const [how, setHow] = useState<How>("call");
  const [result, setResult] = useState<Result | null>(null);
  const [note, setNote] = useState("");
  const [next, setNext] = useState<NextPreset>("2h");
  const [picked, setPicked] = useState(nowLocal);
  const [owner, setOwner] = useState(ownerId);
  const [error, setError] = useState<MessageKey | null>(null);
  const [fakeOpen, setFakeOpen] = useState(false);
  const [pending, start] = useTransition();
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const reset = () => (setHow("call"), setResult(null), setNote(""), setNext("2h"), setOwner(ownerId), setError(null));
  // A note leaves the planned follow-up as it is unless another time is picked; a call or message plans the next one.
  const pickHow = (h: How) => {
    setHow(h);
    if (h === "note") {
      setResult(null);
      setNext(planned ? "keep" : "none");
    } else if (next === "keep" || how === "note") setNext("2h");
  };
  // "Add note" on a row opens here as a note: on arrival (#log-note), or for the lead already open (its event).
  useEffect(() => {
    const asNote = () => {
      setHow("note");
      setResult(null);
      setNext(planned ? "keep" : "none");
      noteRef.current?.focus();
      noteRef.current?.scrollIntoView({ block: "center" });
    };
    if (window.location.hash === "#log-note") asNote();
    const onNote = (e: Event) => (e as CustomEvent<string>).detail === leadKey && asNote();
    window.addEventListener(NOTE_EVENT, onNote);
    return () => window.removeEventListener(NOTE_EVENT, onNote);
  }, [leadKey, planned]);
  if (readOnly) return null;
  const save = () =>
    start(async () => {
      setError(null);
      const r = await logFollowUp(leadKey, { how, result: how === "note" ? null : result, note, next, pickAt: next === "pick" ? picked : null, ownerId: owner });
      if (!r.ok) return setError(r.error);
      toast(t("admin.unpaid.fu.log.saved"));
      reset();
      router.refresh();
    });
  return (
    <form
      id="log"
      className="flex scroll-mt-24 flex-col gap-3 rounded-[16px] border border-adm-line p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <h3 className="m-0 text-[17px] font-semibold">{t("admin.unpaid.fu.log.title")}</h3>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 text-[13px] font-extrabold text-adm-strong">{t("admin.unpaid.fu.log.how")}</legend>
        <div role="radiogroup" className="flex flex-wrap gap-1.5">
          {HOWS.map((h) => (
            <button key={h} type="button" role="radio" aria-checked={how === h} onClick={() => pickHow(h)} className={chip(how === h)}>
              {h !== "note" && <AdminIcon name={ICON[h as Channel]} size={14} />}
              {t(`admin.unpaid.fu.how.${h}`)}
            </button>
          ))}
        </div>
      </fieldset>
      {how !== "note" && (
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 text-[13px] font-extrabold text-adm-strong">{t("admin.unpaid.fu.log.result")}</legend>
          <div role="radiogroup" className="flex flex-wrap gap-1.5">
            {RESULTS.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={result === r} onClick={() => (r === "fake" ? setFakeOpen(true) : setResult(r))} className={chip(result === r, r === "fake")}>
                {t(`admin.unpaid.fu.results.${r}`)}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <label className="flex flex-col gap-1.5 text-[13px] font-extrabold text-adm-strong">
        {t("admin.unpaid.fu.log.said")}
        <textarea
          ref={noteRef}
          value={note}
          maxLength={1000}
          rows={3}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("admin.unpaid.fu.log.saidHint")}
          className="min-h-[74px] rounded-[12px] border border-[#DCDEE3] px-3.5 py-3 text-[14.5px] font-medium text-ink placeholder:text-[#8A8C96] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        />
      </label>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 text-[13px] font-extrabold text-adm-strong">{t("admin.unpaid.fu.log.next")}</legend>
        <NextPicker value={next} onChange={setNext} picked={picked} onPicked={setPicked} idPrefix={`log-${leadKey}`} canKeep={planned} />
      </fieldset>
      <label className="flex flex-col gap-1.5 text-[13px] font-extrabold text-adm-strong">
        {t("admin.unpaid.fu.log.assign")}
        <OwnerSelect id={`assign-${leadKey}`} owners={owners} value={owner} onChange={setOwner} />
      </label>
      {error && <Alert tone="danger">{t(error)}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending} disabled={how !== "note" && !result}>
          <AdminIcon name="check" size={16} />
          {t("admin.unpaid.fu.log.save")}
        </Button>
        <Button type="button" variant="secondary" onClick={reset}>
          {t("admin.unpaid.fu.log.cancel")}
        </Button>
      </div>
      {fakeOpen && <CloseFakeDialog leadKey={leadKey} open onClose={() => setFakeOpen(false)} />}
    </form>
  );
}

/** The next follow-up bar's Change (an inline editor) and Done. With nothing planned: "Plan one". */
export function NextFollowUpActions({ leadKey, owners, ownerId, type, planned }: { leadKey: string; owners: { id: string; name: string }[]; ownerId: string; type: How | null; planned: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const readOnly = useReadOnly();
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState<NextPreset>("tomorrow");
  const [picked, setPicked] = useState(nowLocal);
  const [how, setHow] = useState<How>(type ?? "call");
  const [owner, setOwner] = useState(ownerId);
  const [error, setError] = useState<MessageKey | null>(null);
  const [pending, start] = useTransition();
  if (readOnly) return null;
  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: MessageKey }>, done: MessageKey) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) return setError(r.error);
      toast(t(done));
      setOpen(false);
      router.refresh();
    });
  return (
    <div className="flex w-full flex-col gap-2.5 sm:w-auto">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={cx(OUTLINE, "min-h-9 px-3 text-[13px]")}>
          {planned ? t("admin.unpaid.fu.details.change") : t("admin.unpaid.fu.details.planOne")}
        </button>
        {planned && (
          <button type="button" disabled={pending} onClick={() => run(() => followUpDone(leadKey), "admin.unpaid.fu.details.markedDone")} className={cx(OUTLINE, "min-h-9 px-3 text-[13px]")}>
            <AdminIcon name="check" size={14} />
            {t("admin.unpaid.fu.details.done")}
          </button>
        )}
      </div>
      {open && (
        <div className="flex flex-col gap-2.5 rounded-[12px] border border-[#F2D9A8] bg-surface p-3">
          <b className="text-[14px]">{t("admin.unpaid.fu.log.planTitle")}</b>
          <NextPicker value={next} onChange={setNext} picked={picked} onPicked={setPicked} idPrefix={`plan-${leadKey}`} canKeep={false} />
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-[13px] font-extrabold text-adm-strong">
              {t("admin.unpaid.fu.log.planType")}
              <select value={how} onChange={(e) => setHow(e.target.value as How)} className={SELECT}>
                {HOWS.filter((h) => h !== "note").map((h) => (
                  <option key={h} value={h}>
                    {t(`admin.unpaid.fu.type.${h}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-extrabold text-adm-strong">
              {t("admin.unpaid.fu.log.assign")}
              <OwnerSelect id={`plan-owner-${leadKey}`} owners={owners} value={owner} onChange={setOwner} />
            </label>
          </div>
          {error && <Alert tone="danger">{t(error)}</Alert>}
          <div>
            <Button size="md" loading={pending} onClick={() => run(() => planFollowUp(leadKey, { next, pickAt: next === "pick" ? picked : null, type: how, ownerId: owner }), "admin.unpaid.fu.log.planned")}>
              {t("admin.unpaid.fu.log.planSave")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** "Close as fake…" in the close row. */
export function CloseFakeButton({ leadKey }: { leadKey: string }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const [open, setOpen] = useState(false);
  if (readOnly) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-[10px] border border-[#F3D2CF] bg-surface px-3 text-[13px] font-bold text-[#B3261E] hover:bg-[#FFF8F7]">
        <AdminIcon name="flag" size={14} />
        {t("admin.unpaid.fu.close.fake")}
      </button>
      {open && <CloseFakeDialog leadKey={leadKey} open onClose={() => setOpen(false)} />}
    </>
  );
}

/** Close as fake (handoff §7): the tick, a reason and a note are needed; hide, block and stop reminders. Mounted on open, so it always starts empty. */
function CloseFakeDialog({ leadKey, open, onClose }: { leadKey: string; open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [hide, setHide] = useState(true);
  const [block, setBlock] = useState(false);
  const [stop, setStop] = useState(true);
  const [error, setError] = useState<MessageKey | null>(null);
  const [pending, start] = useTransition();
  const ready = confirmed && Boolean(reason) && note.trim().length >= 3;
  const submit = () =>
    start(async () => {
      setError(null);
      const r = await closeAsFake(leadKey, { confirmed, reason, note, hide, block, stopReminders: stop });
      if (!r.ok) return setError(r.error);
      toast(t("admin.unpaid.fu.fake.done"));
      onClose();
      router.refresh();
    });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("admin.unpaid.fu.fake.title")}
      closeLabel={t("admin.unpaid.fu.log.cancel")}
      footer={
        <div className="flex flex-col gap-2">
          {error && <Alert tone="danger">{t(error)}</Alert>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="dark" loading={pending} disabled={!ready} onClick={submit}>
              <AdminIcon name="flag" size={16} />
              {t("admin.unpaid.fu.fake.submit")}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("admin.unpaid.fu.log.cancel")}
            </Button>
          </div>
          <p className="m-0 text-[12.5px] text-muted">{t("admin.unpaid.fu.fake.footer")}</p>
        </div>
      }
    >
      <div className="flex flex-col gap-3.5">
        <p className="m-0 flex items-center gap-2.5 text-[14px] text-muted">
          <span className="flex size-[42px] shrink-0 items-center justify-center rounded-[12px] bg-[#FFE9E7] text-[#B3261E]">
            <AdminIcon name="shield" size={20} />
          </span>
          {t("admin.unpaid.fu.fake.sub")}
        </p>
        <AdmCheckbox checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} label={t("admin.unpaid.fu.fake.confirm")} />
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 text-[13px] font-extrabold text-adm-strong">{t("admin.unpaid.fu.fake.reason")}</legend>
          <div role="radiogroup" className="flex flex-wrap gap-1.5">
            {FAKE_REASONS.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={reason === r} onClick={() => setReason(r)} className={chip(reason === r)}>
                {t(`admin.unpaid.fu.fake.reasons.${r}`)}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1.5 text-[13px] font-extrabold text-adm-strong">
          {t("admin.unpaid.fu.fake.note")}
          <textarea value={note} maxLength={500} rows={3} onChange={(e) => setNote(e.target.value)} placeholder={t("admin.unpaid.fu.fake.notePlaceholder")} className="min-h-[74px] rounded-[12px] border border-[#DCDEE3] px-3.5 py-3 text-[14.5px] font-medium text-ink placeholder:text-[#8A8C96]" />
        </label>
        <fieldset className="m-0 flex flex-col gap-0.5 border-0 p-0">
          <legend className="mb-1 text-[13px] font-extrabold text-adm-strong">{t("admin.unpaid.fu.fake.also")}</legend>
          <AdmCheckbox checked={hide} onChange={(e) => setHide(e.target.checked)} label={t("admin.unpaid.fu.fake.hide")} />
          <AdmCheckbox checked={block} onChange={(e) => setBlock(e.target.checked)} label={t("admin.unpaid.fu.fake.block")} />
          <AdmCheckbox checked={stop} onChange={(e) => setStop(e.target.checked)} label={t("admin.unpaid.fu.fake.stop")} />
        </fieldset>
      </div>
    </Modal>
  );
}

/**
 * The list's search. A name, brand or LC id goes into the address as usual; a phone number or email (Unpaid · Manage) is
 * looked up by the server and only the matching leads' keys go into the address.
 */
export function LeadSearch({ q, canManage, placeholder }: { q: UnpaidQuery; canManage: boolean; placeholder: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [text, setText] = useState(q.q);
  const [pending, start] = useTransition();
  const submit = () => {
    const value = text.replace(/\s+/g, " ").trim().slice(0, 80);
    if (canManage && isContactSearch(value))
      return start(async () => {
        const r = await findLeadsByContact(value);
        if (!r.ok) return toast(t("admin.errors.generic"), "danger");
        if (!r.keys.length) return toast(t("admin.unpaid.fu.list.noneFound"), "info");
        setText("");
        router.push(unpaidHref(q, { q: "", only: r.keys, sel: null, tab: "all" }, "#ulist"), { scroll: false });
      });
    router.push(unpaidHref(q, { q: isContactSearch(value) ? "" : value, only: null, sel: null }, "#ulist"), { scroll: false });
  };
  return (
    <form
      role="search"
      className="flex min-w-[220px] flex-1 items-center gap-2 rounded-[12px] bg-[#F7F7F9] px-3 ring-1 ring-inset ring-[#E3E4E8]"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <AdminIcon name="search" size={16} className="shrink-0 text-muted" />
      <input value={text} onChange={(e) => setText(e.target.value)} maxLength={80} placeholder={placeholder} aria-label={placeholder} disabled={pending} className="h-10 min-w-0 flex-1 bg-transparent text-[14px] outline-none" />
    </form>
  );
}

/** A small menu (sort, filters) that closes once an option is picked. */
export function Dropdown({ label, active, children }: { label: string; active: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={ref} className="group relative" onClick={(e) => (e.target as HTMLElement).closest("a") && ref.current && (ref.current.open = false)}>
      <summary className={cx("flex min-h-8 cursor-pointer list-none items-center gap-1 rounded-[9px] px-2.5 text-[12.5px] font-bold [&::-webkit-details-marker]:hidden", active ? "bg-[#111216] text-white" : "border border-dashed border-[#D5D7DD] text-muted hover:text-ink")}>
        {label}
        <AdminIcon name="chevron" size={12} className="rotate-90 transition-transform group-open:-rotate-90" />
      </summary>
      <ul className="absolute left-0 z-30 mt-1 flex min-w-[190px] list-none flex-col rounded-[12px] border border-adm-line bg-surface p-1 shadow-[0_12px_32px_-12px_rgba(17,18,22,.35)]">{children}</ul>
    </details>
  );
}

/** A row in the list: selects the lead without jumping; on narrow screens it then scrolls to the details below. */
export function LeadLink({ href, className, children, label }: { href: string; className?: string; children: React.ReactNode; label: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      scroll={false}
      aria-label={label}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        router.push(href, { scroll: false });
        if (window.matchMedia("(max-width: 1250px)").matches) {
          const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          window.setTimeout(() => document.getElementById("lead")?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" }), 120);
        }
      }}
    >
      {children}
    </Link>
  );
}
