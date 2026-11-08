"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Agreement } from "@/components/wizard-v2/step-account";
import { trackCustom } from "@/lib/analytics/meta-pixel";
import { BRIEF_LIMITS, countDone, countWords } from "@/lib/brief-v3/rules";
import { v3SaveBrief, v3SuggestBrief } from "@/lib/brief-v3/wizard-actions";
import { useI18n } from "@/lib/i18n/client";
import { BriefEditor, type BriefValue } from "./brief-editor";
import { BriefPhotos, type BriefPhoto, type BriefPhotoActions } from "./brief-photos";

export type BriefStepActions = { save: typeof v3SaveBrief; suggest: typeof v3SuggestBrief; photos?: Partial<BriefPhotoActions> };
const SERVER: BriefStepActions = { save: v3SaveBrief, suggest: v3SuggestBrief };

const AUTOSAVE_MS = 10_000;
const same = (a: BriefValue, b: BriefValue) => a.logoName === b.logoName && a.text === b.text && a.category === b.category && a.other === b.other && a.source === b.source;

/**
 * Step 2 of the wizard with the new brief (owner, 2026-11-08; Design/logocontest-onboarding Brief2): the editor, saved
 * on the server every 10 seconds and when the page is hidden or left (so a closed tab loses nothing), and "Next: choose
 * the prize", which checks the text has 10 words. The first save makes the contest; saves run one after another so
 * only one is ever made.
 */
export function BriefStep(props: {
  contestId: string | null;
  initial: BriefValue;
  categories: { id: string; label: string }[];
  photos: BriefPhoto[];
  photoLimits: { maxFiles: number; maxMb: number };
  askAgreement: boolean;
  agreed: boolean;
  onAgreed: (on: boolean) => void;
  onContest: (saved: { contestId: string; slug: string; logoName: string }) => void;
  onDone: (saved: { contestId: string; slug: string; logoName: string }) => void;
  onBack: () => void;
  onBar: (el: HTMLDivElement | null) => void;
  actions?: BriefStepActions;
}) {
  const { t } = useI18n();
  const actions = props.actions ?? SERVER;
  const [value, setValue] = useState<BriefValue>(props.initial);
  const [photos, setPhotos] = useState<BriefPhoto[]>(props.photos);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const id = useRef<string | null>(props.contestId);
  const savedValue = useRef<BriefValue>(props.initial);
  const current = useRef(value);
  useLayoutEffect(() => {
    current.current = value;
  }, [value]);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const { onContest } = props;

  // One save at a time, always with the newest text: the first one makes the contest, the next ones change it.
  const save = useCallback(
    (complete: boolean) => {
      const run = chain.current.then(async () => {
        const v = current.current;
        if (!complete && id.current && same(v, savedValue.current)) return { ok: true as const, contestId: id.current, slug: "" };
        const name = v.logoName.trim();
        if (!complete && (name.length < BRIEF_LIMITS.logoName.min || countWords(v.text) > BRIEF_LIMITS.words.max)) return null;
        const res = await actions.save({ contestId: id.current, logoName: v.logoName, text: v.text, category: v.category, other: v.other, source: v.source, complete, agreed: props.agreed });
        if (res.ok) {
          const fresh = id.current !== res.contestId;
          id.current = res.contestId;
          savedValue.current = v;
          if (fresh) onContest({ contestId: res.contestId, slug: res.slug, logoName: name });
        }
        return res;
      });
      chain.current = run.catch(() => null);
      return run;
    },
    [actions, onContest, props.agreed],
  );

  useEffect(() => {
    trackCustom("wizard_step_2_view");
  }, []);

  // Every 10 seconds, and when the tab is hidden or closed.
  useEffect(() => {
    const timer = window.setInterval(() => void save(false), AUTOSAVE_MS);
    const hide = () => {
      if (document.visibilityState === "hidden") void save(false);
    };
    const leave = () => void save(false);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", leave);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", leave);
    };
  }, [save]);

  const ensureContest = async () => {
    if (id.current) return id.current;
    const res = await save(false);
    return res && res.ok ? res.contestId : null;
  };

  const next = () => {
    setError(null);
    if (countWords(value.text) < BRIEF_LIMITS.words.min) return setError({ field: "text", message: t("briefV3.errors.minWords") });
    setBusy(true);
    void save(true).then((res) => {
      setBusy(false);
      if (!res) return setError({ field: "logoName", message: t("briefV3.errors.logoName") });
      if (!res.ok) return setError({ field: res.error.field, message: t(res.error.key, res.error.params) });
      trackCustom("wizard_step_2_complete", { words: countWords(value.text), sections: countDone(value.text) });
      props.onDone({ contestId: res.contestId, slug: res.slug, logoName: value.logoName.trim() });
    });
  };

  return (
    <form
      noValidate
      className="b3"
      onSubmit={(e) => {
        e.preventDefault();
        next();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <h1>{t("briefV3.step.heading")}</h1>
        <p className="b3-mut m-0 text-[15px]">{t("briefV3.step.helper")}</p>
      </div>
      <BriefEditor
        value={value}
        onChange={(p) => setValue((v) => ({ ...v, ...p }))}
        categories={props.categories}
        contestId={props.contestId}
        suggest={actions.suggest}
        error={error}
        autoFocus={!props.initial.logoName}
        photos={<BriefPhotos photos={photos} onPhotos={setPhotos} ensureContest={ensureContest} limits={props.photoLimits} optional actions={actions.photos} />}
      />
      {props.askAgreement && (
        <div className="b3-card">
          <Agreement agreed={props.agreed} onAgreed={props.onAgreed} />
        </div>
      )}
      {error && !error.field && (
        <p className="b3-note b3-stop" role="alert">
          {error.message}
        </p>
      )}
      <div ref={(el) => props.onBar(el)} className="flex flex-col gap-2.5">
        <button type="submit" className="b3-btn" disabled={busy || (props.askAgreement && !props.agreed)}>
          {t("briefV3.step.next")}
        </button>
        <span className="b3-mut text-center text-[13px]">{t("briefV3.step.nextNote")}</span>
        <button type="button" className="b3-link self-center text-[14px]" onClick={props.onBack}>
          {t("wizardV2.back")}
        </button>
      </div>
    </form>
  );
}
