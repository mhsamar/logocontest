"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useReadOnly } from "@/components/admin/read-only";
import { useToast } from "@/components/ui/toast";
import { saveBriefSettings } from "@/lib/brief-v3/admin-actions";
import { DEFAULT_TEMPLATES, GENERAL, type BriefCategory } from "@/lib/brief-v3/rules";
import { BUSINESS_TYPES, type BusinessType } from "@/lib/contests/brief";
import { useI18n } from "@/lib/i18n/client";

const BTN = "inline-flex min-h-10 items-center rounded-[10px] border border-adm-line bg-surface px-3 text-[13.5px] font-bold text-ink hover:border-primary disabled:opacity-50";
const INPUT = "min-h-10 w-full rounded-[10px] border border-adm-line bg-surface px-3 text-[14px] text-ink";

/**
 * Admin › Brief (owner, 2026-11-08): the switch, the business categories (add, rename, reorder, hide, remove) and one
 * suggestion template per category plus the general one. Everything is saved together with Save.
 */
export function BriefSettings(props: { on: boolean; categories: BriefCategory[]; templates: Record<string, string> }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const readOnly = useReadOnly();
  const [on, setOn] = useState(props.on);
  const [cats, setCats] = useState<BriefCategory[]>(props.categories);
  const [tpls, setTpls] = useState<Record<string, string>>(props.templates);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const setCat = (i: number, p: Partial<BriefCategory>) => setCats((list) => list.map((c, j) => (j === i ? { ...c, ...p } : c)));
  const move = (i: number, by: -1 | 1) =>
    setCats((list) => {
      const next = [...list];
      const j = i + by;
      if (j < 0 || j >= next.length) return list;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = () => {
    setError(null);
    start(async () => {
      const res = await saveBriefSettings({ on, categories: cats.map((c) => ({ ...c, id: c.id.trim().toLowerCase(), bn: c.bn.trim(), en: c.en.trim() })), templates: tpls });
      if (!res.ok) return setError(t(res.error));
      toast(t("admin.brief.saved"));
      router.refresh();
    });
  };

  const tplRows: { id: string; label: string }[] = [...cats.map((c) => ({ id: c.id, label: c.bn || c.id })), { id: GENERAL, label: t("admin.brief.general") }];

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2 rounded-[16px] border border-adm-line bg-surface p-4">
        <label className="flex items-center gap-3 text-[15px] font-bold">
          <input type="checkbox" className="size-5" checked={on} disabled={readOnly} onChange={(e) => setOn(e.target.checked)} />
          {t("admin.brief.on")}
        </label>
        <p className="m-0 text-[13px] text-muted">{t("admin.brief.onHint")}</p>
      </section>

      <section className="flex flex-col gap-3 rounded-[16px] border border-adm-line bg-surface p-4">
        <h2 className="m-0 text-[17px] font-semibold">{t("admin.brief.categories")}</h2>
        <p className="m-0 text-[13px] text-muted">{t("admin.brief.categoriesHint")}</p>
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {cats.map((c, i) => (
            <li key={i} className="grid gap-2 rounded-[12px] bg-adm-bg p-3 sm:grid-cols-[110px_1fr_1fr_150px] sm:items-end">
              <label className="flex flex-col gap-1 text-[12px] font-bold text-muted">
                {t("admin.brief.id")}
                <input className={INPUT} value={c.id} disabled={readOnly} maxLength={40} onChange={(e) => setCat(i, { id: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-bold text-muted">
                {t("admin.brief.bn")}
                <input className={INPUT} value={c.bn} disabled={readOnly} maxLength={60} lang="bn" onChange={(e) => setCat(i, { bn: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-bold text-muted">
                {t("admin.brief.en")}
                <input className={INPUT} value={c.en} disabled={readOnly} maxLength={60} onChange={(e) => setCat(i, { en: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-bold text-muted">
                {t("admin.brief.type")}
                <select className={INPUT} value={c.type} disabled={readOnly} onChange={(e) => setCat(i, { type: e.target.value as BusinessType })}>
                  {BUSINESS_TYPES.map((b) => (
                    <option key={b} value={b}>
                      {t(`wizard.businessTypes.${b}`)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap items-center gap-2 sm:col-span-4">
                <label className="flex items-center gap-2 text-[13.5px] font-semibold">
                  <input type="checkbox" checked={c.on} disabled={readOnly} onChange={(e) => setCat(i, { on: e.target.checked })} />
                  {t("admin.brief.shown")}
                </label>
                <button type="button" className={BTN} disabled={readOnly || i === 0} onClick={() => move(i, -1)} aria-label={t("admin.brief.up")}>
                  ↑
                </button>
                <button type="button" className={BTN} disabled={readOnly || i === cats.length - 1} onClick={() => move(i, 1)} aria-label={t("admin.brief.down")}>
                  ↓
                </button>
                <button type="button" className={BTN} disabled={readOnly} onClick={() => setCats((list) => list.filter((_, j) => j !== i))}>
                  {t("admin.brief.remove")}
                </button>
              </div>
            </li>
          ))}
        </ol>
        <button type="button" className={`${BTN} self-start`} disabled={readOnly} onClick={() => setCats((list) => [...list, { id: `type${list.length + 1}`, bn: "", en: "", type: "other", on: true }])}>
          + {t("admin.brief.add")}
        </button>
      </section>

      <section className="flex flex-col gap-3 rounded-[16px] border border-adm-line bg-surface p-4">
        <h2 className="m-0 text-[17px] font-semibold">{t("admin.brief.templates")}</h2>
        <p className="m-0 text-[13px] text-muted">{t("admin.brief.templatesHint")}</p>
        {tplRows.map((r) => (
          <div key={r.id} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[14px] font-bold">{r.label}</span>
              {DEFAULT_TEMPLATES[r.id] && (
                <button type="button" className="text-[13px] font-bold text-primary underline" disabled={readOnly} onClick={() => setTpls((x) => ({ ...x, [r.id]: DEFAULT_TEMPLATES[r.id] }))}>
                  {t("admin.brief.reset")}
                </button>
              )}
            </div>
            <textarea
              className="min-h-[220px] rounded-[12px] border border-adm-line bg-surface px-3 py-2 text-[14px] leading-relaxed"
              lang="bn"
              disabled={readOnly}
              value={tpls[r.id] ?? ""}
              placeholder={DEFAULT_TEMPLATES[GENERAL]}
              onChange={(e) => setTpls((x) => ({ ...x, [r.id]: e.target.value }))}
            />
          </div>
        ))}
      </section>

      {error && (
        <p className="m-0 text-[14px] font-semibold text-danger" role="alert">
          {error}
        </p>
      )}
      {!readOnly && (
        <button type="button" className="inline-flex min-h-11 items-center justify-center self-start rounded-[12px] bg-primary px-6 text-[15px] font-bold text-white disabled:opacity-50" disabled={busy} onClick={save}>
          {t("admin.brief.save")}
        </button>
      )}
    </div>
  );
}
