"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_INPUT = 15 * 1024 * 1024;

/** Big phone photos are made smaller in the browser (longest side 1800 px, JPEG) before they are sent. */
async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.86));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    // A format the browser can't draw (some HEIC files): send it as it is; the server checks it.
    return file;
  }
}

/**
 * Pick photos (owner, 2026-10-10): drag and drop, choose a file, or take a photo with the phone camera.
 * Shows a preview of each with Remove. `max` 1 keeps one photo.
 */
export function ImageDrop({
  label,
  hint,
  files,
  onChange,
  max = 1,
  error,
  optional = false,
}: {
  label: string;
  hint?: string;
  files: File[];
  onChange: (files: File[]) => void;
  max?: number;
  error?: string;
  optional?: boolean;
}) {
  const { t } = useI18n();
  const id = useId();
  const pick = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    setProblem(null);
    const chosen = [...list].filter((f) => TYPES.includes(f.type) || /\.(heic|heif)$/i.test(f.name));
    if (chosen.length < list.length) setProblem(t("upload.photoTypes"));
    if (chosen.some((f) => f.size > MAX_INPUT)) return setProblem(t("upload.photoTooBig"));
    setBusy(true);
    const ready = await Promise.all(chosen.map(shrink));
    setBusy(false);
    onChange(max === 1 ? ready.slice(0, 1) : [...files, ...ready].slice(0, max));
  };

  const full = files.length >= max;
  return (
    <div className="space-y-2">
      <p className="m-0 text-sm font-medium text-ink">
        {label}
        {optional && <span className="ml-2 font-normal text-muted">{t("upload.optional")}</span>}
      </p>

      {files.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
          {previews.map((src, i) => (
            <li key={src} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-28 w-40 rounded-[14px] bg-chip object-cover ring-1 ring-line" />
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                aria-label={t("upload.remove")}
                className="absolute -right-2 -top-2 flex size-8 items-center justify-center rounded-full bg-surface text-ink shadow-card ring-1 ring-line hover:text-danger"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!full && (
        <div
          onDragOver={(e) => (e.preventDefault(), setOver(true))}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            add(e.dataTransfer.files);
          }}
          className={cx(
            "flex flex-col items-center gap-3 rounded-[18px] border-2 border-dashed px-4 py-6 text-center transition-colors",
            over ? "border-primary bg-tint/50" : error ? "border-danger/60" : "border-line bg-surface",
          )}
        >
          <svg viewBox="0 0 24 24" className="size-7 text-primary" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="5" width="18" height="14" rx="2.5" />
            <circle cx="9" cy="10" r="1.8" />
            <path d="M21 16l-5-5-8 8" />
          </svg>
          <p className="m-0 text-sm text-muted">{busy ? t("upload.preparing") : t("upload.drop")}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => pick.current?.click()} className="inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-primary">
              {t("upload.choose")}
            </button>
            {/* The camera, on phones and tablets */}
            <button type="button" onClick={() => camera.current?.click()} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-ink ring-1 ring-line hover:ring-primary lg:hidden">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              {t("upload.camera")}
            </button>
          </div>
          <input ref={pick} id={id} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple={max > 1} className="hidden" onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
          <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
        </div>
      )}
      {hint && <p className="m-0 text-xs text-muted">{hint}</p>}
      {(problem || error) && <p className="m-0 text-sm text-danger">{problem ?? error}</p>}
    </div>
  );
}
