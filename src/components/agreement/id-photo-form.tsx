"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ImageDrop } from "@/components/ui/image-drop";
import { addIdPhoto, type IdPhotoState } from "@/lib/agreements/actions";
import { useI18n } from "@/lib/i18n/client";
import { needsBackPhoto, type IdType } from "@/lib/legal/agreement-rules";

const IDLE: IdPhotoState = { ok: false };

/** For designers who signed before ID photos were asked for (owner, 2026-10-11): just the photo, then continue. */
export function IdPhotoForm({ idType, next }: { idType: IdType; next: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [state, action, pending] = useActionState(addIdPhoto, IDLE);
  const [front, setFront] = useState<File[]>([]);
  const [back, setBack] = useState<File[]>([]);

  useEffect(() => {
    if (state.ok && state.next) router.push(state.next);
  }, [state, router]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData();
        data.set("next", next);
        if (front[0]) data.set("idFront", front[0]);
        if (back[0]) data.set("idBack", back[0]);
        startTransition(() => action(data));
      }}
      className="lc-card space-y-4 p-5 ring-2 ring-primary sm:p-7"
    >
      <div>
        <h2 className="m-0 text-lg font-semibold text-ink">{t("agreement.photoOnly.title")}</h2>
        <p className="m-0 mt-1 text-[15px] text-muted">{t("agreement.photoOnly.lead")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ImageDrop label={t(`agreement.photo.front.${idType}`)} hint={t("agreement.photo.hint")} files={front} onChange={setFront} error={state.errors?.idFront ? t(state.errors.idFront) : undefined} />
        {needsBackPhoto(idType) && <ImageDrop label={t("agreement.photo.back")} files={back} onChange={setBack} error={state.errors?.idBack ? t(state.errors.idBack) : undefined} />}
      </div>
      {state.error && (
        <p role="alert" className="m-0 rounded-[14px] bg-danger/10 px-4 py-3 text-sm text-danger">
          {t(state.error)}
        </p>
      )}
      <Button type="submit" size="lg" block loading={pending || state.ok}>
        {t("agreement.photoOnly.submit")}
      </Button>
    </form>
  );
}
