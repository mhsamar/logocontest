"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { resetList, saveList } from "@/lib/content/list-actions";
import { FOOTER_COLUMNS, isHexColour, LISTS, newItemId, type ListItem, type ListKey } from "@/lib/content/list-defs";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { useReadOnly } from "./read-only";

const INPUT = "block w-full min-h-10 rounded-lg bg-canvas px-3 py-2 text-sm text-ink ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-primary";
const ICON_BTN = "flex size-10 items-center justify-center rounded-full text-ink ring-1 ring-line hover:bg-canvas disabled:opacity-30";

/** A-15: one list. Edits stay in the browser until Save. */
export function ListEditor({ listKey, initial, edited, placeholders }: { listKey: ListKey; initial: ListItem[]; edited: boolean; placeholders: string[] }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const router = useRouter();
  const toast = useToast();
  const def = LISTS[listKey];
  const [items, setItems] = useState(initial);
  const [error, setError] = useState<{ text: string; item: number | null } | null>(null);
  const [busy, run] = useTransition();
  const dirty = JSON.stringify(items) !== JSON.stringify(initial);

  const patch = (i: number, p: Partial<ListItem>) => setItems((list) => list.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const setText = (i: number, locale: "en" | "bn", field: string, value: string) =>
    setItems((list) => list.map((x, j) => (j === i ? { ...x, [locale]: { ...x[locale], [field]: value } } : x)));
  const move = (i: number, by: -1 | 1) =>
    setItems((list) => {
      const next = [...list];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      return next;
    });
  const add = () =>
    setItems((list) => [
      ...list,
      {
        id: newItemId(),
        on: true,
        en: Object.fromEntries(def.fields.map((f) => [f.name, ""])),
        bn: Object.fromEntries(def.fields.map((f) => [f.name, ""])),
        ...(def.href ? { href: "/" } : {}),
        ...(def.column ? { column: "clients" as const } : {}),
        ...(def.colour ? { value: "#8b0000" } : {}),
      },
    ]);

  const save = () =>
    run(async () => {
      setError(null);
      const res = await saveList(listKey, items);
      if (!res.ok) return setError({ text: t(res.error), item: res.problem?.item ?? null });
      toast(t("admin.lists.saved"));
      router.refresh();
    });
  const reset = () =>
    run(async () => {
      setError(null);
      const res = await resetList(listKey);
      if (!res.ok) return setError({ text: t(res.error), item: null });
      toast(t("admin.lists.resetDone"));
      router.refresh();
    });

  return (
    <div className="space-y-3">
      {placeholders.length > 0 && (
        <p className="text-xs text-muted">
          {t("admin.lists.placeholders")} <span className="font-mono text-ink">{placeholders.map((n) => `{${n}}`).join(" ")}</span>
        </p>
      )}
      <fieldset disabled={readOnly} className="contents">
        <ol className="space-y-3">
          {items.map((item, i) => (
            <li key={item.id} className={cx("rounded-2xl bg-surface p-4 shadow-card ring-1", error?.item === i ? "ring-2 ring-danger" : "ring-line", !item.on && "opacity-60")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-canvas text-xs font-bold text-ink">{i + 1}</span>
                {listKey === "business_types" && <span className="font-semibold text-ink">{t(`wizard.businessTypes.${item.id}` as MessageKey)}</span>}
                {def.colour && (
                  <span className="flex items-center gap-2">
                    <input
                      type="color"
                      value={isHexColour(item.value ?? "") ? item.value : "#000000"}
                      onChange={(e) => patch(i, { value: e.target.value })}
                      aria-label={t("admin.lists.colour")}
                      className="size-10 cursor-pointer rounded-lg ring-1 ring-line"
                    />
                    <input value={item.value ?? ""} onChange={(e) => patch(i, { value: e.target.value })} aria-label={t("admin.lists.colour")} className={cx(INPUT, "w-28 font-mono")} />
                  </span>
                )}
                <label className="ml-auto inline-flex min-h-10 items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={item.on} onChange={(e) => patch(i, { on: e.target.checked })} className="size-4 accent-[var(--color-primary)]" />
                  {t("admin.lists.show")}
                </label>
                <button type="button" className={ICON_BTN} onClick={() => move(i, -1)} disabled={i === 0} aria-label={t("admin.lists.up")}>
                  ↑
                </button>
                <button type="button" className={ICON_BTN} onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={t("admin.lists.down")}>
                  ↓
                </button>
                {def.canAdd && (
                  <button type="button" className={cx(ICON_BTN, "text-danger")} onClick={() => setItems((list) => list.filter((_, j) => j !== i))} aria-label={t("admin.lists.delete")}>
                    ×
                  </button>
                )}
              </div>

              {def.fields.length > 0 && (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {(["en", "bn"] as const).map((l) => (
                    <div key={l} className="space-y-2">
                      <p className="text-xs font-semibold text-muted">{t(l === "en" ? "admin.texts.english" : "admin.texts.bangla")}</p>
                      {def.fields.map((f) => {
                        const label = t(`admin.lists.fields.${f.name}` as MessageKey);
                        const props = { value: item[l][f.name] ?? "", onChange: (e: { target: { value: string } }) => setText(i, l, f.name, e.target.value), "aria-label": `${label} (${l})`, placeholder: label, lang: l, maxLength: f.max };
                        return f.long ? <textarea key={f.name} rows={3} className={cx(INPUT, "resize-y")} {...props} /> : <input key={f.name} className={INPUT} {...props} />;
                      })}
                    </div>
                  ))}
                </div>
              )}
              {(def.href || def.column) && (
                <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
                  {def.href && (
                    <input value={item.href ?? ""} onChange={(e) => patch(i, { href: e.target.value })} aria-label={t("admin.lists.fields.href")} placeholder="/contests" className={cx(INPUT, "font-mono")} />
                  )}
                  {def.column && (
                    <select value={item.column} onChange={(e) => patch(i, { column: e.target.value as ListItem["column"] })} aria-label={t("admin.lists.fields.column")} className={INPUT}>
                      {FOOTER_COLUMNS.map((c) => (
                        <option key={c} value={c}>
                          {t(`admin.lists.columns.${c}`)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      </fieldset>

      {error && <Alert tone="danger">{error.item !== null ? `${t("admin.lists.item", { n: error.item + 1 })}: ${error.text}` : error.text}</Alert>}
      {!readOnly && (
        <div className="sticky bottom-3 flex flex-wrap gap-2 rounded-2xl bg-surface/95 p-3 shadow-raised ring-1 ring-line backdrop-blur">
          {def.canAdd && (
            <Button variant="secondary" onClick={add} disabled={busy || items.length >= def.max}>
              + {t("admin.lists.add")}
            </Button>
          )}
          <Button onClick={save} loading={busy} disabled={!dirty}>
            {t("admin.lists.save")}
          </Button>
          {dirty && (
            <Button variant="ghost" onClick={() => (setItems(initial), setError(null))} disabled={busy}>
              {t("common.cancel")}
            </Button>
          )}
          {edited && !dirty && (
            <Button variant="ghost" onClick={reset} disabled={busy}>
              {t("admin.lists.reset")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
