"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { saveSettings } from "@/lib/admin/site-actions";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { useReadOnly } from "./read-only";

export type SettingItem = { key: string; type: "int" | "bool" | "string" | "json"; value: string; description: string; updatedAt: string | null; options?: { value: string; label: string }[] };

const INPUT = "block w-full min-h-10 rounded-lg bg-canvas px-3 text-sm text-ink ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-primary";

/** A-11: one settings group. Saved together, with a reason for the audit log. */
/** `reasonOptional`: site content (Brand & notice) saves without a reason; it is still written to the audit log. */
export function SettingsGroup({ group, title, items, reasonOptional = false }: { group: string; title: string; items: SettingItem[]; reasonOptional?: boolean }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const router = useRouter();
  const toast = useToast();
  const start = Object.fromEntries(items.map((i) => [i.key, i.value]));
  const [values, setValues] = useState<Record<string, string>>(start);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, run] = useTransition();
  const dirty = items.some((i) => values[i.key] !== i.value);

  const save = () =>
    run(async () => {
      setError(null);
      setErrors({});
      const changed = Object.fromEntries(items.filter((i) => values[i.key] !== i.value).map((i) => [i.key, values[i.key]]));
      const res = await saveSettings(group, changed, reason);
      if (!res.ok) {
        setErrors(res.errors ?? {});
        return setError(t(res.error));
      }
      setReason("");
      toast(t("admin.settings.saved"));
      router.refresh();
    });

  return (
    <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line">
      <h2 className="font-semibold text-ink">{title}</h2>
      <div className="mt-4 divide-y divide-line">
        {items.map((i) => (
          <div key={i.key} className="grid gap-2 py-3 md:grid-cols-[minmax(0,1fr)_16rem] md:items-start md:gap-6">
            <label htmlFor={`s-${i.key}`} className="text-sm">
              <span className="font-mono text-xs text-muted">{i.key}</span>
              <span className="mt-0.5 block text-ink">{i.description}</span>
            </label>
            <div>
              {i.type === "bool" ? (
                <select id={`s-${i.key}`} disabled={readOnly} value={values[i.key]} onChange={(e) => setValues((v) => ({ ...v, [i.key]: e.target.value }))} className={INPUT}>
                  <option value="true">{t("admin.settings.on")}</option>
                  <option value="false">{t("admin.settings.off")}</option>
                </select>
              ) : i.options ? (
                <select id={`s-${i.key}`} disabled={readOnly} value={values[i.key]} onChange={(e) => setValues((v) => ({ ...v, [i.key]: e.target.value }))} className={INPUT}>
                  {i.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`s-${i.key}`}
                  readOnly={readOnly}
                  value={values[i.key]}
                  onChange={(e) => setValues((v) => ({ ...v, [i.key]: e.target.value }))}
                  inputMode={i.type === "int" ? "numeric" : undefined}
                  className={cx(INPUT, i.type === "json" && "font-mono text-xs", values[i.key] !== i.value && "ring-2 ring-primary", errors[i.key] && "ring-2 ring-danger")}
                />
              )}
              {errors[i.key] && <p className="mt-1 text-xs text-danger">{errors[i.key] === "json" ? t("admin.settings.badJson") : errors[i.key]}</p>}
            </div>
          </div>
        ))}
      </div>
      {dirty && (
        <div className="mt-4 space-y-2 rounded-xl bg-canvas p-3">
          {!reasonOptional && (
            <>
              <label className="block text-sm font-medium text-ink" htmlFor={`r-${group}`}>
                {t("admin.reason")}
              </label>
              <input id={`r-${group}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("admin.settings.reasonPlaceholder")} className={INPUT} />
            </>
          )}
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex gap-2">
            <Button onClick={save} loading={busy} disabled={!reasonOptional && reason.trim().length < 3}>
              {t("admin.settings.save")}
            </Button>
            <Button variant="ghost" onClick={() => (setValues(start), setErrors({}), setError(null))}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
