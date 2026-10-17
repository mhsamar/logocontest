"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { moveService, saveService, setServiceOn } from "@/lib/services/admin-actions";
import { ENTRY_FILE_TYPES, FINAL_FILE_TYPES, LIMITS, sizeText, type Lang, type ServiceDef } from "@/lib/services/types";
import { ADM_INPUT } from "./ui";
import { LangPair, QuestionFields } from "./question-fields";
import { useReadOnly } from "./read-only";

const LABEL = "flex flex-col gap-1 text-[14px] font-bold text-ink";
const empty = (): Lang => ({ en: "", bn: "" });

function Switch({ on, label, disabled, onClick }: { on: boolean; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cx("relative block h-[30px] w-[52px] flex-none rounded-full transition-colors focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#E2B13C] disabled:cursor-not-allowed disabled:opacity-60", on ? "bg-[linear-gradient(180deg,#2BB673,#1F7A4D)]" : "bg-[#D5D7DD]")}
    >
      <span className={cx("absolute left-[3px] top-[3px] size-6 rounded-full bg-white shadow-[0_2px_6px_rgba(17,18,22,.25)] transition-transform duration-300", on && "translate-x-[22px]")} />
    </button>
  );
}

/**
 * Admin → Services (owner, 2026-10-13): every contest service with its On / Off switch, its order, and an editor for
 * its texts, size, uploads, brief questions and defaults. New services start off.
 */
export function ServicesEditor({ services, ready }: { services: ServiceDef[]; ready: boolean }) {
  const { t, locale } = useI18n();
  const readOnly = useReadOnly();
  const router = useRouter();
  const toast = useToast();
  const [busy, start] = useTransition();
  const [editing, setEditing] = useState<{ s: ServiceDef; isNew: boolean } | null>(null);
  const l = (x: Lang) => (locale === "bn" ? x.bn || x.en : x.en);
  const run = (p: Promise<{ ok: true } | { ok: false; error: Parameters<typeof t>[0] }>, after?: () => void) =>
    start(async () => {
      const r = await p;
      if (!r.ok) return toast(t(r.error), "danger");
      toast(t("admin.saved"));
      after?.();
      router.refresh();
    });
  const blank: ServiceDef = {
    slug: "",
    builtIn: false,
    on: false,
    position: 0,
    name: empty(),
    short: empty(),
    clientInstruction: empty(),
    designerInstruction: empty(),
    width: 0,
    height: 0,
    entryTypes: ["png", "jpg"],
    maxImages: 4,
    maxMb: 8,
    finalTypes: ["png", "jpg"],
    fields: [],
    defaultPrize: 1500,
    minPrize: 1000,
    defaultDays: 4,
    winners: 1,
  };

  const live = services.filter((s) => s.on).length;
  const files = (s: ServiceDef) => sizeText(s) || s.finalTypes.map((x) => x.toUpperCase()).join(", ");
  const Tick = () => (
    <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );

  return (
    <div className="flex flex-col gap-3">
      {!ready && <p className="m-0 rounded-xl bg-[#FFF7ED] px-4 py-3 text-[14.5px] text-[#7A3A0C]">{t("admin.services.notReady")}</p>}
      <div className="flex justify-end">
        <button type="button" disabled={readOnly || !ready} onClick={() => setEditing({ s: blank, isNew: true })} className="inline-flex min-h-11 items-center rounded-[12px] bg-primary px-4 text-[15px] font-bold text-white disabled:opacity-50">
          {t("admin.services.add")}
        </button>
      </div>
      {/* Owner, 2026-10-13: laid out like Design/home-page/admin-services.html. */}
      <div className="grid items-start gap-5 min-[1181px]:grid-cols-[minmax(0,1fr)_380px]">
        <section className="flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-adm-line bg-surface">
          <div className="grid grid-cols-[minmax(0,1fr)_128px_112px_150px] gap-3.5 bg-[#FAFAFB] py-3 pl-[78px] pr-5 text-[12.5px] font-extrabold uppercase tracking-[.05em] text-[#6A6D76] max-[700px]:hidden">
            <span>{t("admin.services.board.service")}</span>
            <span>{t("admin.services.board.prize")}</span>
            <span>{t("admin.services.board.status")}</span>
            <span className="text-right">{t("admin.services.board.onOff")}</span>
          </div>
          <ul className="m-0 list-none p-0">
            {services.map((s, i) => (
              <li
                key={s.slug}
                data-service={s.slug}
                className="grid grid-cols-[44px_minmax(0,1fr)_128px_112px_150px] items-center gap-3.5 border-t border-[#EEEFF2] px-5 py-3 transition-colors hover:bg-[#FCF8F7] max-[700px]:grid-cols-[44px_minmax(0,1fr)] max-[700px]:gap-y-1.5"
              >
                <span aria-hidden className={cx("flex size-11 items-center justify-center rounded-[12px] font-display text-[18px] font-bold transition-colors", s.on ? "bg-[linear-gradient(180deg,#B3201B,#8B0000)] text-white" : "bg-[#F0F1F4] text-[#8A8D96]")}>
                  {l(s.name).charAt(0).toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <b className="text-[16px]">{l(s.name)}</b>
                    {s.builtIn && <span className="rounded-full bg-[#F4F5F7] px-2 py-0.5 text-[12px] font-bold text-muted">{t("admin.services.builtIn")}</span>}
                  </span>
                  <span className="text-[13px] text-[#6A6D76]">{files(s)}</span>
                </span>
                <span className="text-[14px] font-bold text-[#3A3C45] max-[700px]:col-start-2">{t("admin.services.board.prizeFrom", { amount: `৳${s.minPrize.toLocaleString("en-US")}` })}</span>
                <span className="max-[700px]:col-start-2">
                  <span className={cx("inline-flex whitespace-nowrap rounded-full px-[11px] py-1 text-[13px] font-bold", s.on ? "bg-[#E4F5EC] text-[#14633C]" : "bg-[#F0F1F4] text-[#6A6D76]")}>{s.on ? t("admin.services.board.live") : t("admin.services.board.soon")}</span>
                </span>
                <span className="flex items-center justify-end gap-1.5 max-[700px]:col-start-2 max-[700px]:justify-start">
                  <span className="flex flex-col">
                    <button type="button" aria-label={t("admin.services.up", { name: l(s.name) })} disabled={readOnly || busy || i === 0 || !ready} onClick={() => run(moveService(s.slug, -1))} className="flex h-[18px] w-7 items-center justify-center rounded text-[11px] text-muted hover:bg-[#F4F5F7] hover:text-ink disabled:opacity-30">
                      ▲
                    </button>
                    <button type="button" aria-label={t("admin.services.down", { name: l(s.name) })} disabled={readOnly || busy || i === services.length - 1 || !ready} onClick={() => run(moveService(s.slug, 1))} className="flex h-[18px] w-7 items-center justify-center rounded text-[11px] text-muted hover:bg-[#F4F5F7] hover:text-ink disabled:opacity-30">
                      ▼
                    </button>
                  </span>
                  <button type="button" onClick={() => setEditing({ s, isNew: false })} disabled={!ready} className="inline-flex min-h-9 items-center rounded-[10px] border border-[#DCDEE3] bg-white px-3 text-[14px] font-bold disabled:opacity-50">
                    {readOnly ? t("admin.services.view") : t("admin.services.edit")}
                  </button>
                  <Switch on={s.on} label={t("admin.services.switchLabel", { name: l(s.name) })} disabled={readOnly || busy || !ready} onClick={() => run(setServiceOn(s.slug, !s.on))} />
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[#EEEFF2] bg-[#FAFAFB] px-5 py-3.5 text-[14px] text-[#5F626B]">
            <span className="font-extrabold text-[#14633C]" data-live-count={live}>
              {t("admin.services.board.count", { on: String(live), total: String(services.length) })}
            </span>
            <span>{t("admin.services.board.rightAway")}</span>
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <div className="flex flex-col gap-2.5 rounded-[20px] border border-adm-line bg-surface p-[18px]">
            <h2 className="m-0 text-[18px] font-bold">{t("admin.services.board.previewTitle")}</h2>
            <p className="m-0 text-[13.5px] text-[#6A6D76]">{t("admin.services.board.previewLead")}</p>
            <div className="grid grid-cols-3 gap-2">
              {services.map((s) => (
                <span key={s.slug} className={cx("flex min-h-[52px] items-center justify-center rounded-[12px] p-1.5 text-center text-[12px] font-bold leading-[1.2] transition-colors", s.on ? "bg-[linear-gradient(180deg,#B3201B,#8B0000)] text-white shadow-[0_6px_14px_rgba(139,0,0,.25)]" : "bg-[#F0F1F4] text-[#8A8D96]")}>
                  {l(s.name)}
                </span>
              ))}
            </div>
            <div className="flex gap-3.5 text-[12.5px] text-[#6A6D76]">
              <span className="inline-flex items-center gap-1.5">
                <i className="size-3 rounded bg-[#8B0000]" />
                {t("admin.services.board.keyOpen")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="size-3 rounded bg-[#D5D7DD]" />
                {t("admin.services.board.keySoon")}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 rounded-[20px] border border-adm-line bg-surface p-[18px]">
            <h2 className="m-0 text-[18px] font-bold">{t("admin.services.board.howTitle")}</h2>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {(["n1", "n2", "n3", "n4", "n5"] as const).map((k) => (
                <li key={k} className="flex gap-2.5">
                  <span className="flex size-6 flex-none items-center justify-center rounded-lg bg-[#E4F5EC] text-[#14633C]">
                    <Tick />
                  </span>
                  <span>
                    <b className="block text-[14.5px]">{t(`admin.services.board.${k}.title`)}</b>
                    <span className="text-[13.5px] text-[#5F626B]">{t(`admin.services.board.${k}.text`)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
      {editing && <ServiceForm key={editing.s.slug || "new"} initial={editing.s} isNew={editing.isNew} readOnly={readOnly} busy={busy} onClose={() => setEditing(null)} onSave={(v) => run(saveService(v, editing.isNew), () => setEditing(null))} />}
    </div>
  );
}


function ServiceForm({ initial, isNew, readOnly, busy, onClose, onSave }: { initial: ServiceDef; isNew: boolean; readOnly: boolean; busy: boolean; onClose: () => void; onSave: (v: ServiceDef) => void }) {
  const { t } = useI18n();
  const [s, setS] = useState<ServiceDef>(initial);
  const set = <K extends keyof ServiceDef>(k: K, v: ServiceDef[K]) => setS((x) => ({ ...x, [k]: v }));
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const num = (k: "width" | "height" | "maxImages" | "maxMb" | "defaultPrize" | "minPrize" | "defaultDays", label: string) => (
    <label className={LABEL}>
      {label}
      <input type="number" inputMode="numeric" value={s[k]} disabled={readOnly} onChange={(e) => set(k, Number(e.target.value))} className={ADM_INPUT} />
    </label>
  );

  return (
    <Modal open onClose={onClose} title={isNew ? t("admin.services.addTitle") : t("admin.services.editTitle", { name: initial.name.en })} closeLabel={t("common.close")} size="wide">
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(s);
        }}
      >
        {isNew && (
          <label className={LABEL}>
            {t("admin.services.slug")}
            <input value={s.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} maxLength={40} className={ADM_INPUT} />
            <span className="text-[13px] font-medium text-muted">{t("admin.services.slugHint")}</span>
          </label>
        )}
        <LangPair label={t("admin.services.name")} value={s.name} onChange={(v) => set("name", v)} max={60} disabled={readOnly} />
        <LangPair label={t("admin.services.short")} value={s.short} onChange={(v) => set("short", v)} max={200} disabled={readOnly} />
        <LangPair label={t("admin.services.clientInstruction")} value={s.clientInstruction} onChange={(v) => set("clientInstruction", v)} max={2000} long disabled={readOnly} />
        <LangPair label={t("admin.services.designerInstruction")} value={s.designerInstruction} onChange={(v) => set("designerInstruction", v)} max={2000} long disabled={readOnly} />

        <fieldset className="m-0 grid gap-3 border-0 p-0 sm:grid-cols-4">
          <legend className="mb-1 text-[14px] font-bold text-ink">{t("admin.services.sizeTitle")}</legend>
          {num("width", t("admin.services.width"))}
          {num("height", t("admin.services.height"))}
          {num("maxImages", t("admin.services.maxImages"))}
          {num("maxMb", t("admin.services.maxMb"))}
          <p className="m-0 text-[13px] text-muted sm:col-span-4">{t("admin.services.sizeHint")}</p>
        </fieldset>

        {(
          [
            ["entryTypes", ENTRY_FILE_TYPES, t("admin.services.entryTypes")],
            ["finalTypes", FINAL_FILE_TYPES, t("admin.services.finalTypes")],
          ] as const
        ).map(([k, all, label]) => (
          <fieldset key={k} className="m-0 flex flex-wrap gap-2 border-0 p-0">
            <legend className="mb-1 text-[14px] font-bold text-ink">{label}</legend>
            {all.map((v) => {
              const list = s[k] as string[];
              return (
                <label key={v} className={cx("inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[14px] font-bold uppercase ring-1", list.includes(v) ? "bg-ink text-white ring-ink" : "bg-white ring-[#dcdee3]")}>
                  <input type="checkbox" className="sr-only" checked={list.includes(v)} disabled={readOnly} onChange={() => set(k, toggle(list, v) as never)} />
                  {v}
                </label>
              );
            })}
          </fieldset>
        ))}

        <fieldset className="m-0 grid gap-3 border-0 p-0 sm:grid-cols-4">
          <legend className="mb-1 text-[14px] font-bold text-ink">{t("admin.services.defaults")}</legend>
          {num("defaultPrize", t("admin.services.defaultPrize"))}
          {num("minPrize", t("admin.services.minPrize"))}
          {num("defaultDays", t("admin.services.defaultDays"))}
          <label className={LABEL}>
            {t("admin.services.winners")}
            <input value="1" disabled className={ADM_INPUT} />
            <span className="text-[12.5px] font-medium text-muted">{t("admin.services.winnersHint")}</span>
          </label>
        </fieldset>

        {s.builtIn ? (
          <p className="m-0 rounded-xl bg-[#F4F5F7] px-4 py-3 text-[14px] text-muted">{t("admin.services.logoNote")}</p>
        ) : (
          <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
            <legend className="mb-1 text-[14px] font-bold text-ink">{t("admin.services.fields")}</legend>
            <p className="m-0 text-[13px] text-muted">{t("admin.services.fieldsHint")}</p>
            <QuestionFields
              fields={s.fields}
              onChange={(fields) => set("fields", fields)}
              readOnly={readOnly}
              max={LIMITS.fields}
              // Owner, 2026-10-17: a private answer is seen only by the client, the team and the winning designer.
              extra={(f, setF) => (
                <>
                  {(f.type === "text" || f.type === "long_text" || f.type === "link") && (
                    <label className="flex items-center gap-2 text-[14px] font-bold">
                      <input type="checkbox" checked={f.private === true} disabled={readOnly} onChange={(e) => setF({ private: e.target.checked })} className="size-[18px] accent-[#8B0000]" />
                      {t("admin.services.private")}
                      <span className="font-normal text-[#6A6D78]">{t("admin.services.privateHint")}</span>
                    </label>
                  )}
                  {/* A heading above this question starts a new part of the brief (owner, 2026-10-17). */}
                  <LangPair label={t("admin.services.section")} value={f.section ?? { en: "", bn: "" }} onChange={(v) => setF({ section: v.en || v.bn ? v : undefined })} max={80} disabled={readOnly} />
                </>
              )}
            />
          </fieldset>
        )}

        <div className="flex flex-wrap justify-end gap-2.5 border-t border-adm-line pt-4">
          <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center rounded-[12px] border border-[#DCDEE3] px-4 text-[15px] font-bold">
            {t("common.cancel")}
          </button>
          {!readOnly && (
            <button type="submit" disabled={busy} className="inline-flex min-h-11 items-center rounded-[12px] bg-primary px-5 text-[15px] font-bold text-white disabled:opacity-50">
              {isNew ? t("admin.services.create") : t("admin.services.save")}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
