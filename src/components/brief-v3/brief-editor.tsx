"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { trackCustom } from "@/lib/analytics/meta-pixel";
import { BRIEF_LIMITS, briefLines, clipWords, countWords, firstMissing, HEADINGS, insertHeading, OTHER, sectionsDone, type BriefSource } from "@/lib/brief-v3/rules";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";

export type BriefValue = { logoName: string; text: string; category: string; other: string; source: BriefSource };
export type SuggestFn = (input: { contestId: string | null; logoName: string; category: string; other: string }) => Promise<
  { ok: true; text: string; source: BriefSource } | { ok: false; error: { key: MessageKey; params?: MessageParams; field?: string } }
>;

/** Grows with its text: no scroll inside (owner, 2026-11-08). */
function useAutoGrow(ref: React.RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [ref, value]);
}

/**
 * The new brief's editor (owner, 2026-11-08; Design/logocontest-onboarding Brief2 + BizType): the logo name, one text
 * with everything (10–5,000 words) with the 9 headings as chips, ✨ suggest from the business category, and the
 * pictures (passed in). Controlled: step 2 and "Your brief" › Edit keep the value and save it.
 */
export function BriefEditor(props: {
  value: BriefValue;
  onChange: (next: Partial<BriefValue>) => void;
  categories: { id: string; label: string }[];
  contestId: string | null;
  suggest: SuggestFn;
  photos?: React.ReactNode;
  /** A field the last save refused, with its message. */
  error?: { field?: string; message: string } | null;
  autoFocus?: boolean;
}) {
  const { t, locale } = useI18n();
  const fmt = (n: number) => formatNumber(n, locale);
  const v = props.value;
  const area = useRef<HTMLTextAreaElement>(null);
  const otherArea = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<number | null>(null);
  useAutoGrow(otherArea, v.other);
  const [pending, start] = useTransition();
  const [ask, setAsk] = useState<string | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  useLayoutEffect(() => {
    if (caret.current === null || !area.current) return;
    const at = caret.current;
    caret.current = null;
    area.current.focus();
    area.current.setSelectionRange(at, at);
  }, [v.text]);

  const words = countWords(v.text);
  const done = sectionsDone(v.text);
  const doneCount = done.filter(Boolean).length;
  const missing = firstMissing(v.text);
  const max = BRIEF_LIMITS.words.max;
  const otherWords = countWords(v.other);

  const setText = (next: string) => {
    if (countWords(next) > max) {
      setBlocked(true);
      return props.onChange({ text: clipWords(next, max) });
    }
    setBlocked(false);
    props.onChange({ text: next });
  };

  const put = (draft: string, mode: "replace" | "append") => {
    const next = mode === "replace" || !v.text.trim() ? draft : `${v.text.replace(/\s+$/, "")}\n\n${draft}`;
    props.onChange({ text: countWords(next) > max ? clipWords(next, max) : next, source: "template" });
    setAsk(null);
  };

  const suggest = () => {
    setSuggestError(null);
    if (!v.category) return setSuggestError(t("briefV3.errors.category"));
    if (v.category === OTHER && !v.other.trim()) return setSuggestError(t("briefV3.errors.otherNeeded"));
    trackCustom("brief_suggest_click", { category: v.category });
    start(async () => {
      const res = await props.suggest({ contestId: props.contestId, logoName: v.logoName, category: v.category, other: v.other });
      if (!res.ok) return setSuggestError(t(res.error.key, res.error.params));
      if (v.text.trim()) setAsk(res.text);
      else put(res.text, "replace");
    });
  };

  const fieldError = (f: string) => (props.error && props.error.field === f ? props.error.message : null);

  return (
    <>
      <div className="b3-card">
        <label className="b3-lbl" htmlFor="b3-name">
          {t("briefV3.step.logoName")}
        </label>
        <input
          id="b3-name"
          className="b3-inp"
          value={v.logoName}
          maxLength={BRIEF_LIMITS.logoName.max}
          onChange={(e) => props.onChange({ logoName: e.target.value })}
          autoComplete="organization"
          autoFocus={props.autoFocus}
          aria-invalid={Boolean(fieldError("logoName"))}
        />
        <span className="b3-note -mt-1">{t("briefV3.step.logoNameHint")}</span>
        {fieldError("logoName") && (
          <p className="b3-note b3-stop" role="alert">
            {fieldError("logoName")}
          </p>
        )}
      </div>

      <div className="b3-card" style={{ gap: 14 }}>
        <div className="flex flex-col gap-1">
          <label className="b3-lbl" htmlFor="b3-all">
            {t("briefV3.step.allTitle")}
          </label>
          <span className="b3-mut text-[13px]">{t("briefV3.step.allHint")}</span>
        </div>

        <div className="b3-suggest">
          <span className="text-[13.5px] font-semibold">{t("briefV3.step.suggestTitle")}</span>
          <div className="b3-suggest-row">
            <select className="b3-select" value={v.category} onChange={(e) => props.onChange({ category: e.target.value })} aria-label={t("briefV3.step.categoryPick")}>
              <option value="" disabled>
                {t("briefV3.step.categoryPick")}
              </option>
              {props.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
              <option value={OTHER}>{t("briefV3.step.other")}</option>
            </select>
            {v.category !== OTHER && (
              <button type="button" className="b3-btn-dark" onClick={suggest} disabled={pending}>
                {t("briefV3.step.suggest")}
              </button>
            )}
          </div>
          {v.category === OTHER && (
            <>
              <label className="mt-1 text-[13.5px] font-semibold" htmlFor="b3-other">
                {t("briefV3.step.otherLabel")}
              </label>
              <textarea
                id="b3-other"
                ref={otherArea}
                className="b3-small-area"
                rows={2}
                value={v.other}
                lang="bn"
                onChange={(e) => props.onChange({ other: countWords(e.target.value) > BRIEF_LIMITS.otherWords ? clipWords(e.target.value, BRIEF_LIMITS.otherWords) : e.target.value })}
              />
              <div className="flex items-baseline justify-between gap-2 text-[12px]">
                <span className="b3-mut">{t("briefV3.step.otherExample")}</span>
                <strong className={cx("shrink-0", otherWords >= BRIEF_LIMITS.otherWords && "b3-stop")}>{t("briefV3.step.words", { n: fmt(otherWords), max: fmt(BRIEF_LIMITS.otherWords) })}</strong>
              </div>
              <button type="button" className="b3-btn-dark w-full" onClick={suggest} disabled={pending}>
                {t("briefV3.step.suggest")}
              </button>
            </>
          )}
          {suggestError && (
            <p className="b3-note b3-stop" role="alert">
              {suggestError}
            </p>
          )}
        </div>

        {ask !== null && (
          <div className="b3-ask" role="alertdialog" aria-label={t("briefV3.step.replaceAsk")}>
            <strong className="text-[14px]">{t("briefV3.step.replaceAsk")}</strong>
            <div className="b3-ask-row">
              <button type="button" className="b3-btn sm" style={{ width: "auto", padding: "0 16px" }} onClick={() => put(ask, "replace")}>
                {t("briefV3.step.replaceYes")}
              </button>
              <button type="button" className="b3-btn2" onClick={() => put(ask, "append")}>
                {t("briefV3.step.replaceNo")}
              </button>
            </div>
          </div>
        )}

        <div className="b3-chips">
          {HEADINGS.map((h, i) => (
            <button
              key={h}
              type="button"
              className={cx("b3-chip", done[i] && "ok")}
              aria-pressed={done[i]}
              onClick={() => {
                const next = insertHeading(v.text, h);
                if (countWords(next.text) > max) return setBlocked(true);
                caret.current = next.caret;
                props.onChange({ text: next.text });
              }}
            >
              {done[i] && <span aria-hidden>✓</span>}
              {h}
            </button>
          ))}
        </div>

        <div className="b3-area">
          {v.source === "template" && (
            <div className="b3-tag-row">
              <span className="b3-tag">{t("briefV3.step.fromSuggest")}</span>
              <button type="button" className="b3-link" onClick={suggest} disabled={pending}>
                {t("briefV3.step.again")}
              </button>
            </div>
          )}
          {/* The text with its headings in red, under a see-through textarea (a textarea can't colour words). */}
          <div className="b3-edit">
            <div className="b3-mirror" aria-hidden>
              {briefLines(v.text).map((line, i) => (
                <span key={i}>
                  {i > 0 && "\n"}
                  {line.heading ? <span className="b3-h-soft">{line.raw.slice(0, line.raw.indexOf(":") + 1)}</span> : null}
                  {line.heading ? line.raw.slice(line.raw.indexOf(":") + 1) : line.raw}
                </span>
              ))}
              {"\n\u200b"}
            </div>
            <textarea id="b3-all" ref={area} value={v.text} lang="bn" onChange={(e) => setText(e.target.value)} aria-invalid={Boolean(fieldError("text"))} aria-describedby="b3-count" spellCheck={false} />
          </div>
        </div>

        <div className="b3-progress">
          <div className="b3-progress-top">
            <strong className={doneCount > 0 ? "b3-done" : undefined}>{t("briefV3.step.progress", { n: fmt(doneCount), total: fmt(HEADINGS.length) })}</strong>
            <span id="b3-count" className={cx(words >= max ? "b3-stop" : words >= BRIEF_LIMITS.words.warn ? "b3-warn" : "b3-mut")}>
              {t("briefV3.step.words", { n: fmt(words), max: fmt(max) })}
            </span>
          </div>
          <div className="b3-track" aria-hidden>
            <div className="b3-bar" style={{ width: `${(doneCount / HEADINGS.length) * 100}%` }} />
          </div>
          {(blocked || words >= max) && (
            <span className="b3-note b3-stop" role="alert">
              {t("briefV3.step.maxReached", { max: fmt(max) })}
            </span>
          )}
          <span className="b3-note">{missing ? t("briefV3.step.hintMissing", { heading: missing }) : t("briefV3.step.hintAll")}</span>
          {fieldError("text") && (
            <p className="b3-note b3-stop" role="alert">
              {fieldError("text")}
            </p>
          )}
        </div>
      </div>

      {props.photos && <div className="b3-card">{props.photos}</div>}
    </>
  );
}
