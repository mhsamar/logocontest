"use client";

import { useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { LocalFile, ServerFile } from "@/components/wizard/state";
import { FilesStep, type FileHolder } from "@/components/wizard/steps-order";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { v2PhotosChanged, v2PreparePhoto, v2RecordPhoto, v2RemovePhoto } from "@/lib/onboarding/brief-actions";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export type PhotoActions = { prepare: typeof v2PreparePhoto; record: typeof v2RecordPhoto; remove: typeof v2RemovePhoto; changed: typeof v2PhotosChanged };
const SERVER: PhotoActions = { prepare: v2PreparePhoto, record: v2RecordPhoto, remove: v2RemovePhoto, changed: v2PhotosChanged };

type Upload = { id: string; name: string; status: "waiting" | "uploading" | "done" | "error" };

/**
 * The brief's reference pictures after paying (owner, 2026-10-29: "chobi add koro"): the client's current logo or
 * pictures they like, with the wizard's own picker and limits. Saved with the card's Save: removals first, then each
 * new picture straight to storage (a picture that went up stays; Save again only retries what failed). A live
 * contest's designers are told once.
 */
export function HubPhotos(props: {
  contestId: string;
  number: string;
  files: ServerFile[];
  limits: { maxFiles: number; maxMb: number };
  /** The card is open (unsaved pictures may be in it): the hub keeps "finish" off meanwhile. */
  onOpen: (open: boolean) => void;
  actions?: Partial<PhotoActions>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const actions = useMemo(() => ({ ...SERVER, ...props.actions }), [props.actions]);
  const [open, setOpen] = useState(false);
  const [serverFiles, setServerFiles] = useState<ServerFile[]>(props.files);
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const pickingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  // Picked pictures wait in memory until Save, as in Edit details.
  const blobs = useRef(new Map<string, Blob>());
  const holder = useMemo<FileHolder>(() => ({ put: (id, f) => blobs.current.set(id, f), remove: (id) => blobs.current.delete(id) }), []);
  const status = (id: string, s: Upload["status"]) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, status: s } : x)));

  const show = (on: boolean) => {
    setOpen(on);
    props.onOpen(on);
  };
  const cancel = () => {
    blobs.current.clear();
    setLocalFiles([]);
    setRemoved([]);
    setUploads([]);
    setError(null);
    show(false);
  };

  const save = async () => {
    if (busy || pickingRef.current) return;
    setBusy(true);
    setError(null);
    let changed = false;
    let problem: string | null = null;
    try {
      for (const id of removed) {
        const res = await actions.remove({ contestId: props.contestId, fileId: id }).catch(() => null);
        if (!res?.ok) {
          problem ??= res ? t(res.error.key, res.error.params) : t("manage.edit.photos.failed");
          continue;
        }
        changed = true;
        setServerFiles((s) => s.filter((f) => f.id !== id));
        setRemoved((r) => r.filter((x) => x !== id));
      }
      setUploads(localFiles.map((f) => ({ id: f.id, name: f.name, status: "waiting" })));
      const supabase = localFiles.length ? createBrowserSupabase() : null;
      for (const f of localFiles) {
        status(f.id, "uploading");
        const id = await (async () => {
          const blob = blobs.current.get(f.id);
          if (!blob || !supabase) return null;
          const prepared = await actions.prepare({ contestId: props.contestId, name: f.name, type: f.type, size: f.size });
          if (!prepared.ok) {
            problem ??= t(prepared.error.key, prepared.error.params);
            return null;
          }
          const up = await supabase.storage.from("contest-files").uploadToSignedUrl(prepared.path, prepared.token, blob, { contentType: f.type });
          if (up.error) return null;
          const rec = await actions.record({ contestId: props.contestId, path: prepared.path, name: f.name, type: f.type, size: f.size, isCurrentLogo: f.isCurrentLogo });
          if (!rec.ok) {
            problem ??= t(rec.error.key, rec.error.params);
            return null;
          }
          return rec.id;
        })().catch(() => null);
        if (!id) {
          status(f.id, "error");
          problem ??= t("manage.edit.photos.failed");
          continue;
        }
        changed = true;
        blobs.current.delete(f.id);
        setLocalFiles((l) => l.filter((x) => x.id !== f.id));
        setServerFiles((s) => [...s, { id, name: f.name, type: f.type, isCurrentLogo: f.isCurrentLogo }]);
        status(f.id, "done");
      }
      // Once per Save, even when some pictures failed: the ones that went up are on the brief.
      if (changed) await actions.changed({ contestId: props.contestId }).catch(() => null);
      if (problem) return setError(problem);
      setUploads([]);
      show(false);
      if (changed) toast(t("wizardV2.hub.saved"), "success");
    } finally {
      setBusy(false);
    }
  };

  const shown = serverFiles.filter((f) => !removed.includes(f.id));
  return (
    <section className={cx("rounded-2xl bg-surface p-4 ring-1", open ? "shadow-card ring-primary/40" : "ring-line")} data-section="photos">
      <div className="flex items-start justify-between gap-3">
        <h2 className="m-0 text-[16px] font-semibold text-ink">
          {props.number} · {t("wizardV2.hub.cards.photos")}
        </h2>
        {!open && (
          <button type="button" onClick={() => show(true)} className="min-h-11 shrink-0 px-1 text-sm font-bold text-primary underline">
            {t("wizardV2.hub.change")}
          </button>
        )}
      </div>
      {!open ? (
        <p className="m-0 mt-2 text-[14px] text-ink">{serverFiles.length ? t("wizardV2.hub.photos", { n: serverFiles.length }) : <span className="text-muted">{t("wizardV2.hub.photosNone")}</span>}</p>
      ) : (
        <div className="mt-4 space-y-4 border-t border-line pt-4">
          <fieldset disabled={busy} className="m-0 min-w-0 border-0 p-0">
            <FilesStep
              localFiles={localFiles}
              serverFiles={shown}
              limits={props.limits}
              onChange={setLocalFiles}
              onRemoveServerFile={(id) => setRemoved((r) => (r.includes(id) ? r : [...r, id]))}
              store={holder}
              disabled={busy}
              onWorking={(w) => {
                pickingRef.current = w;
                setPicking(w);
              }}
            />
          </fieldset>
          {uploads.length > 0 && (
            <ul className="m-0 list-none space-y-1 rounded-[18px] border border-line bg-surface p-4 text-sm">
              {uploads.map((u) => (
                <li key={u.id} className="flex justify-between gap-3">
                  <span className="truncate text-ink">{u.name}</span>
                  <span className={cx("shrink-0", u.status === "error" ? "text-danger" : u.status === "done" ? "text-success" : "text-muted")}>{t(`wizard.c11.upload.${u.status}`)}</span>
                </li>
              ))}
            </ul>
          )}
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" size="lg" className="sm:flex-1" loading={busy || picking} onClick={() => void save()}>
              {t("wizardV2.hub.save")}
            </Button>
            {/* Not while picked pictures are still being made lighter: they would come back after Cancel. */}
            <Button type="button" variant="ghost" onClick={cancel} disabled={busy || picking}>
              {t("wizardV2.hub.cancel")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
