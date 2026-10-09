"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { resetText, saveText } from "@/lib/content/actions";
import type { TextProblem } from "@/lib/content/rules";
import { cx } from "@/lib/cx";
import type { Locale } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { useReadOnly } from "./read-only";

export type TextItem = { key: string; builtIn: Record<Locale, string>; current: Record<Locale, string>; names: string[] };

const BOX = "block w-full rounded-xl bg-canvas px-3 py-2 text-sm leading-relaxed text-ink ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-primary";

/** A-14: one text, English and Bangla side by side, with the built-in wording under each box. */
export function TextRow({ item }: { item: TextItem }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState(item.current);
  const [problems, setProblems] = useState<Partial<Record<Locale, TextProblem>>>({});
  const [busy, run] = useTransition();
  const dirty = values.en !== item.current.en || values.bn !== item.current.bn;
  const changed = item.current.en !== item.builtIn.en || item.current.bn !== item.builtIn.bn;

  const problemText = (p: TextProblem) =>
    p.kind === "missing" || p.kind === "extra"
      ? t(`admin.texts.problems.${p.kind}`, { names: p.names.map((n) => `{${n}}`).join(" ") })
      : t(`admin.texts.problems.${p.kind}`);

  const save = (reset: boolean) =>
    run(async () => {
      setProblems({});
      const res = reset ? await resetText(item.key) : await saveText(item.key, values);
      if (!res.ok) {
        setProblems(res.problems ?? {});
        if (!res.problems) toast(t(res.error));
        return;
      }
      if (reset) setValues(item.builtIn);
      toast(t(reset ? "admin.texts.resetDone" : "admin.texts.saved"));
      router.refresh();
    });

  return (
    <li className={cx("rounded-2xl bg-surface p-4 shadow-card ring-1", changed ? "ring-primary/40" : "ring-line")}>
      <div className="flex flex-wrap items-center gap-2">
        <code className="break-all text-xs text-muted">{item.key}</code>
        {changed && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{t("admin.texts.changed")}</span>}
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {(["en", "bn"] as const).map((l) => (
          <div key={l}>
            <label htmlFor={`${item.key}-${l}`} className="text-xs font-semibold text-ink">
              {t(l === "en" ? "admin.texts.english" : "admin.texts.bangla")}
            </label>
            <textarea
              id={`${item.key}-${l}`}
              lang={l}
              readOnly={readOnly}
              value={values[l]}
              onChange={(e) => setValues((v) => ({ ...v, [l]: e.target.value }))}
              rows={Math.min(8, Math.max(1, Math.ceil(values[l].length / 60)))}
              className={cx(BOX, "mt-1 resize-y", values[l] !== item.current[l] && "ring-2 ring-primary", problems[l] && "ring-2 ring-danger")}
            />
            {problems[l] && <p className="mt-1 text-xs text-danger">{problemText(problems[l])}</p>}
            {values[l] !== item.builtIn[l] && (
              <p className="mt-1 text-xs text-muted">
                <span className="font-semibold">{t("admin.texts.builtIn")}:</span> {item.builtIn[l]}
              </p>
            )}
          </div>
        ))}
      </div>
      {item.names.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          {t("admin.texts.keep")} <span className="font-mono text-ink">{item.names.map((n) => `{${n}}`).join(" ")}</span>
        </p>
      )}
      {!readOnly && (dirty || changed) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {dirty && (
            <>
              <Button onClick={() => save(false)} loading={busy}>
                {t("admin.texts.save")}
              </Button>
              <Button variant="ghost" onClick={() => (setValues(item.current), setProblems({}))} disabled={busy}>
                {t("common.cancel")}
              </Button>
            </>
          )}
          {changed && !dirty && (
            <Button variant="secondary" onClick={() => save(true)} loading={busy}>
              {t("admin.texts.reset")}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
