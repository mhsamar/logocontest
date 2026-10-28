"use client";

import Link from "@/components/ui/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { copySampleSlides, deleteHeroSlide, moveHeroSlide, saveHeroSettings, setHeroSlideActive } from "@/lib/home/hero-actions";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { AdminAction } from "./admin-action";
import { AdmCheckbox, ADM_INPUT } from "./ui";
import { useReadOnly } from "./read-only";

type Result = { ok: true } | { ok: false; error: MessageKey };

/** Runs a quick action (no pop-up), then shows the result and reloads the list. */
function useQuick() {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [busy, start] = useTransition();
  const run = (action: () => Promise<Result>, done?: string) =>
    start(async () => {
      const res = await action();
      if (!res.ok) return toast(t(res.error), "danger");
      if (done) toast(done);
      router.refresh();
    });
  return { busy, run };
}

const quickBtn = "inline-flex min-h-10 min-w-10 items-center justify-center rounded-[10px] border border-adm-line px-2.5 text-[14px] font-bold text-ink hover:bg-adm-row disabled:opacity-40";

/** A-09b: one slide's buttons: move up / down, show / hide, edit, delete. */
export function HeroRowActions({ id, brand, active, first, last }: { id: string; brand: string; active: boolean; first: boolean; last: boolean }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const { busy, run } = useQuick();
  if (readOnly)
    return (
      <Link href={`/admin/hero/${id}`} className={quickBtn}>
        {t("admin.hero.list.view")}
      </Link>
    );
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" className={quickBtn} disabled={busy || first} onClick={() => run(() => moveHeroSlide(id, "up"))} aria-label={t("admin.hero.list.up", { brand })}>
        ↑
      </button>
      <button type="button" className={quickBtn} disabled={busy || last} onClick={() => run(() => moveHeroSlide(id, "down"))} aria-label={t("admin.hero.list.down", { brand })}>
        ↓
      </button>
      <button type="button" className={quickBtn} disabled={busy} onClick={() => run(() => setHeroSlideActive(id, !active), t(active ? "admin.hero.list.hidden" : "admin.hero.list.shown"))}>
        {t(active ? "admin.hero.list.hide" : "admin.hero.list.show")}
      </button>
      <Link href={`/admin/hero/${id}`} className={quickBtn}>
        {t("admin.hero.list.edit")}
      </Link>
      <AdminAction
        label={t("admin.hero.list.delete")}
        title={t("admin.hero.list.deleteTitle", { brand })}
        body={t("admin.hero.list.deleteBody")}
        confirm={t("admin.hero.list.deleteConfirm")}
        done={t("admin.hero.list.deleted")}
        tone="ghost"
        fields={[]}
        run={() => deleteHeroSlide(id)}
      />
    </div>
  );
}

/** Empty list: copy the four built-in sample slides in (switched off) to edit them one by one. */
export function CopySamplesButton() {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const { busy, run } = useQuick();
  if (readOnly) return null;
  return (
    <Button variant="secondary" loading={busy} onClick={() => run(() => copySampleSlides(), t("admin.hero.list.copied"))}>
      {t("admin.hero.list.copySamples")}
    </Button>
  );
}

/** Seconds per slide and the "Sample artwork" pill. */
export function HeroSettingsForm({ seconds, samplePill, offerSlide }: { seconds: number; samplePill: boolean; offerSlide: boolean }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const { busy, run } = useQuick();
  const [s, setS] = useState(String(seconds));
  const [pill, setPill] = useState(samplePill);
  const [offer, setOffer] = useState(offerSlide);
  return (
    <form
      className="mt-4 flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveHeroSettings({ seconds: Number(s), samplePill: pill, offerSlide: offer }), t("admin.saved"));
      }}
    >
      <div className="flex max-w-xs flex-col gap-1.5">
        <label htmlFor="hero-seconds" className="text-[14.5px] font-bold text-ink">
          {t("admin.hero.settings.seconds")}
        </label>
        <input id="hero-seconds" type="number" inputMode="numeric" min={1} max={10} value={s} readOnly={readOnly} onChange={(e) => setS(e.target.value)} className={ADM_INPUT} />
        <span className="text-[13px] text-muted">{t("admin.hero.settings.secondsHint")}</span>
      </div>
      <div>
        <AdmCheckbox label={t("admin.hero.settings.pill")} checked={pill} disabled={readOnly} onChange={(e) => setPill(e.target.checked)} />
        <p className="m-0 mt-1 text-[13px] text-muted">{t("admin.hero.settings.pillHint")}</p>
      </div>
      <div>
        <AdmCheckbox label={t("admin.hero.settings.offer")} checked={offer} disabled={readOnly} onChange={(e) => setOffer(e.target.checked)} />
        <p className="m-0 mt-1 text-[13px] text-muted">{t("admin.hero.settings.offerHint")}</p>
      </div>
      {!readOnly && (
        <div>
          <Button type="submit" loading={busy}>
            {t("admin.hero.settings.save")}
          </Button>
        </div>
      )}
    </form>
  );
}

/** "Add a slide", for admins who may change the page. */
export function AddSlideLink() {
  const { t } = useI18n();
  if (useReadOnly()) return null;
  return (
    <Link href="/admin/hero/new" className="inline-flex min-h-12 items-center gap-2 rounded-[12px] bg-primary px-5 text-[15.5px] font-bold text-white hover:bg-primary-hi">
      + {t("admin.hero.list.add")}
    </Link>
  );
}
