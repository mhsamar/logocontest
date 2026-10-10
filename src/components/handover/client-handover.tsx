"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { approveHandover, requestHandoverRevision } from "@/lib/handover/actions";
import { countWords, type HandoverFileType, type HandoverStatus } from "@/lib/handover/options";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";

type FileItem = { id: string; type: HandoverFileType; name: string; size: number; url: string | null };

/** C-17 Handover for the client: waiting, review (download, change, approve) and done. */
export function ClientHandover({
  handoverId,
  status,
  files,
  fontsNote,
  dueAt,
  reviewDueAt,
  revisionCount,
  maxRevisions,
  maxWords,
  rating,
}: {
  handoverId: string;
  status: HandoverStatus;
  files: FileItem[];
  fontsNote: string | null;
  dueAt: string;
  reviewDueAt: string | null;
  revisionCount: number;
  maxRevisions: number;
  maxWords: number;
  rating: number | null;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [sheet, setSheet] = useState<"approve" | "change" | null>(null);
  const [stars, setStars] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const date = (iso: string) => new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" }).format(new Date(iso));
  const words = countWords(feedback);
  const changesLeft = Math.max(0, maxRevisions - revisionCount);

  const approve = () =>
    start(async () => {
      setError(null);
      const res = await approveHandover({ handoverId, rating: stars, feedback });
      if (!res.ok) return setError(t(res.error.key, res.error.params));
      setSheet(null);
      toast(t("handover.done.title"));
      router.refresh();
    });
  const change = () =>
    start(async () => {
      setError(null);
      const res = await requestHandoverRevision({ handoverId, note });
      if (!res.ok) return setError(t(res.error.key, res.error.params));
      setSheet(null);
      router.refresh();
    });

  // No result (§2): files already uploaded are not released to the client.
  if (status === "no_result") return <p className="rounded-2xl bg-chip p-4 text-ink ring-1 ring-line">{t("lifecycle.noResultClient")}</p>;
  if (status === "awaiting_files") return <p className="rounded-2xl bg-[#e8f1ff] p-4 text-[#1d4ed8] ring-1 ring-[#bcd0ff]">{t("handover.waiting.client", { date: date(dueAt) })}</p>;
  if (status === "revision_requested") return <p className="rounded-2xl bg-[#fff6d6] p-4 text-gold-ink">{t("handover.waiting.revision")}</p>;

  const fileList = (
    <ul className="grid gap-2 sm:grid-cols-2">
      {files.map((f) => (
        <li key={f.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-line">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-ink text-[0.6875rem] font-extrabold uppercase text-white">{f.type === "extra" ? "+" : f.type}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{f.name}</span>
            <span className="block text-xs text-muted">{t(`handover.types.${f.type}`)}</span>
          </span>
          {f.url && (
            <a href={f.url} target="_blank" rel="noopener" className="inline-flex min-h-9 shrink-0 items-center rounded-full bg-chip px-3 text-sm font-semibold text-primary ring-1 ring-line hover:ring-primary">
              {t("handover.review.download")}
            </a>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-4">
      {status === "approved" ? (
        <div className="rounded-2xl bg-success/10 p-4 ring-1 ring-success/30">
          <p className="font-semibold text-success">{t("handover.done.title")}</p>
          <p className="text-sm text-ink/80">{t("handover.done.client")}</p>
          {rating && <p className="mt-1 text-sm text-gold-ink">{t("handover.done.rating")}: {"★".repeat(rating)}</p>}
        </div>
      ) : (
        <div>
          <p className="font-semibold text-ink">{t("handover.review.title")}</p>
          {reviewDueAt && <p className="text-sm text-muted">{t("handover.review.respondBy", { date: date(reviewDueAt) })}</p>}
        </div>
      )}
      {fileList}
      {fontsNote && (
        <p className="text-sm text-ink">
          <span className="font-semibold">{t("handover.review.fonts")}:</span> {fontsNote}
        </p>
      )}
      {status === "submitted" && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button size="lg" onClick={() => (setError(null), setSheet("approve"))}>
            {t("handover.review.approve")}
          </Button>
          {changesLeft > 0 && (
            <Button size="lg" variant="secondary" onClick={() => (setError(null), setSheet("change"))}>
              {t("handover.review.change")}
            </Button>
          )}
          <span className="text-sm text-muted">{t("handover.review.changesLeft", { n: changesLeft, max: maxRevisions })}</span>
        </div>
      )}

      <Modal
        open={sheet === "approve"}
        onClose={() => setSheet(null)}
        title={t("handover.review.approveTitle")}
        closeLabel={t("common.close")}
        footer={
          <div className="w-full space-y-2">
            {error && <Alert tone="danger">{error}</Alert>}
            <Button block size="lg" onClick={approve} loading={busy} disabled={stars === 0 || words === 0 || words > maxWords}>
              {t("handover.review.approveCta")}
            </Button>
          </div>
        }
      >
        <p className="text-sm font-medium text-ink">{t("handover.review.stars")}</p>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setStars(n)}
              aria-label={t("handover.review.star", { n })}
              aria-pressed={stars >= n}
              className={cx("text-3xl leading-none transition-transform active:scale-90", stars >= n ? "text-[#f4bd2f]" : "text-line hover:text-[#f4bd2f]/60")}
            >
              ★
            </button>
          ))}
        </div>
        <TextAreaField
          className="mt-4"
          label={t("handover.review.feedback")}
          rows={4}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          counterLabel={t("handover.review.words", { n: words, max: maxWords })}
          error={words > maxWords ? t("handover.errors.feedback", { max: maxWords }) : undefined}
        />
      </Modal>

      <Modal
        open={sheet === "change"}
        onClose={() => setSheet(null)}
        title={t("handover.review.change")}
        closeLabel={t("common.close")}
        footer={
          <div className="w-full space-y-2">
            {error && <Alert tone="danger">{error}</Alert>}
            <Button block size="lg" onClick={change} loading={busy} disabled={note.trim().length < 10}>
              {t("handover.review.sendChange")}
            </Button>
          </div>
        }
      >
        <TextAreaField label={t("handover.review.noteLabel")} rows={4} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        <p className="mt-2 text-sm text-muted">{t("handover.review.changesLeft", { n: changesLeft, max: maxRevisions })}</p>
      </Modal>
    </div>
  );
}
