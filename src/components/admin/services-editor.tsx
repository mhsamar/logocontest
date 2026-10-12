"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { moveService, saveService, setServiceOn } from "@/lib/services/admin-actions";
import { ENTRY_FILE_TYPES, FIELD_TYPES, FINAL_FILE_TYPES, sizeText, type BriefField, type Lang, type ServiceDef } from "@/lib/services/types";
import { ADM_INPUT } from "./ui";
import { useReadOnly } from "./read-only";

const AREA = "min-h-[88px] w-full rounded-[12px] border border-[#dcdee3] bg-surface px-3.5 py-2.5 text-[15px] text-ink focus:outline-2 focus:outline-offset-1 focus:outline-primary";
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
      className={cx("relative block h-7 w-[46px] flex-none rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60", on ? "bg-[#14633C]" : "bg-[#B9BCC4]")}
    >
      <span className={cx("absolute top-[3px] size-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] transition-[left]", on ? "left-[21px]" : "left-[3px]")} />
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

  return (
    <div className="flex flex-col gap-3">
      {!ready && <p className="m-0 rounded-xl bg-[#FFF7ED] px-4 py-3 text-[14.5px] text-[#7A3A0C]">{t("admin.services.notReady")}</p>}
      <div className="flex justify-end">
        <button type="button" disabled={readOnly || !ready} onClick={() => setEditing({ s: blank, isNew: true })} className="inline-flex min-h-11 items-center rounded-[12px] bg-primary px-4 text-[15px] font-bold text-white disabled:opacity-50">
          {t("admin.services.add")}
        </button>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {services.map((s, i) => (
          <li key={s.slug} className="flex flex-wrap items-center gap-3 rounded-[14px] border border-adm-line bg-surface px-4 py-3.5">
            <div className="flex flex-col">
              <button type="button" aria-label={t("admin.services.up", { name: l(s.name) })} disabled={readOnly || busy || i === 0 || !ready} onClick={() => run(moveService(s.slug, -1))} className="px-1 text-muted hover:text-ink disabled:opacity-30">
                ▲
              </button>
              <button type="button" aria-label={t("admin.services.down", { name: l(s.name) })} disabled={readOnly || busy || i === services.length - 1 || !ready} onClick={() => run(moveService(s.slug, 1))} className="px-1 text-muted hover:text-ink disabled:opacity-30">
                ▼
              </button>
            </div>
            <div className="min-w-0 flex-[1_1_260px]">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-[16.5px]">{l(s.name)}</strong>
                {s.builtIn && <span className="rounded-full bg-[#F4F5F7] px-2 py-0.5 text-[12px] font-bold text-muted">{t("admin.services.builtIn")}</span>}
                <span className={cx("rounded-full px-2 py-0.5 text-[12px] font-bold", s.on ? "bg-[#E3F3EA] text-[#14633C]" : "bg-[#F4F5F7] text-muted")}>{s.on ? t("admin.services.on") : t("admin.services.off")}</span>
              </div>
              <p className="m-0 mt-0.5 text-[14px] text-muted">{l(s.short)}</p>
              <p className="m-0 mt-0.5 text-[13px] text-muted">
                {[sizeText(s), s.builtIn ? t("admin.services.logoQuestions") : t("admin.services.questions", { n: String(s.fields.length) }), t("admin.services.prizeLine", { n: `৳${s.defaultPrize}`, min: `৳${s.minPrize}`, days: String(s.defaultDays) })].filter(Boolean).join(" · ")}
              </p>
            </div>
            <button type="button" onClick={() => setEditing({ s, isNew: false })} disabled={!ready} className="inline-flex min-h-10 items-center rounded-[10px] border border-[#DCDEE3] bg-white px-3.5 text-[14.5px] font-bold disabled:opacity-50">
              {readOnly ? t("admin.services.view") : t("admin.services.edit")}
            </button>
            <Switch on={s.on} label={t("admin.services.switchLabel", { name: l(s.name) })} disabled={readOnly || busy || !ready} onClick={() => run(setServiceOn(s.slug, !s.on))} />
          </li>
        ))}
      </ul>
      {editing && <ServiceForm key={editing.s.slug || "new"} initial={editing.s} isNew={editing.isNew} readOnly={readOnly} busy={busy} onClose={() => setEditing(null)} onSave={(v) => run(saveService(v, editing.isNew), () => setEditing(null))} />}
    </div>
  );
}

function LangPair({ label, value, onChange, long, max, disabled }: { label: string; value: Lang; onChange: (v: Lang) => void; long?: boolean; max: number; disabled: boolean }) {
  const { t } = useI18n();
  const Input = long ? "textarea" : "input";
  return (
    <fieldset className="m-0 grid gap-2 border-0 p-0 sm:grid-cols-2">
      <legend className="mb-1 text-[14px] font-bold text-ink">{label}</legend>
      {(["en", "bn"] as const).map((k) => (
        <label key={k} className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
          {k === "en" ? t("admin.services.english") : t("admin.services.bangla")}
          <Input value={value[k]} maxLength={max} disabled={disabled} lang={k} onChange={(e) => onChange({ ...value, [k]: e.target.value })} className={long ? AREA : ADM_INPUT} />
        </label>
      ))}
    </fieldset>
  );
}

function ServiceForm({ initial, isNew, readOnly, busy, onClose, onSave }: { initial: ServiceDef; isNew: boolean; readOnly: boolean; busy: boolean; onClose: () => void; onSave: (v: ServiceDef) => void }) {
  const { t } = useI18n();
  const [s, setS] = useState<ServiceDef>(initial);
  const set = <K extends keyof ServiceDef>(k: K, v: ServiceDef[K]) => setS((x) => ({ ...x, [k]: v }));
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const setField = (i: number, f: Partial<BriefField>) => set("fields", s.fields.map((x, j) => (j === i ? { ...x, ...f } : x)));
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
            {s.fields.map((f, i) => (
              <div key={i} className="flex flex-col gap-2.5 rounded-[14px] bg-[#F7F8FA] p-3.5">
                <div className="grid gap-2.5 sm:grid-cols-[1fr_1fr_auto_auto]">
                  <label className={LABEL}>
                    {t("admin.services.fieldKey")}
                    <input value={f.key} maxLength={30} disabled={readOnly} onChange={(e) => setField(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} className={ADM_INPUT} />
                  </label>
                  <label className={LABEL}>
                    {t("admin.services.fieldType")}
                    <select value={f.type} disabled={readOnly} onChange={(e) => setField(i, { type: e.target.value as BriefField["type"] })} className={ADM_INPUT}>
                      {FIELD_TYPES.map((ft) => (
                        <option key={ft} value={ft}>
                          {t(`admin.services.types.${ft}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 self-end pb-3 text-[14px] font-bold">
                    <input type="checkbox" checked={f.required} disabled={readOnly} onChange={(e) => setField(i, { required: e.target.checked })} className="size-[18px] accent-[#8B0000]" />
                    {t("admin.services.required")}
                  </label>
                  <button type="button" disabled={readOnly} onClick={() => set("fields", s.fields.filter((_, j) => j !== i))} className="self-end pb-3 text-[14px] font-bold text-[#A3121B] disabled:opacity-40">
                    {t("admin.services.removeField")}
                  </button>
                </div>
                <LangPair label={t("admin.services.fieldLabel")} value={f.label} onChange={(v) => setField(i, { label: v })} max={80} disabled={readOnly} />
                <LangPair label={t("admin.services.fieldHelp")} value={f.help} onChange={(v) => setField(i, { help: v })} max={200} disabled={readOnly} />
                {(f.type === "choice" || f.type === "multi_choice") && (
                  <label className={LABEL}>
                    {t("admin.services.options")}
                    <textarea
                      value={f.options.map((o) => `${o.en} | ${o.bn}`).join("\n")}
                      disabled={readOnly}
                      onChange={(e) => setField(i, { options: e.target.value.split("\n").map((line) => { const [en, bn] = line.split("|"); return { en: (en ?? "").trim(), bn: (bn ?? en ?? "").trim() }; }) })}
                      className={AREA}
                    />
                    <span className="text-[13px] font-medium text-muted">{t("admin.services.optionsHint")}</span>
                  </label>
                )}
              </div>
            ))}
            <button type="button" disabled={readOnly || s.fields.length >= 15} onClick={() => set("fields", [...s.fields, { key: `field_${s.fields.length + 1}`, type: "text", label: empty(), help: empty(), required: false, options: [] }])} className="self-start rounded-[10px] border border-dashed border-[#B9BCC4] px-4 py-2.5 text-[14.5px] font-bold disabled:opacity-40">
              {t("admin.services.addField")}
            </button>
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
