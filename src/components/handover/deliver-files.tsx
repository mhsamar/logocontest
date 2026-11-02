"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, TextAreaField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { saveHandoverFolder, submitHandover } from "@/lib/handover/actions";
import { folderOf, HANDOVER_TYPES, KEEP_DAYS, type HandoverFileType, type RequiredFileType } from "@/lib/handover/options";
import { useI18n } from "@/lib/i18n/client";

type FileItem = { id: string; type: HandoverFileType; name: string; size: number; url: string | null; link: string | null };

/**
 * D-09 Deliver files (owner, 2026-11-02): every final file in one Google Drive folder instead of uploads (they made the
 * site heavy). The folder link, a tick for each file type in it, the promise to keep it for KEEP_DAYS, then fonts and
 * the copyright agreement and Send, as before.
 */
export function DeliverFiles({
  handoverId,
  editable,
  files,
  extrasAsked,
  fontsNote,
  required = HANDOVER_TYPES,
}: {
  /** The final files this contest needs (owner, 2026-10-13: other contest services ask for fewer); logo: all six. */
  required?: readonly RequiredFileType[];
  handoverId: string;
  editable: boolean;
  files: FileItem[];
  extrasAsked: string[];
  fontsNote: string;
  /** Kept for the page; uploads are gone (owner, 2026-11-02). */
  maxMb?: number;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const folder = folderOf(files);
  const [editing, setEditing] = useState(!folder);
  const [url, setUrl] = useState("");
  const [ticks, setTicks] = useState<Set<string>>(new Set(folder ? [...required, ...(extrasAsked.length ? ["extra"] : [])] : []));
  const [keep, setKeep] = useState(Boolean(folder));
  const [error, setError] = useState<string | null>(null);
  const [fonts, setFonts] = useState(fontsNote);
  const [agreed, setAgreed] = useState(false);
  const [saving, save] = useTransition();
  const [sending, start] = useTransition();
  const ready = Boolean(folder) && required.every((type) => files.some((f) => f.type === type));
  const allTicked = required.every((x) => ticks.has(x)) && (!extrasAsked.length || ticks.has("extra"));
  const tick = (k: string) => setTicks((cur) => { const n = new Set(cur); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const saveFolder = () =>
    save(async () => {
      setError(null);
      const res = await saveHandoverFolder({ handoverId, url, types: [...ticks].filter((x) => x !== "extra"), extras: ticks.has("extra"), keep });
      if (!res.ok) return setError(t(res.error.key, res.error.params));
      setEditing(false);
      setUrl("");
      router.refresh();
    });

  const send = () =>
    start(async () => {
      setError(null);
      const res = await submitHandover({ handoverId, fontsNote: fonts, agreed });
      if (!res.ok) return setError(t(res.error.key, res.error.params));
      toast(t("handover.deliver.sent"));
      router.refresh();
    });

  const tickRow = (k: string, label: string) => (
    <li key={k}>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[14px] bg-surface px-3.5 ring-1 ring-line">
        <input type="checkbox" checked={ticks.has(k)} onChange={() => tick(k)} disabled={!editable || !editing} className="size-5 shrink-0" />
        <span className="text-[15px] font-semibold text-ink">{label}</span>
      </label>
    </li>
  );

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-ink">{t("handover.deliver.folder.title")}</h2>
          <p className="mt-0.5 text-sm text-muted">{t("handover.deliver.folder.help")}</p>
        </div>
        {folder && !editing ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-success/5 p-3.5 ring-1 ring-success/30">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-success text-white" aria-hidden>
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">{t("handover.deliver.folder.saved")}</span>
              <span className="block truncate text-xs text-muted">{folder}</span>
            </span>
            <a href={folder} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center rounded-full px-3 text-sm font-semibold text-primary hover:bg-tint">
              {t("handover.deliver.openLink")}
            </a>
            {editable && (
              <button type="button" onClick={() => setEditing(true)} className="min-h-9 px-2 text-sm font-semibold text-muted hover:text-ink">
                {t("handover.deliver.changeLink")}
              </button>
            )}
          </div>
        ) : (
          editable && (
            <div className="space-y-3 rounded-2xl bg-chip p-4 ring-1 ring-line">
              <ol className="m-0 list-decimal space-y-1 pl-5 text-sm text-ink">
                <li>{t("handover.deliver.folder.step1")}</li>
                <li>{t("handover.deliver.folder.step2")}</li>
                <li>{t("handover.deliver.folder.step3")}</li>
              </ol>
              <input
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/…"
                aria-label={t("handover.deliver.folder.label")}
                className="min-h-12 w-full rounded-[14px] bg-surface px-3.5 text-[15px] text-ink ring-1 ring-line outline-none placeholder:text-muted focus:ring-2 focus:ring-primary"
              />
              <p className="m-0 text-sm font-semibold text-ink">{t("handover.deliver.folder.inside")}</p>
              <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
                {required.map((type) => tickRow(type, t(`handover.types.${type}`)))}
                {extrasAsked.length > 0 && tickRow("extra", t("handover.deliver.folder.extras", { list: extrasAsked.join(", ") }))}
              </ul>
              <Checkbox label={t("handover.deliver.folder.keep", { days: KEEP_DAYS })} checked={keep} onChange={(e) => setKeep(e.target.checked)} />
              <div className="flex flex-wrap gap-2">
                <Button size="lg" onClick={saveFolder} loading={saving} disabled={!url.trim() || !allTicked || !keep}>
                  {saving ? t("handover.deliver.checkingLink") : t("handover.deliver.folder.save")}
                </Button>
                {folder && (
                  <Button size="lg" variant="ghost" onClick={() => (setEditing(false), setUrl(""), setError(null))}>
                    {t("handover.deliver.cancel")}
                  </Button>
                )}
              </div>
            </div>
          )
        )}
      </section>

      {editable && (
        <>
          <TextAreaField label={t("handover.deliver.fonts")} hint={t("handover.deliver.fontsHint")} rows={2} maxLength={500} value={fonts} onChange={(e) => setFonts(e.target.value)} />
          <section className="rounded-2xl bg-chip p-4 ring-1 ring-line">
            <h2 className="font-semibold text-ink">{t("handover.deliver.agreementTitle")}</h2>
            <p className="mt-2 max-h-36 overflow-y-auto pr-2 text-sm leading-relaxed text-ink/80">{t("handover.deliver.agreement")}</p>
            <Checkbox className="mt-2" label={t("handover.deliver.agree")} checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          </section>
          {error && <Alert tone="danger">{error}</Alert>}
          {!ready && <p className="text-sm text-muted">{t("handover.deliver.folder.missing")}</p>}
          <Button size="lg" block onClick={send} loading={sending} disabled={!ready || !agreed}>
            {t("handover.deliver.send")}
          </Button>
        </>
      )}
      {!editable && error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
