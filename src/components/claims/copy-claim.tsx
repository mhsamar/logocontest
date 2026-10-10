"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/field";
import { ImageDrop } from "@/components/ui/image-drop";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { openCopyClaim } from "@/lib/claims/actions";
import { CLAIM_MAX_LINKS, CLAIM_MAX_PHOTOS, CLAIM_NOTE_MAX, CLAIM_NOTE_MIN } from "@/lib/claims/rules";
import { useI18n } from "@/lib/i18n/client";

type Claim = { status: "open" | "upheld" | "rejected"; outcome: "correction" | "fine" | "ban" | null; adminNote: string | null };

/** C-17 copy claim (UI-JOURNEY, owner 2026-10-09): report the winning design as copied within the claim days. */
export function CopyClaim({ handoverId, canClaim, until, claim }: { handoverId: string; canClaim: boolean; until: string; claim: Claim | null }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [links, setLinks] = useState<string[]>([""]);
  // Up to 3 pictures that show the copy (owner, 2026-10-10).
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const num = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US");
  const date = new Date(until).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "long", timeZone: "Asia/Dhaka" });

  if (claim?.status === "open") {
    return (
      <p className="flex items-start gap-2 rounded-2xl bg-[#fff6d6] px-4 py-3 text-sm text-gold-ink">
        <span className="mt-1 size-2 shrink-0 animate-pulse rounded-full bg-[#d99a0b]" aria-hidden />
        {t("claims.client.open")}
      </p>
    );
  }

  const result = claim && (
    <div className="rounded-2xl bg-chip px-4 py-3 text-sm text-ink ring-1 ring-line">
      <p className="font-semibold">{claim.status === "rejected" ? t("claims.client.rejected") : t(`claims.client.upheld.${claim.outcome ?? "fine"}`)}</p>
      {claim.adminNote && <p className="mt-1 text-muted">{claim.adminNote}</p>}
    </div>
  );

  const send = () =>
    start(async () => {
      setError(null);
      const form = new FormData();
      form.set("handoverId", handoverId);
      form.set("note", note);
      for (const l of links) form.append("links", l);
      for (const p of photos) form.append("photos", p);
      const res = await openCopyClaim(form);
      if (!res.ok) {
        setError(t(res.error.key, res.error.params));
        return;
      }
      setOpen(false);
      toast(t("claims.client.sent"));
      router.refresh();
    });

  return (
    <div className="space-y-3">
      {result}
      {canClaim && (
        <p className="text-sm text-muted">
          {t("claims.client.prompt", { date })}{" "}
          <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-10 items-center font-semibold text-primary underline-offset-4 hover:underline">
            {t("claims.client.cta")}
          </button>
        </p>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("claims.client.title")}
        closeLabel={t("common.close")}
        footer={
          <div className="w-full space-y-2">
            {error && <Alert tone="danger">{error}</Alert>}
            <Button block size="lg" onClick={send} loading={busy} disabled={note.trim().length < CLAIM_NOTE_MIN}>
              {t("claims.client.send")}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-muted">
            {t("claims.client.lead", { date })}{" "}
            <Link href="/legal/payment-refund#copy-exception" target="_blank" className="font-semibold text-primary underline">
              {t("footer.refund")}
            </Link>
          </p>
          <TextAreaField
            label={t("claims.client.note")}
            hint={t("claims.client.noteHint", { min: num.format(CLAIM_NOTE_MIN) })}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={CLAIM_NOTE_MAX}
            rows={4}
            counterLabel={`${num.format(note.length)} / ${num.format(CLAIM_NOTE_MAX)}`}
          />
          <div className="space-y-2">
            {links.map((link, i) => (
              <TextField
                key={i}
                label={i === 0 ? t("claims.client.links") : t("claims.client.linkN", { n: num.format(i + 1) })}
                hint={i === 0 ? t("claims.client.linksHint") : undefined}
                optionalLabel={i === 0 ? t("common.optional") : undefined}
                type="url"
                inputMode="url"
                placeholder="https://"
                value={link}
                onChange={(e) => setLinks((all) => all.map((x, j) => (j === i ? e.target.value : x)))}
              />
            ))}
            {links.length < CLAIM_MAX_LINKS && links.at(-1)?.trim() && (
              <button type="button" onClick={() => setLinks((all) => [...all, ""])} className="min-h-10 text-sm font-semibold text-primary hover:underline">
                + {t("claims.client.addLink")}
              </button>
            )}
          </div>
          <ImageDrop label={t("claims.client.photos")} hint={t("claims.client.photosHint", { n: num.format(CLAIM_MAX_PHOTOS) })} files={photos} onChange={setPhotos} max={CLAIM_MAX_PHOTOS} optional />
        </div>
      </Modal>
    </div>
  );
}
