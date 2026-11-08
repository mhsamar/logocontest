"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { formatNumber } from "@/lib/money";
import { v2PreparePhoto, v2RecordPhoto, v2RemovePhoto } from "@/lib/onboarding/brief-actions";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export type BriefPhoto = { id: string; url: string; name: string };
export type BriefPhotoActions = {
  prepare: typeof v2PreparePhoto;
  record: typeof v2RecordPhoto;
  remove: typeof v2RemovePhoto;
  /** Puts the picture in storage (a local preview passes a stand-in). */
  upload: (path: string, token: string, file: File) => Promise<boolean>;
};

const SERVER: BriefPhotoActions = {
  prepare: v2PreparePhoto,
  record: v2RecordPhoto,
  remove: v2RemovePhoto,
  upload: async (path, token, file) => {
    const up = await createBrowserSupabase().storage.from("contest-files").uploadToSignedUrl(path, token, file, { contentType: file.type });
    return !up.error;
  },
};

const TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Reference pictures (owner, 2026-11-08): up to 5 JPG/PNG/WebP of 5 MB each, saved as soon as they are picked (the
 * same uploads and checks as the older brief page). The contest is saved first when it doesn't exist yet.
 */
export function BriefPhotos(props: {
  photos: BriefPhoto[];
  onPhotos: (next: BriefPhoto[]) => void;
  /** The contest's id, saving it first when needed (null: it can't be saved yet, e.g. no logo name). */
  ensureContest: () => Promise<string | null>;
  limits: { maxFiles: number; maxMb: number };
  onChanged?: () => void;
  actions?: Partial<BriefPhotoActions>;
  /** "(optional)" after the title, as in step 2. */
  optional?: boolean;
}) {
  const { t, locale } = useI18n();
  const actions = useMemo(() => ({ ...SERVER, ...props.actions }), [props.actions]);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { photos, onPhotos } = props;
  const latest = useRef(photos);
  useEffect(() => {
    latest.current = photos;
  }, [photos]);
  const max = props.limits.maxFiles;

  const add = async (files: File[]) => {
    setError(null);
    const room = max - latest.current.length;
    if (room <= 0) return setError(t("briefV3.step.photoMax", { n: formatNumber(max, locale) }));
    const picked = files.slice(0, room);
    if (files.length > room) setError(t("briefV3.step.photoMax", { n: formatNumber(max, locale) }));
    for (const f of picked) {
      if (!TYPES.includes(f.type)) {
        setError(t("briefV3.step.photoType"));
        continue;
      }
      if (f.size > props.limits.maxMb * 1024 * 1024) {
        setError(t("briefV3.step.photoSize", { mb: formatNumber(props.limits.maxMb, locale) }));
        continue;
      }
      const contestId = await props.ensureContest();
      if (!contestId) return setError(t("briefV3.step.photoNeedsName"));
      setBusy((n) => n + 1);
      try {
        const prepared = await actions.prepare({ contestId, name: f.name, type: f.type, size: f.size });
        if (!prepared.ok) {
          setError(t(prepared.error.key, prepared.error.params));
          continue;
        }
        if (!(await actions.upload(prepared.path, prepared.token, f))) {
          setError(t("auth.errors.generic"));
          continue;
        }
        const rec = await actions.record({ contestId, path: prepared.path, name: f.name, type: f.type, size: f.size, isCurrentLogo: false });
        if (!rec.ok) {
          setError(t(rec.error.key, rec.error.params));
          continue;
        }
        const next = [...latest.current, { id: rec.id, url: URL.createObjectURL(f), name: f.name }];
        latest.current = next;
        onPhotos(next);
        props.onChanged?.();
      } catch {
        setError(t("auth.errors.generic"));
      } finally {
        setBusy((n) => n - 1);
      }
    }
  };

  const remove = async (p: BriefPhoto) => {
    setError(null);
    const contestId = await props.ensureContest();
    if (!contestId) return;
    const res = await actions.remove({ contestId, fileId: p.id });
    if (!res.ok) return setError(t(res.error.key, res.error.params));
    const next = latest.current.filter((x) => x.id !== p.id);
    latest.current = next;
    onPhotos(next);
    props.onChanged?.();
  };

  return (
    <div className="flex flex-col gap-2.5">
      <p className="b3-lbl">
        {t("briefV3.step.photos")} {props.optional && <span className="b3-mut text-[13px] font-medium">{t("briefV3.step.optional")}</span>}
      </p>
      <div className="b3-thumbs">
        {photos.map((p) => (
          <div key={p.id} className="b3-thumb">
            {/* eslint-disable-next-line @next/next/no-img-element -- the picked file or a short-lived signed link */}
            <img src={p.url} alt={p.name} />
            <button type="button" className="b3-x" onClick={() => void remove(p)} aria-label={`${t("briefV3.step.removePhoto")}: ${p.name}`}>
              ×
            </button>
          </div>
        ))}
        {photos.length < max && (
          <button type="button" className={cx("b3-plus", busy > 0 && "animate-pulse")} onClick={() => input.current?.click()} disabled={busy > 0} aria-label={t("briefV3.step.addPhoto")}>
            +
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={TYPES.join(",")}
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) void add(files);
        }}
      />
      {error && (
        <p className="b3-note b3-stop" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
