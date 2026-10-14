"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { useReadOnly } from "./read-only";

export type ActionField =
  | { name: string; kind: "reason"; label?: string; hint?: string; /** Ready-made reasons: a tap fills the box (owner, 2026-10-14). */ suggestions?: { label: string; text: string }[] }
  | { name: string; kind: "number"; label: string; min?: number; max?: number; defaultValue?: string; hint?: string }
  | { name: string; kind: "text"; label: string; defaultValue?: string; hint?: string }
  | { name: string; kind: "select"; label: string; options: { value: string; label: string }[]; defaultValue?: string };

type Result = { ok: true } | { ok: false; error: MessageKey };

/**
 * One admin action behind a button: a sheet with its fields (a reason by default), confirm, toast, refresh.
 * Every destructive admin action asks for a short reason (UI-JOURNEY §7).
 */
export function AdminAction({
  label,
  title,
  body,
  confirm,
  done,
  tone = "secondary",
  size = "md",
  fields = [{ name: "reason", kind: "reason" }],
  run,
}: {
  label: string;
  title?: string;
  body?: string;
  confirm?: string;
  done?: string;
  tone?: "primary" | "secondary" | "danger" | "ghost";
  size?: "md" | "lg";
  fields?: ActionField[];
  run: (f: Record<string, string>) => Promise<Result>;
}) {
  const readOnly = useReadOnly();
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const initial = () => Object.fromEntries(fields.map((f) => [f.name, "defaultValue" in f && f.defaultValue ? f.defaultValue : f.kind === "select" ? f.options[0]?.value ?? "" : ""]));
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const set = (name: string, v: string) => setValues((x) => ({ ...x, [name]: v }));

  const go = () =>
    start(async () => {
      setError(null);
      const res = await run(values);
      if (!res.ok) return setError(t(res.error));
      setOpen(false);
      toast(done ?? t("admin.saved"));
      router.refresh();
    });
  if (readOnly) return null;

  return (
    <>
      <Button variant={tone} size={size} onClick={() => (setValues(initial()), setError(null), setOpen(true))}>
        {label}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title ?? label}
        closeLabel={t("common.close")}
        footer={
          <div className="w-full space-y-2">
            {error && <Alert tone="danger">{error}</Alert>}
            <Button block size="lg" variant={tone === "danger" ? "danger" : "primary"} onClick={go} loading={busy}>
              {confirm ?? label}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {body && <p className="text-sm leading-relaxed text-muted">{body}</p>}
          {fields.map((f) =>
            f.kind === "reason" ? (
              <div key={f.name} className="space-y-2.5">
                {f.suggestions && f.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5" data-reason-suggestions>
                    {f.suggestions.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => set(f.name, s.text)}
                        aria-pressed={values[f.name] === s.text}
                        className={
                          values[f.name] === s.text
                            ? "min-h-10 rounded-full bg-primary px-3.5 text-[14px] font-bold text-white"
                            : "min-h-10 rounded-full bg-[#F4F5F7] px-3.5 text-[14px] font-bold text-ink ring-1 ring-[#E3E5EA] hover:ring-primary"
                        }
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
                <TextAreaField
                  label={f.label ?? t("admin.reason")}
                  hint={f.hint ?? t("admin.reasonHint")}
                  value={values[f.name] ?? ""}
                  onChange={(e) => set(f.name, e.target.value)}
                  maxLength={500}
                  rows={3}
                />
              </div>
            ) : f.kind === "select" ? (
              <SelectField key={f.name} label={f.label} value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} options={f.options} placeholder={f.label} />
            ) : (
              <TextField
                key={f.name}
                label={f.label}
                hint={f.hint}
                type={f.kind === "number" ? "number" : "text"}
                inputMode={f.kind === "number" ? "numeric" : undefined}
                min={f.kind === "number" ? f.min : undefined}
                max={f.kind === "number" ? f.max : undefined}
                value={values[f.name] ?? ""}
                onChange={(e) => set(f.name, e.target.value)}
              />
            ),
          )}
        </div>
      </Modal>
    </>
  );
}
