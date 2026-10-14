"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { saveText } from "@/lib/content/actions";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { saveOnboarding } from "@/lib/onboarding/actions";
import type { ExtraQuestion, OnboardingConfig, OnboardingFlow } from "@/lib/onboarding/config";
import { QuestionFields } from "./question-fields";
import { useReadOnly } from "./read-only";
import { ADM_INPUT } from "./ui";

export type EditorText = { key: string; en: string; bn: string };
export type EditorQuestion = { key: string; step: number; hideable: boolean; label: string; texts: EditorText[] };
export type EditorStep = { step: number; title: string };

/** One built-in question's wording: every text it shows, English and Bangla, each saved to the site texts. */
function Wording({ texts }: { texts: EditorText[] }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const readOnly = useReadOnly();
  const [values, setValues] = useState(texts);
  const [busy, start] = useTransition();
  const save = () =>
    start(async () => {
      for (const v of values) {
        const before = texts.find((x) => x.key === v.key)!;
        if (before.en === v.en && before.bn === v.bn) continue;
        const res = await saveText(v.key, { en: v.en, bn: v.bn });
        if (!res.ok) return toast(t(res.error), "danger");
      }
      toast(t("admin.saved"));
      router.refresh();
    });
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-[12px] bg-surface p-3 ring-1 ring-[#E6E7EB]">
      {values.map((v, i) => (
        <div key={v.key} className="grid gap-2 sm:grid-cols-2">
          {(["en", "bn"] as const).map((l) => (
            <label key={l} className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
              {l === "en" ? t("admin.services.english") : t("admin.services.bangla")}
              <textarea
                value={v[l]}
                lang={l}
                disabled={readOnly}
                rows={v[l].length > 70 ? 3 : 1}
                onChange={(e) => setValues(values.map((x, j) => (j === i ? { ...x, [l]: e.target.value } : x)))}
                className="min-h-11 w-full rounded-[12px] border border-[#dcdee3] bg-surface px-3 py-2.5 text-[15px] text-ink focus:outline-2 focus:outline-primary"
              />
            </label>
          ))}
        </div>
      ))}
      <button type="button" disabled={readOnly || busy} onClick={save} className="self-start rounded-[10px] bg-ink px-4 py-2.5 text-[14.5px] font-bold text-white disabled:opacity-40">
        {t("admin.onboarding.saveWording")}
      </button>
    </div>
  );
}

/**
 * Admin › Onboarding (owner, 2026-10-14): every question, step by step; optional ones can be hidden, every one's
 * wording edited; and the owner's own questions, each on the step the owner picks, in the owner's order.
 */
export function OnboardingEditor({ flow, steps, questions, initial, extraSteps }: { flow: OnboardingFlow; steps: EditorStep[]; questions: EditorQuestion[]; initial: OnboardingConfig; extraSteps: number[] }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const readOnly = useReadOnly();
  const [hidden, setHidden] = useState<string[]>(initial.hidden);
  const [extra, setExtra] = useState<ExtraQuestion[]>(initial.extra);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const dirty = JSON.stringify({ hidden, extra }) !== JSON.stringify(initial);
  const title = (step: number) => steps.find((s) => s.step === step)?.title ?? String(step);

  const save = () =>
    start(async () => {
      const res = await saveOnboarding(flow, { hidden, extra });
      if (!res.ok) return toast(t(res.error), "danger");
      toast(t("admin.saved"));
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-[16px] border border-adm-line bg-surface p-4 sm:p-5">
        <h2 className="m-0 text-[17px] font-semibold">{t("admin.onboarding.builtIn")}</h2>
        <p className="m-0 mt-1 text-[14px] text-muted">{t("admin.onboarding.builtInLead")}</p>
        <ol className="m-0 mt-3 flex list-none flex-col gap-4 p-0">
          {steps.map((s, si) => {
            const own = questions.filter((q) => q.step === s.step);
            const mine = extra.filter((q) => q.step === s.step);
            return (
              <li key={s.step}>
                <p className="m-0 text-[13px] font-bold uppercase tracking-wide text-muted">{t("admin.onboarding.step", { n: String(si + 1), title: s.title })}</p>
                <ul className="m-0 mt-1.5 flex list-none flex-col gap-2 p-0">
                  {own.map((q) => {
                    const off = hidden.includes(q.key);
                    return (
                      <li key={q.key} className={cx("rounded-[12px] bg-[#F7F8FA] px-3.5 py-3", off && "opacity-60")}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="min-w-0 text-[15px] font-semibold text-ink">{q.label}</span>
                          <span className="flex flex-wrap items-center gap-2">
                            {q.hideable ? (
                              <button
                                type="button"
                                role="switch"
                                aria-checked={!off}
                                disabled={readOnly}
                                onClick={() => setHidden((h) => (h.includes(q.key) ? h.filter((k) => k !== q.key) : [...h, q.key]))}
                                className={cx("min-h-9 rounded-full px-3 text-[13.5px] font-bold ring-1", off ? "bg-surface text-muted ring-[#dcdee3]" : "bg-[#E8F5EE] text-[#1F7A4D] ring-[#BFE3CE]")}
                              >
                                {off ? t("admin.onboarding.hidden") : t("admin.onboarding.shown")}
                              </button>
                            ) : (
                              <span className="rounded-full bg-surface px-3 py-1 text-[13px] font-semibold text-muted ring-1 ring-[#E6E7EB]">{t("admin.onboarding.always")}</span>
                            )}
                            <button type="button" onClick={() => setOpen(open === q.key ? null : q.key)} className="min-h-9 rounded-full px-3 text-[13.5px] font-bold text-primary hover:underline">
                              {t("admin.onboarding.editWording")}
                            </button>
                          </span>
                        </div>
                        {open === q.key && <Wording texts={q.texts} />}
                      </li>
                    );
                  })}
                  {mine.map((q) => (
                    <li key={`x-${q.key}`} className="rounded-[12px] border border-dashed border-[#B9BCC4] px-3.5 py-2.5 text-[14.5px] text-ink">
                      {q.label.en || q.key} <span className="text-[13px] text-muted">· {t("admin.onboarding.yours")}</span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="flex flex-col gap-3 rounded-[16px] border border-adm-line bg-surface p-4 sm:p-5">
        <h2 className="m-0 text-[17px] font-semibold">{t("admin.onboarding.own")}</h2>
        <p className="m-0 text-[14px] text-muted">{t(`admin.onboarding.ownLead.${flow}` as MessageKey)}</p>
        <QuestionFields<ExtraQuestion>
          fields={extra}
          onChange={setExtra}
          readOnly={readOnly}
          move
          make={(base) => ({ ...base, step: extraSteps[0] })}
          extra={(f, set) => (
            <label className="flex flex-col gap-1 text-[14px] font-bold text-ink">
              {t("admin.onboarding.askOn")}
              <select value={f.step} disabled={readOnly} onChange={(e) => set({ step: Number(e.target.value) })} className={ADM_INPUT}>
                {extraSteps.map((n) => (
                  <option key={n} value={n}>
                    {title(n)}
                  </option>
                ))}
              </select>
            </label>
          )}
        />
      </section>

      <div className="sticky bottom-3 z-10 flex justify-end">
        <button type="button" disabled={readOnly || busy || !dirty} onClick={save} className="min-h-12 rounded-[14px] bg-[image:var(--gradient-red)] px-6 text-[15.5px] font-bold text-white shadow-[var(--shadow-glow)] disabled:opacity-40">
          {t("admin.onboarding.save")}
        </button>
      </div>
    </div>
  );
}
