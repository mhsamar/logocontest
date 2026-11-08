"use client";

import { useState, useTransition } from "react";
import Link from "@/components/ui/link";
import { useToast } from "@/components/ui/toast";
import { trackCustom } from "@/lib/analytics/meta-pixel";
import { v3SaveMyBrief, v3SendBriefUpdate } from "@/lib/brief-v3/actions";
import { BRIEF_LIMITS, clipWords, countDone, countWords, HEADINGS } from "@/lib/brief-v3/rules";
import { v3SuggestBrief } from "@/lib/brief-v3/wizard-actions";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { formatNumber } from "@/lib/money";
import { v2PhotosChanged } from "@/lib/onboarding/brief-actions";
import { BriefEditor, type BriefValue } from "./brief-editor";
import { BriefPhotos, type BriefPhoto, type BriefPhotoActions } from "./brief-photos";
import { BriefText } from "./brief-text";
import { PhotoStrip } from "./photo-strip";
import { whenLabel } from "./when";

export type MyBriefActions = {
  save: typeof v3SaveMyBrief;
  send: typeof v3SendBriefUpdate;
  suggest: typeof v3SuggestBrief;
  photosChanged: typeof v2PhotosChanged;
  photos?: Partial<BriefPhotoActions>;
};
const SERVER: MyBriefActions = { save: v3SaveMyBrief, send: v3SendBriefUpdate, suggest: v3SuggestBrief, photosChanged: v2PhotosChanged };

/**
 * "Your brief" after paying (owner, 2026-11-08; Design/logocontest-onboarding MyBrief): the brief exactly as designers
 * see it, ✎ Edit with the same editor as step 2 while the contest can change, and "Send update" (up to 500 words),
 * listed under earlier updates. Read-only once judging starts.
 */
export function MyBrief(props: {
  contestId: string;
  slug: string;
  status: string;
  editable: boolean;
  initial: BriefValue;
  categories: { id: string; label: string }[];
  photos: BriefPhoto[];
  photoLimits: { maxFiles: number; maxMb: number };
  updates: { id: string; text: string; createdAt: string }[];
  backHref: string;
  actions?: Partial<MyBriefActions>;
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const actions = { ...SERVER, ...props.actions };
  const fmt = (n: number) => formatNumber(n, locale);
  const [saved, setSaved] = useState<BriefValue>(props.initial);
  const [draft, setDraft] = useState<BriefValue>(props.initial);
  const [editing, setEditing] = useState(false);
  const [photos, setPhotos] = useState<BriefPhoto[]>(props.photos);
  const [photosMoved, setPhotosMoved] = useState(false);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [updates, setUpdates] = useState(props.updates);
  const [saving, startSave] = useTransition();
  const [sending, startSend] = useTransition();
  const done = countDone(saved.text);
  const noteWords = countWords(note);

  const save = () => {
    setError(null);
    if (countWords(draft.text) < BRIEF_LIMITS.words.min) return setError({ field: "text", message: t("briefV3.errors.minWords") });
    startSave(async () => {
      const res = await actions.save({ contestId: props.contestId, ...draft });
      if (!res.ok) return setError({ message: t(res.error) });
      const textMoved = draft.text !== saved.text || draft.logoName !== saved.logoName;
      // Pictures alone changed: designers are told once now (a changed text already told them).
      if (photosMoved && !textMoved) await actions.photosChanged({ contestId: props.contestId });
      setSaved(draft);
      setPhotosMoved(false);
      setEditing(false);
      toast(t("briefV3.mine.saved"));
    });
  };

  const send = () => {
    setNoteError(null);
    if (!note.trim()) return setNoteError(t("briefV3.errors.updateEmpty"));
    startSend(async () => {
      const res = await actions.send({ contestId: props.contestId, text: note });
      if (!res.ok) return setNoteError(t(res.error));
      trackCustom("brief_update_sent", { words: noteWords });
      setUpdates((u) => [res.update, ...u]);
      setNote("");
      toast(t("briefV3.mine.sent"));
    });
  };

  return (
    <div className="b3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={props.backHref} className="b3-link text-[14px]">
          ← {t("briefV3.mine.back")}
        </Link>
        {props.status === "open" ? <span className="b3-pill">● {t("briefV3.mine.live")}</span> : <span className="b3-pill plain">{t(`status.${props.status as "draft"}`)}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <h1>{t("briefV3.mine.title")}</h1>
        <p className="b3-mut m-0 text-[14.5px]">{t("briefV3.mine.sub")}</p>
      </div>

      {editing ? (
        <>
          <BriefEditor
            value={draft}
            onChange={(p) => setDraft((v) => ({ ...v, ...p }))}
            categories={props.categories}
            contestId={props.contestId}
            suggest={actions.suggest}
            error={error}
            photos={
              <BriefPhotos
                photos={photos}
                onPhotos={setPhotos}
                ensureContest={async () => props.contestId}
                limits={props.photoLimits}
                onChanged={() => setPhotosMoved(true)}
                actions={actions.photos}
              />
            }
          />
          {error && !error.field && (
            <p className="b3-note b3-stop" role="alert">
              {error.message}
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" className="b3-btn" disabled={saving} onClick={save}>
              {t("briefV3.mine.save")}
            </button>
            <button
              type="button"
              className="b3-btn2"
              style={{ minHeight: 52 }}
              disabled={saving}
              onClick={() => {
                setDraft(saved);
                setError(null);
                setEditing(false);
              }}
            >
              {t("common.cancel")}
            </button>
          </div>
        </>
      ) : (
        <div className="b3-card">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="b3-mut text-[12.5px]">{t("briefV3.mine.logoName")}</span>
              <strong className="break-words text-[20px]">{saved.logoName}</strong>
            </div>
            {props.editable && (
              <button type="button" className="b3-btn2 sm shrink-0" onClick={() => setEditing(true)}>
                {t("briefV3.mine.edit")}
              </button>
            )}
          </div>
          <div className="b3-divider" />
          <div className="flex items-center justify-between gap-2">
            <span className="b3-lbl">{t("briefV3.mine.all")}</span>
            <span className={cx("b3-pill", done === 0 && "plain")}>{t("briefV3.mine.topics", { n: fmt(done), total: fmt(HEADINGS.length) })}</span>
          </div>
          {saved.text.trim() ? <BriefText text={saved.text} small /> : <p className="b3-mut m-0 text-[14px]">{t("briefV3.mine.empty")}</p>}
          <PhotoStrip photos={photos} size="md" />
        </div>
      )}

      {!props.editable && <p className="b3-note">{t("briefV3.mine.locked")}</p>}

      {props.editable && !editing && (
        <div className="b3-card yellow">
          <label className="b3-lbl" htmlFor="b3-note">
            {t("briefV3.mine.newTitle")}
          </label>
          <textarea
            id="b3-note"
            className="b3-small-area"
            rows={2}
            lang="bn"
            value={note}
            placeholder={t("briefV3.mine.newPlaceholder")}
            onChange={(e) => setNote(countWords(e.target.value) > BRIEF_LIMITS.updateWords ? clipWords(e.target.value, BRIEF_LIMITS.updateWords) : e.target.value)}
          />
          {noteWords > BRIEF_LIMITS.updateWords - 50 && <span className={cx("b3-note", noteWords >= BRIEF_LIMITS.updateWords && "b3-stop")}>{t("briefV3.step.words", { n: fmt(noteWords), max: fmt(BRIEF_LIMITS.updateWords) })}</span>}
          {noteError && (
            <p className="b3-note b3-stop" role="alert">
              {noteError}
            </p>
          )}
          <button type="button" className="b3-btn sm" disabled={sending} onClick={send}>
            {t("briefV3.mine.send")}
          </button>
          <span className="b3-note">{t("briefV3.mine.sendNote")}</span>
        </div>
      )}

      {updates.length > 0 && (
        <div className="b3-card" style={{ gap: 10 }}>
          <p className="b3-lbl">{t("briefV3.mine.previous")}</p>
          <ul className="b3-updates">
            {updates.map((u) => (
              <li key={u.id}>
                <span className="b3-dot" aria-hidden />
                <div className="flex min-w-0 flex-col">
                  <span className="whitespace-pre-line break-words text-[14px]">{u.text}</span>
                  <span className="b3-mut text-[12px]">{whenLabel(u.createdAt, t, locale)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
