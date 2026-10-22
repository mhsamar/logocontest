"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { addContestFiles, prepareContestFile, removeContestFile, tellAboutContestFiles } from "@/lib/admin/contest-actions";
import type { AdminContestFile } from "@/lib/admin/contests";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { COMPRESS, compressImage, isCompressible } from "@/lib/images/compress";
import { formatNumber } from "@/lib/money";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { AdminAction } from "./admin-action";
import { useReadOnly } from "./read-only";

const ACCEPT: Record<string, true> = { "image/jpeg": true, "image/png": true, "application/pdf": true };

type Sending = { name: string; status: "waiting" | "uploading" | "done" | "error" };

/**
 * A-02 Reference photos (owner, 2026-10-22): the contest's examples and current logo, and an Add button for the photos
 * a client sends on WhatsApp. Pictures are made lighter here and go straight to storage, each one saved as soon as it
 * is uploaded; Remove asks for a reason.
 */
export function AdminContestFiles({
  contestId,
  files,
  isLogo,
  open,
  inTrash,
  designers,
  limits,
}: {
  contestId: string;
  files: AdminContestFile[];
  isLogo: boolean;
  /** Designers are told only while the contest is open. */
  open: boolean;
  inTrash: boolean;
  /** Designers who sent designs: the ones a "brief updated" notice reaches. */
  designers: number;
  limits: { maxFiles: number; maxMb: number };
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const readOnly = useReadOnly();
  const input = useRef<HTMLInputElement>(null);
  const running = useRef(false);
  const [kind, setKind] = useState<"example" | "current_logo">("example");
  const [tell, setTell] = useState(true);
  // Plain state, not a transition: the list and its progress show while the files go up.
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState<Sending[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const canEdit = !readOnly && !inTrash;
  const n = (v: number) => formatNumber(v, locale);

  const add = async (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (input.current) input.current.value = "";
    if (!picked.length || running.current) return;
    running.current = true;
    setBusy(true);
    setProblems([]);
    setSending(picked.map((f) => ({ name: f.name, status: "waiting" })));
    const mark = (i: number, status: Sending["status"]) => setSending((s) => s.map((x, j) => (j === i ? { ...x, status } : x)));
    const issues: string[] = [];
    let added = 0;
    try {
      const supabase = createBrowserSupabase();
      for (const [i, raw] of picked.entries()) {
        mark(i, "uploading");
        const problem = await (async () => {
          const file = raw.type !== "application/pdf" && isCompressible(raw) ? await compressImage(raw, { ...COMPRESS.picture, out: ["image/jpeg"] }) : raw;
          if (!ACCEPT[file.type]) return t("wizard.errors.fileType", { name: file.name });
          if (file.size > limits.maxMb * 1024 * 1024) return t("wizard.errors.fileSize", { name: file.name, mb: limits.maxMb });
          const prepared = await prepareContestFile(contestId, { name: file.name, type: file.type, size: file.size });
          if (!prepared.ok) return t(prepared.error.key, prepared.error.params);
          const up = await supabase.storage.from("contest-files").uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
          if (up.error) return t("admin.contests.files.failed", { name: file.name });
          const res = await addContestFiles(contestId, { kind, files: [{ path: prepared.path, name: file.name, type: file.type, size: file.size }] });
          if (!res.ok) return t(res.error.key, res.error.params);
          if (res.added < 1) return t("admin.contests.files.failed", { name: file.name });
          added += 1;
          return null;
        })().catch(() => t("admin.contests.files.failed", { name: raw.name }));
        mark(i, problem ? "error" : "done");
        if (problem) issues.push(problem);
      }
      if (added > 0) {
        if (open && designers > 0 && tell) await tellAboutContestFiles(contestId).catch(() => undefined);
        toast(added === 1 ? t("admin.contests.files.addedOne") : t("admin.contests.files.added", { count: n(added) }));
        router.refresh();
      }
    } finally {
      setProblems(issues);
      setSending([]);
      setBusy(false);
      running.current = false;
    }
  };

  return (
    <section id="reference-photos" className="scroll-mt-24 rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-ink">
            {t("admin.contests.files.title")} <span className="text-muted">({n(files.length)})</span>
          </h2>
          <p className="mt-0.5 text-sm text-muted">{t("admin.contests.files.lead")}</p>
        </div>
        {canEdit && (
          <Button onClick={() => input.current?.click()} loading={busy} className="max-sm:w-full">
            {t("admin.contests.files.add")}
          </Button>
        )}
      </div>
      {canEdit && (
        <input
          ref={input}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.heic,.pdf,image/jpeg,image/png,image/webp,image/heic,application/pdf"
          multiple
          hidden
          onChange={(e) => void add(e.target.files)}
        />
      )}

      {canEdit && (
        <div className="mt-3 space-y-2 rounded-xl bg-canvas px-4 py-3 text-sm">
          {isLogo && (
            <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t("admin.contests.files.kindLabel")}>
              <span className="text-muted">{t("admin.contests.files.kindLabel")}</span>
              {(["example", "current_logo"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  disabled={busy}
                  onClick={() => setKind(k)}
                  className={cx(
                    "min-h-10 rounded-full px-3.5 font-semibold ring-1 ring-inset disabled:opacity-60",
                    kind === k ? "bg-ink text-white ring-ink" : "bg-surface text-ink ring-line hover:bg-canvas",
                  )}
                >
                  {t(`admin.contests.files.kinds.${k}`)}
                </button>
              ))}
            </div>
          )}
          {open && designers > 0 && (
            <Checkbox
              className="py-1"
              label={designers === 1 ? t("admin.contests.files.tellOne") : t("admin.contests.files.tell", { count: n(designers) })}
              description={t("admin.contests.files.tellHint")}
              checked={tell}
              disabled={busy}
              onChange={(e) => setTell(e.target.checked)}
            />
          )}
          <p className="m-0 text-muted">{t("admin.contests.files.types", { mb: n(limits.maxMb) })}</p>
        </div>
      )}
      {inTrash && <p className="mt-3 text-sm text-danger">{t("admin.contests.files.inTrash")}</p>}

      {sending.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm" aria-live="polite">
          {sending.map((x, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="truncate text-ink">{x.name}</span>
              <span className={cx("shrink-0", x.status === "error" ? "text-danger" : x.status === "done" ? "text-success" : "text-muted")}>
                {t(`wizard.c11.upload.${x.status}`)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {problems.length > 0 && (
        <ul role="alert" className="mt-3 space-y-1 text-sm text-danger">
          {problems.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}

      {files.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{t("admin.contests.files.none")}</p>
      ) : (
        <ul className="m-0 mt-4 grid list-none grid-cols-3 gap-3 p-0 sm:grid-cols-4 lg:grid-cols-6">
          {files.map((f) => (
            <li key={f.id} className="min-w-0">
              <a
                href={f.url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("contest.brief.openFile", { name: f.name })}
                className="relative block aspect-square overflow-hidden rounded-xl bg-canvas ring-1 ring-line hover:ring-primary"
              >
                {f.isImage && f.url ? (
                  // Signed, short-lived storage URL, so next/image's optimiser can't cache it.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.url} alt="" className="size-full object-contain p-1.5" loading="lazy" />
                ) : (
                  <span className="flex size-full items-center justify-center p-1 text-center text-sm font-semibold text-muted">{f.isImage ? t("admin.contests.files.noPreview") : "PDF"}</span>
                )}
                {f.kind === "current_logo" && (
                  <span className="absolute inset-x-1 bottom-1 truncate rounded-full bg-ink/85 px-2 py-0.5 text-center text-[11px] font-semibold text-white">
                    {t("admin.contests.files.currentLogo")}
                  </span>
                )}
              </a>
              <p className="m-0 mt-1 truncate text-xs text-muted" title={f.name}>
                {f.name}
              </p>
              {canEdit && (
                <div className="mt-1 [&>button]:min-h-9 [&>button]:w-full [&>button]:px-2 [&>button]:text-sm">
                  <AdminAction
                    label={t("admin.contests.files.remove")}
                    body={t("admin.contests.files.removeBody")}
                    tone="ghost"
                    done={t("admin.contests.files.removed")}
                    run={(v) => removeContestFile(contestId, f.id, v)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {files.length > limits.maxFiles && <p className="mt-3 text-sm text-muted">{t("admin.contests.files.overLimit", { count: n(files.length), max: n(limits.maxFiles) })}</p>}
    </section>
  );
}
