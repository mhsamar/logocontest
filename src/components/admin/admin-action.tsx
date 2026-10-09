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
  | { name: string; kind: "reason"; label?: string }
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
              <TextAreaField
                key={f.name}
                label={f.label ?? t("admin.reason")}
                hint={t("admin.reasonHint")}
                value={values[f.name] ?? ""}
                onChange={(e) => set(f.name, e.target.value)}
                maxLength={500}
                rows={3}
              />
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
