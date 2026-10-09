/* eslint-disable @next/next/no-img-element */
"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { prepareSitePicture, removeSitePicture, saveSitePicture } from "@/lib/content/picture-actions";
import { PICTURE_TYPES, SITE_BUCKET, type PictureKind } from "@/lib/content/pictures";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { useReadOnly } from "./read-only";

const FRAME: Record<PictureKind, string> = {
  logo: "h-20 bg-white",
  icon: "size-24 bg-white",
  hero: "aspect-[16/7] bg-canvas",
  share: "aspect-[1200/630] bg-canvas",
};

/** A-17: one site picture with its preview, an upload button and "Use default". */
export function PictureField({ kind, url, fallback }: { kind: PictureKind; url: string | null; fallback: string | null }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, run] = useTransition();
  const shown = url ?? fallback;

  const upload = (file: File) =>
    run(async () => {
      const prepared = await prepareSitePicture(kind, { type: file.type, size: file.size });
      if (!prepared.ok) return toast(t(prepared.error), "danger");
      const { error } = await createBrowserSupabase().storage.from(SITE_BUCKET).uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
      if (error) return toast(t("auth.errors.generic"), "danger");
      const saved = await saveSitePicture(kind, prepared.path);
      if (!saved.ok) return toast(t(saved.error), "danger");
      toast(t("admin.brand.pictures.saved"));
      router.refresh();
    });

  const reset = () =>
    run(async () => {
      const res = await removeSitePicture(kind);
      if (!res.ok) return toast(t(res.error), "danger");
      toast(t("admin.brand.pictures.resetDone"));
      router.refresh();
    });

  return (
    <div className="grid gap-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] sm:items-start">
      <div>
        <p className="font-semibold text-ink">{t(`admin.brand.pictures.${kind}.title`)}</p>
        <p className="mt-0.5 text-sm text-muted">{t(`admin.brand.pictures.${kind}.hint`)}</p>
        <p className="mt-1 text-xs text-muted">{t(`admin.brand.pictures.types.${kind}`)}</p>
        {!readOnly && (
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              ref={input}
              type="file"
              accept={Object.keys(PICTURE_TYPES[kind]).join(",")}
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) upload(file);
              }}
            />
            <Button variant="secondary" loading={busy} onClick={() => input.current?.click()}>
              {t(url ? "admin.brand.pictures.replace" : "admin.brand.pictures.upload")}
            </Button>
            {url && (
              <Button variant="ghost" onClick={reset} disabled={busy}>
                {t("admin.brand.pictures.useDefault")}
              </Button>
            )}
          </div>
        )}
      </div>
      <figure>
        <div className={cx("flex items-center justify-center overflow-hidden rounded-xl p-2 ring-1 ring-line", FRAME[kind])}>
          {shown ? <img src={shown} alt="" className="max-h-full max-w-full object-contain" /> : <span className="px-3 text-center text-sm text-muted">{t(`admin.brand.pictures.${kind}.none`)}</span>}
        </div>
        <figcaption className="mt-1 text-xs text-muted">{t(url ? "admin.brand.pictures.yours" : "admin.brand.pictures.builtIn")}</figcaption>
      </figure>
    </div>
  );
}
