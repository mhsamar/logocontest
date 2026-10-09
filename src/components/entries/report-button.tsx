"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/cx";
import { prepareReportImageUpload, reportEntry } from "@/lib/entries/actions";
import { REPORT_MAX_LINKS, REPORT_NOTE_MAX, REPORT_REASONS, type ReportReason } from "@/lib/entries/report-reasons";
import { useI18n } from "@/lib/i18n/client";

function FlagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </svg>
  );
}

/**
 * P-04 Report (owner, 2026-10-08): a reason from the list, an optional note, and
 * for a copy at least one link or an image of the original.
 */
export function ReportButton({ entryId, number, loginHref }: { entryId: string; number: number; loginHref: string | null }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [links, setLinks] = useState("");
  const [image, setImage] = useState<{ url: string; path: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const fmt = (n: number) => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(n);

  const reset = () => {
    setReason(null);
    setNote("");
    setLinks("");
    setImage(null);
    setError(null);
  };

  if (loginHref) {
    return (
      <Link href={loginHref} className="inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold text-muted hover:text-danger">
        <FlagIcon className="size-3.5" />
        {t("entry.report.login")}
      </Link>
    );
  }

  const upload = (f: File) =>
    start(async () => {
      setError(null);
      const url = URL.createObjectURL(f);
      setImage({ url, path: null });
      const prepared = await prepareReportImageUpload({ type: f.type, size: f.size });
      if (!prepared.ok) {
        setImage(null);
        return setError(t(prepared.error.key, prepared.error.params));
      }
      // Loaded only when someone attaches evidence, so the public contest page stays light (BLUEPRINT §15.1).
      const { createBrowserSupabase } = await import("@/lib/supabase/browser");
      const { error: upError } = await createBrowserSupabase().storage.from("entry-files").uploadToSignedUrl(prepared.path, prepared.token, f, { contentType: f.type });
      if (upError) {
        setImage(null);
        return setError(t("auth.errors.generic"));
      }
      setImage({ url, path: prepared.path });
    });

  const send = () =>
    start(async () => {
      setError(null);
      if (!reason) return setError(t("entry.report.pickReason"));
      const res = await reportEntry({ entryId, reason, note, links: links.split(/\s+/), imagePath: image?.path ?? null });
      if (!res.ok) return setError(t(res.error.key, res.error.params));
      setOpen(false);
      reset();
      toast(t("entry.report.sent"));
    });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold text-muted hover:text-danger">
        <FlagIcon className="size-3.5" />
        {t("entry.report.open")}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("entry.report.title", { n: fmt(number) })}
        closeLabel={t("common.close")}
        footer={
          <div className="w-full space-y-2">
            {error && <Alert tone="danger">{error}</Alert>}
            <Button block size="lg" onClick={send} loading={busy} disabled={!reason || (image !== null && image.path === null)}>
              {t("entry.report.submit")}
            </Button>
            <p className="text-center text-xs text-muted">{t("entry.report.warning")}</p>
          </div>
        }
      >
        <p className="text-sm text-muted">{t("entry.report.intro")}</p>
        <fieldset className="mt-3 space-y-2">
          <legend className="sr-only">{t("entry.report.intro")}</legend>
          {REPORT_REASONS.map((r) => (
            <label
              key={r}
              className={cx(
                "flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 transition-colors",
                reason === r ? "bg-primary/5 ring-2 ring-primary" : "ring-line hover:bg-canvas",
              )}
            >
              <input type="radio" name="report-reason" value={r} checked={reason === r} onChange={() => {
                  setReason(r);
                  setError(null);
                }} className="mt-0.5 size-4 accent-primary" />
              <span>
                <span className="block text-sm font-semibold text-ink">{t(`entry.report.reasons.${r}.label`)}</span>
                <span className="block text-xs text-muted">{t(`entry.report.reasons.${r}.line`)}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {reason && (
          <div className="mt-4 space-y-4">
            {(reason === "copied" || reason === "trademark") && (
              <>
                <TextAreaField
                  label={t("entry.report.links")}
                  hint={t("entry.report.linksHint", { max: fmt(REPORT_MAX_LINKS) })}
                  placeholder="https://"
                  value={links}
                  onChange={(e) => setLinks(e.target.value)}
                  rows={3}
                />
                <div>
                  <p className="text-sm font-medium text-ink">{t("entry.report.image")}</p>
                  <input
                    ref={file}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) upload(f);
                    }}
                  />
                  {image ? (
                    <div className="mt-2 flex items-center gap-3">
                      <img src={image.url} alt="" className={cx("size-16 rounded-lg object-cover ring-1 ring-line", !image.path && "opacity-50")} />
                      <button type="button" onClick={() => setImage(null)} className="min-h-10 text-sm font-semibold text-muted hover:text-danger">
                        {t("entry.report.imageRemove")}
                      </button>
                    </div>
                  ) : (
                    <Button variant="secondary" className="mt-2" onClick={() => file.current?.click()}>
                      {t("entry.report.imageAdd")}
                    </Button>
                  )}
                  {reason === "copied" && <p className="mt-2 text-xs text-muted">{t("entry.report.evidenceHint")}</p>}
                </div>
              </>
            )}
            <TextAreaField
              label={t("entry.report.note")}
              placeholder={t("entry.report.notePlaceholder")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={REPORT_NOTE_MAX}
              rows={3}
              counterLabel={`${fmt(note.length)} / ${fmt(REPORT_NOTE_MAX)}`}
            />
          </div>
        )}
      </Modal>
    </>
  );
}
