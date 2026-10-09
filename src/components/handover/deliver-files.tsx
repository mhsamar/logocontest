"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, TextAreaField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { prepareHandoverUpload, recordHandoverFile, removeHandoverFile, submitHandover } from "@/lib/handover/actions";
import { acceptAttr, HANDOVER_FILES_BUCKET, HANDOVER_TYPES, MAX_EXTRA_FILES, type HandoverFileType } from "@/lib/handover/options";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type FileItem = { id: string; type: HandoverFileType; name: string; size: number; url: string | null };

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** D-09 Deliver files: six required slots, extras when the client asked for them, fonts and the copyright agreement. */
export function DeliverFiles({
  handoverId,
  editable,
  files,
  extrasAsked,
  fontsNote,
  maxMb,
}: {
  handoverId: string;
  editable: boolean;
  files: FileItem[];
  extrasAsked: string[];
  fontsNote: string;
  maxMb: number;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [busyType, setBusyType] = useState<HandoverFileType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fonts, setFonts] = useState(fontsNote);
  const [agreed, setAgreed] = useState(false);
  const [sending, start] = useTransition();
  const inputs = useRef<Partial<Record<HandoverFileType, HTMLInputElement | null>>>({});
  const extras = files.filter((f) => f.type === "extra");
  const ready = HANDOVER_TYPES.every((type) => files.some((f) => f.type === type));

  const upload = async (type: HandoverFileType, file: File) => {
    setError(null);
    setBusyType(type);
    try {
      const prepared = await prepareHandoverUpload({ handoverId, fileType: type, name: file.name, size: file.size });
      if (!prepared.ok) return setError(t(prepared.error.key, prepared.error.params));
      const { error: upError } = await createBrowserSupabase().storage.from(HANDOVER_FILES_BUCKET).uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type || "application/octet-stream" });
      if (upError) return setError(t("handover.errors.upload"));
      const saved = await recordHandoverFile({ handoverId, fileType: type, path: prepared.path, name: file.name, size: file.size });
      if (!saved.ok) return setError(t(saved.error.key, saved.error.params));
      router.refresh();
    } finally {
      setBusyType(null);
    }
  };

  const remove = async (id: string) => {
    const res = await removeHandoverFile(id);
    if (!res.ok) setError(t(res.error.key, res.error.params));
    router.refresh();
  };

  const send = () =>
    start(async () => {
      setError(null);
      const res = await submitHandover({ handoverId, fontsNote: fonts, agreed });
      if (!res.ok) return setError(t(res.error.key, res.error.params));
      toast(t("handover.deliver.sent"));
      router.refresh();
    });

  const slot = (type: HandoverFileType, file?: FileItem) => (
    <li key={file?.id ?? type} className={cx("flex items-center gap-3 rounded-2xl p-3 ring-1 transition-colors", file ? "bg-success/5 ring-success/30" : "bg-surface ring-line")}>
      <span className={cx("flex size-11 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold uppercase", file ? "bg-success text-white" : "bg-canvas text-muted ring-1 ring-line")}>
        {file ? (
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        ) : type === "extra" ? (
          "+"
        ) : (
          type
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">{t(`handover.types.${type}`)}</span>
        <span className="block truncate text-xs text-muted">{file ? `${file.name} · ${kb(file.size)}` : acceptAttr(type).replaceAll(",", " ")}</span>
      </span>
      {editable && (
        <span className="flex shrink-0 items-center gap-2">
          {file && type === "extra" && (
            <button type="button" onClick={() => remove(file.id)} className="min-h-9 px-2 text-sm font-semibold text-muted hover:text-danger">
              {t("handover.deliver.remove")}
            </button>
          )}
          {(type !== "extra" || !file) && (
            <>
              <input
                ref={(el) => {
                  inputs.current[type] = el;
                }}
                type="file"
                accept={acceptAttr(type)}
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void upload(type, f);
                }}
              />
              <Button size="md" variant={file ? "secondary" : "primary"} loading={busyType === type} onClick={() => inputs.current[type]?.click()}>
                {busyType === type ? t("handover.deliver.uploading") : file ? t("handover.deliver.replace") : type === "extra" ? t("handover.deliver.add") : t("handover.deliver.choose")}
              </Button>
            </>
          )}
        </span>
      )}
    </li>
  );

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-bold text-ink">{t("handover.deliver.title")}</h2>
        <p className="mt-0.5 text-sm text-muted">{t("handover.deliver.help", { mb: maxMb })}</p>
        <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">{HANDOVER_TYPES.map((type) => slot(type, files.find((f) => f.type === type)))}</ul>
      </section>

      {extrasAsked.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-ink">{t("handover.deliver.extra")}</h2>
          <p className="mt-0.5 text-sm text-muted">{t("handover.deliver.extraHelp", { list: extrasAsked.join(", "), max: MAX_EXTRA_FILES })}</p>
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {extras.map((f) => slot("extra", f))}
            {editable && extras.length < MAX_EXTRA_FILES && slot("extra")}
          </ul>
        </section>
      )}

      {editable && (
        <>
          <TextAreaField label={t("handover.deliver.fonts")} hint={t("handover.deliver.fontsHint")} rows={2} maxLength={500} value={fonts} onChange={(e) => setFonts(e.target.value)} />
          <section className="rounded-2xl bg-canvas p-4 ring-1 ring-line">
            <h2 className="font-semibold text-ink">{t("handover.deliver.agreementTitle")}</h2>
            <p className="mt-2 max-h-36 overflow-y-auto pr-2 text-sm leading-relaxed text-ink/80">{t("handover.deliver.agreement")}</p>
            <Checkbox className="mt-2" label={t("handover.deliver.agree")} checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          </section>
          {error && <Alert tone="danger">{error}</Alert>}
          {!ready && <p className="text-sm text-muted">{t("handover.deliver.missing")}</p>}
          <Button size="lg" block onClick={send} loading={sending} disabled={!ready || !agreed}>
            {t("handover.deliver.send")}
          </Button>
        </>
      )}
      {!editable && error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
