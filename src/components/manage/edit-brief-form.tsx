"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { BrandStep, BusinessStep, LinksStep, LookStep, NeedsStep } from "@/components/wizard/steps-brief";
import { FilesStep, type FileHolder } from "@/components/wizard/steps-order";
import type { LocalFile, ServerFile } from "@/components/wizard/state";
import type { MessageKey } from "@/lib/i18n/translate";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cleanBrief, validateBrief, validateBriefV2, type Brief, type FieldErrors } from "@/lib/contests/brief";
import { prepareLiveBriefUpload, recordLiveBriefUpload, removeLiveBriefFile, saveContestBrief, tellLivePhotos } from "@/lib/contests/edit-actions";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { createBrowserSupabase } from "@/lib/supabase/browser";

// The wizard's brief steps (owner, 2026-10-15: grouped like the 8-step wizard).
const STEPS = [
  { key: "c01", Step: BrandStep },
  { key: "c02", Step: BusinessStep },
  { key: "links", Step: LinksStep },
  { key: "look", Step: LookStep },
  { key: "needs", Step: NeedsStep },
] as const;

/** C-13b Edit details (owner, 2026-10-08): the wizard's brief fields on one page; saving tells the designers. */
const ALL_CHOICES = { businessTypes: [], swatches: [] };

type Upload = { id: string; name: string; status: "waiting" | "uploading" | "done" | "error" };

export function EditBriefForm({
  contestId,
  initial,
  backHref,
  hidden,
  files,
  fileLimits,
  currentLogo,
  photosOnly = false,
  v2 = false,
}: {
  contestId: string;
  initial: Brief;
  backHref: string;
  /** Questions the owner switched off in Admin › Onboarding. */
  hidden: string[];
  /** Reference photos already on the contest (owner, 2026-10-22: the client can add them while it is live). */
  files: ServerFile[];
  fileLimits: { maxFiles: number; maxMb: number };
  currentLogo: boolean;
  /** A non-logo contest: its brief has its own questions, so only the photos change here. */
  photosOnly?: boolean;
  /** An onboarding v2 contest: checked by v2's rule, as the save does (owner, 2026-10-29: the description may be empty). */
  v2?: boolean;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);
  const [brief, setBrief] = useState<Brief>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  // Plain state, not a transition: the upload list and its progress show while the photos go up.
  const [busy, setBusy] = useState(false);
  // Picked pictures still being made lighter: Save waits until they are in the list.
  const [picking, setPicking] = useState(false);
  const pickingRef = useRef(false);
  const [serverFiles, setServerFiles] = useState<ServerFile[]>(files);
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);
  // Photos the client took off: removed only when they save.
  const [removed, setRemoved] = useState<string[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const running = useRef(false);
  // Picked photos wait in memory, not on the device: nothing is left behind, and nothing else can clear them.
  const blobs = useRef(new Map<string, Blob>());
  const holder = useMemo<FileHolder>(() => ({ put: (id, f) => blobs.current.set(id, f), remove: (id) => blobs.current.delete(id) }), []);
  // A photo was added or removed on the live brief since the last notice to the designers.
  const changed = useRef(false);

  const update = (patch: Partial<Brief>) => setBrief((b) => ({ ...b, ...patch }));
  const touch = (field: string) => setTouched((s) => new Set(s).add(field));
  const status = (id: string, s: Upload["status"]) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, status: s } : x)));

  // Removals first (they free places under the limit), then each new photo straight to storage. A photo that is sent
  // becomes a saved one, so pressing Save again only retries what failed.
  const sendPhotos = async (): Promise<string | true> => {
    for (const id of removed) {
      const res = await removeLiveBriefFile({ contestId, fileId: id }).catch(() => null);
      if (!res?.ok) return res ? t(res.error.key, res.error.params) : t("manage.edit.photos.failed");
      changed.current = true;
      setServerFiles((s) => s.filter((f) => f.id !== id));
      setRemoved((r) => r.filter((x) => x !== id));
    }
    if (!localFiles.length) return true;
    let problem: string | null = null;
    setUploads(localFiles.map((f) => ({ id: f.id, name: f.name, status: "waiting" })));
    const supabase = createBrowserSupabase();
    for (const f of localFiles) {
      status(f.id, "uploading");
      const id = await (async () => {
        const blob = blobs.current.get(f.id);
        if (!blob) return null;
        const prepared = await prepareLiveBriefUpload({ contestId, name: f.name, type: f.type, size: f.size });
        if (!prepared.ok) {
          problem ??= t(prepared.error.key, prepared.error.params);
          return null;
        }
        const up = await supabase.storage.from("contest-files").uploadToSignedUrl(prepared.path, prepared.token, blob, { contentType: f.type });
        if (up.error) return null;
        const rec = await recordLiveBriefUpload({ contestId, path: prepared.path, name: f.name, type: f.type, size: f.size, isCurrentLogo: f.isCurrentLogo });
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
      changed.current = true;
      blobs.current.delete(f.id);
      setLocalFiles((l) => l.filter((x) => x.id !== f.id));
      setServerFiles((s) => [...s, { id, name: f.name, type: f.type, isCurrentLogo: f.isCurrentLogo }]);
      status(f.id, "done");
    }
    return problem ?? true;
  };

  // Saves the brief and tells the designers once; a non-logo contest only tells them about its photos.
  const finish = () => (photosOnly ? tellLivePhotos(contestId) : saveContestBrief(contestId, brief));

  const save = async () => {
    if (running.current || pickingRef.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    let leaving = false;
    try {
      // The text is checked before any photo moves, so a wrong field never leaves half a change.
      const found = photosOnly ? {} : v2 ? validateBriefV2(cleanBrief(brief)) : validateBrief(cleanBrief(brief), hiddenSet);
      if (Object.keys(found).length > 0) {
        setErrors(found);
        setTouched(new Set(Object.keys(found)));
        setError(t("manage.edit.fix"));
        return;
      }
      setErrors({});
      const sent = await sendPhotos();
      if (sent !== true) {
        // Some photos did change on the live brief: save the brief anyway so the designers are told once.
        if (changed.current && (await finish().catch(() => null))?.ok) changed.current = false;
        setError(sent);
        return;
      }
      // Nothing changed on a photos-only page: no notice for nothing.
      if (photosOnly && !changed.current) {
        leaving = true;
        router.push(backHref);
        return;
      }
      const res = await finish();
      if (!res.ok) {
        if ("errors" in res && res.errors) {
          setErrors(res.errors);
          setTouched(new Set(Object.keys(res.errors)));
          setError(t("manage.edit.fix"));
        } else if (res.error) setError(t(res.error));
        return;
      }
      changed.current = false;
      toast(t("manage.edit.saved"));
      leaving = true;
      router.push(backHref);
    } catch {
      setError(t("manage.edit.photos.failed"));
    } finally {
      // Saved: the page is leaving, so it stays locked (a second Save would tell the designers again).
      if (!leaving) {
        running.current = false;
        setBusy(false);
      }
    }
  };

  return (
    <div className="space-y-5">
      {/* Locked while saving: what is on screen is what gets saved. */}
      <fieldset disabled={busy} className="m-0 min-w-0 space-y-5 border-0 p-0">
        {!photosOnly && STEPS.map(({ key, Step }) => (
          <section key={key} className="lc-card p-5 sm:p-7">
            <h2 className="m-0 mb-5 text-[22px] font-semibold tracking-[-0.02em] text-ink">{t(`wizard.${key}.heading` as MessageKey)}</h2>
            {/* Editing a live brief offers every business type and the built-in colours. */}
            <Step brief={brief} update={update} errors={errors} touched={touched} touch={touch} choices={ALL_CHOICES} hidden={hiddenSet} />
          </section>
        ))}
        {/* The "files" switch in Admin › Onboarding is for the logo wizard; a non-logo contest's page is only photos. */}
        {(photosOnly || !hiddenSet.has("files")) && (
          <section id="photos" className="lc-card scroll-mt-24 p-5 sm:p-7">
            <h2 className="m-0 text-[22px] font-semibold tracking-[-0.02em] text-ink">{t("manage.edit.photos.heading")}</h2>
            <p className="mt-1.5 mb-5 text-sm text-muted">{t(currentLogo ? "manage.edit.photos.sub" : "manage.edit.photos.subExamples")}</p>
            <FilesStep
              localFiles={localFiles}
              serverFiles={serverFiles.filter((f) => !removed.includes(f.id))}
              limits={fileLimits}
              onChange={setLocalFiles}
              onRemoveServerFile={(id) => setRemoved((r) => (r.includes(id) ? r : [...r, id]))}
              currentLogo={currentLogo}
              store={holder}
              disabled={busy}
              onWorking={(w) => {
                pickingRef.current = w;
                setPicking(w);
              }}
            />
            {uploads.length > 0 && (
              <ul className="mt-4 space-y-1 rounded-[18px] border border-line bg-surface p-4 text-sm">
                {uploads.map((u) => (
                  <li key={u.id} className="flex justify-between gap-3">
                    <span className="truncate text-ink">{u.name}</span>
                    <span className={cx("shrink-0", u.status === "error" ? "text-danger" : u.status === "done" ? "text-success" : "text-muted")}>
                      {t(`wizard.c11.upload.${u.status}`)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </fieldset>
      <div className="sticky bottom-3 z-10 rounded-[22px] bg-white/90 p-3 shadow-card ring-1 ring-line backdrop-blur sm:flex sm:items-center sm:justify-between sm:gap-4">
        <p className="text-sm text-muted">{t("manage.edit.notice")}</p>
        <div className="mt-2 flex shrink-0 gap-2 sm:mt-0">
          <ButtonLink href={backHref} variant="secondary">
            {t("common.cancel")}
          </ButtonLink>
          <Button onClick={() => void save()} loading={busy || picking}>
            {t("manage.edit.save")}
          </Button>
        </div>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
