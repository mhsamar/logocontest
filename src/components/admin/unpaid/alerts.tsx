"use client";

import { useState, useTransition } from "react";
import { AdminIcon } from "@/components/admin/icons";
import { AdmCard } from "@/components/admin/ui";
import { useToast } from "@/components/ui/toast";
import { saveUnpaidAlerts, saveUnpaidReminders } from "@/lib/admin/unpaid-alert-actions";
import { ALERT_EVENTS, SEND_WAYS, type UnpaidAlerts, type UnpaidReminders } from "@/lib/admin/unpaid-alert-rules";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";

/**
 * Admin › Unpaid contests, phase 3 (owner, 2026-10-26; Design/unpaid-contests §2, §9): Instant alerts (which events, how,
 * quiet hours; one setting for the whole team, saved with Save) and Automatic reminders (each switch saves at once).
 * Unpaid · Manage changes them; everyone else sees them. SMS shows, off, until there is an SMS provider.
 */

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cx("relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50", on ? "bg-[#14633C]" : "bg-[#D5D7DD]")}
    >
      <span className={cx("absolute top-[3px] size-5 rounded-full bg-white shadow-sm motion-safe:transition-[left]", on ? "left-[21px]" : "left-[3px]")} />
    </button>
  );
}

const CHIP = "inline-flex min-h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13.5px] font-bold transition-colors disabled:cursor-not-allowed";
const chip = (on: boolean) => cx(CHIP, on ? "bg-[#111216] text-white" : "bg-[#F4F5F7] text-ink hover:bg-[#ECEDF0]");
const ROW = "flex items-center justify-between gap-3 border-b border-adm-line-soft py-2.5 last:border-b-0";

export function InstantAlerts({ value, minutes, canManage }: { value: UnpaidAlerts; minutes: { newUnpaid: number; due: number }; canManage: boolean }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [v, setV] = useState(value);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(v) !== JSON.stringify(value);
  const hour = (h: number) => new Date(Date.UTC(2026, 0, 1, h)).toLocaleTimeString(locale === "bn" ? "bn-BD" : "en-US", { hour: "numeric", hour12: true, timeZone: "UTC" });
  const save = () =>
    start(async () => {
      const r = await saveUnpaidAlerts(v);
      toast(r.ok ? t("admin.unpaid.alerts.saved") : t(r.error), r.ok ? "success" : "danger");
    });
  const params = { minutes: minutes.newUnpaid, due: minutes.due };
  return (
    <AdmCard as="section" id="unot" className="flex scroll-mt-24 flex-col gap-3 p-5" data-unpaid-alerts>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="m-0 text-[20px] font-semibold tracking-[-0.02em]">{t("admin.unpaid.alerts.title")}</h2>
          <p className="m-0 mt-1 text-[14px] text-muted">{t("admin.unpaid.alerts.sub")}</p>
        </div>
        {canManage && (
          <button type="button" onClick={save} disabled={pending || !dirty} className="inline-flex min-h-9 items-center rounded-[10px] bg-[linear-gradient(180deg,#B3201B,#8B0000)] px-4 text-[13.5px] font-bold text-white disabled:opacity-50">
            {t("admin.unpaid.alerts.save")}
          </button>
        )}
      </div>
      <div className="flex flex-col">
        {ALERT_EVENTS.map((e) => (
          <div key={e} className={ROW}>
            <span className="flex min-w-0 flex-col">
              <b className="text-[14.5px]">{t(`admin.unpaid.alerts.events.${e}.label`)}</b>
              <em className="text-[13px] not-italic text-muted">{t(`admin.unpaid.alerts.events.${e}.hint`, params)}</em>
            </span>
            <Switch on={v.events[e]} disabled={!canManage} label={t(`admin.unpaid.alerts.events.${e}.label`)} onChange={(on) => setV({ ...v, events: { ...v.events, [e]: on } })} />
          </div>
        ))}
      </div>
      <span className="text-[13px] font-extrabold text-adm-strong">{t("admin.unpaid.alerts.sendTo")}</span>
      <div className="flex flex-wrap gap-1.5">
        {SEND_WAYS.map((w) => {
          // The sound comes with the pop-up.
          const off = w === "sound" && !v.send.popup;
          return (
            <button key={w} type="button" aria-pressed={v.send[w] && !off} disabled={!canManage || off} title={off ? t("admin.unpaid.alerts.soundNeedsPopup") : undefined} onClick={() => setV({ ...v, send: { ...v.send, [w]: !v.send[w] } })} className={cx(chip(v.send[w] && !off), off && "opacity-50")}>
              {v.send[w] && !off && <AdminIcon name="check" size={13} />}
              {t(`admin.unpaid.alerts.ways.${w}`)}
            </button>
          );
        })}
        <button type="button" disabled aria-pressed={false} title={t("admin.unpaid.alerts.smsOff")} className={cx(chip(false), "opacity-50")}>
          {t("admin.unpaid.alerts.ways.sms")}
        </button>
      </div>
      <p className="m-0 text-[12.5px] text-muted">{t("admin.unpaid.alerts.smsOff")}</p>
      <span className="text-[13px] font-extrabold text-adm-strong">{t("admin.unpaid.alerts.quiet")}</span>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" aria-pressed={v.quiet.on} disabled={!canManage} onClick={() => setV({ ...v, quiet: { ...v.quiet, on: true } })} className={chip(v.quiet.on)}>
          {t("admin.unpaid.alerts.quietWindow", { from: hour(v.quiet.from), to: hour(v.quiet.to) })}
        </button>
        <button type="button" aria-pressed={!v.quiet.on} disabled={!canManage} onClick={() => setV({ ...v, quiet: { ...v.quiet, on: false } })} className={chip(!v.quiet.on)}>
          {t("admin.unpaid.alerts.quietOff")}
        </button>
      </div>
      <p className="m-0 text-[12.5px] text-muted">{t("admin.unpaid.alerts.quietNote")}</p>
      {!canManage && <p className="m-0 text-[12.5px] font-semibold text-muted">{t("admin.unpaid.alerts.manageOnly")}</p>}
    </AdmCard>
  );
}

export function AutoReminders({ value, hours, canManage }: { value: UnpaidReminders; hours: { first: number; last: number }; canManage: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const [v, setV] = useState(value);
  const [pending, start] = useTransition();
  const flip = (k: keyof UnpaidReminders, on: boolean) => {
    const next = { ...v, [k]: on };
    setV(next);
    start(async () => {
      const r = await saveUnpaidReminders(next);
      if (!r.ok) {
        setV(v);
        toast(t(r.error), "danger");
      } else toast(t("admin.unpaid.reminders.saved"));
    });
  };
  const span = (h: number) => (h % 24 === 0 && h >= 48 ? t("admin.unpaid.reminders.days", { n: h / 24 }) : h === 1 ? t("admin.unpaid.reminders.hour") : t("admin.unpaid.reminders.hours", { n: h }));
  return (
    <AdmCard as="section" className="flex flex-col gap-3 p-5" data-unpaid-reminders>
      <div className="min-w-0">
        <h2 className="m-0 text-[20px] font-semibold tracking-[-0.02em]">{t("admin.unpaid.reminders.title")}</h2>
        <p className="m-0 mt-1 text-[14px] text-muted">{t("admin.unpaid.reminders.sub")}</p>
      </div>
      <div className="flex flex-col">
        <div className={ROW}>
          <span className="flex min-w-0 flex-col">
            <b className="text-[14.5px]">{t("admin.unpaid.reminders.after", { time: span(hours.first) })}</b>
            <em className="text-[13px] not-italic text-muted">{t("admin.unpaid.reminders.first")}</em>
          </span>
          <Switch on={v.first} disabled={!canManage || pending} label={t("admin.unpaid.reminders.first")} onChange={(on) => flip("first", on)} />
        </div>
        <div className={ROW}>
          <span className="flex min-w-0 flex-col">
            <b className="text-[14.5px]">{t("admin.unpaid.reminders.after", { time: span(24) })}</b>
            <em className="text-[13px] not-italic text-muted">{t("admin.unpaid.reminders.sms")}</em>
            <em className="text-[12.5px] font-semibold not-italic text-[#8A5A00]">{t("admin.unpaid.alerts.smsOff")}</em>
          </span>
          <Switch on={false} disabled label={t("admin.unpaid.reminders.sms")} onChange={() => undefined} />
        </div>
        <div className={ROW}>
          <span className="flex min-w-0 flex-col">
            <b className="text-[14.5px]">{t("admin.unpaid.reminders.after", { time: span(hours.last) })}</b>
            <em className="text-[13px] not-italic text-muted">{t("admin.unpaid.reminders.last")}</em>
          </span>
          <Switch on={v.last} disabled={!canManage || pending} label={t("admin.unpaid.reminders.last")} onChange={(on) => flip("last", on)} />
        </div>
      </div>
      <p className="m-0 text-[12.5px] text-muted">{t("admin.unpaid.reminders.note")}</p>
      {!canManage && <p className="m-0 text-[12.5px] font-semibold text-muted">{t("admin.unpaid.alerts.manageOnly")}</p>}
    </AdmCard>
  );
}
