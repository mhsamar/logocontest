"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { saveText } from "@/lib/content/actions";
import { cx } from "@/lib/cx";
import { embedUrl, parseVideoUrl, type HowVideo, type HowVideoTab, type VideoSlot } from "@/lib/home/how-video";
import { saveHowVideo, setHowSwitch } from "@/lib/home/how-video-actions";
import { useI18n } from "@/lib/i18n/client";
import { useReadOnly } from "./read-only";

export type HowPoint = { key: string; en: string; bn: string };
/** One video. The Start a contest video (owner, 2026-10-26) has no points or cover, and borrows the clients' video until it has its own. */
export type HowVideoTabData = { tab: VideoSlot; title: string; hint?: string; video: HowVideo; points?: { title: HowPoint; body: HowPoint }[]; cover?: React.ReactNode; fallback?: { video: HowVideo; note: string }; none?: string };
type Switch = "how.video_autoplay" | "how.start_video_on" | "how.start_video_autoplay";

const INPUT = "h-11 w-full rounded-[10px] border border-[#DCDEE3] bg-white px-3 text-[15px] font-medium text-ink focus:outline-2 focus:outline-offset-1 focus:outline-primary read-only:bg-canvas";

/** Admin → Homepage, "How it works videos" (owner, 2026-10-11): the auto-play switch, one block per tab, and the Start a contest video with its two switches. */
export function HowVideosCard({ tabs, autoplay, start }: { tabs: HowVideoTabData[]; autoplay: boolean; start: { data: HowVideoTabData; on: boolean; autoplay: boolean } }) {
  const { t } = useI18n();
  return (
    <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line">
      <h2 className="font-semibold text-ink">{t("admin.homepage.videos.title")}</h2>
      <p className="mt-1 text-sm text-muted">{t("admin.homepage.videos.lead")}</p>

      <SwitchRow setting="how.video_autoplay" on={autoplay} label={t("admin.homepage.videos.autoplay")} hint={t("admin.homepage.videos.autoplayHint")} className="mt-4" />

      <div className="mt-2 divide-y divide-line">
        {tabs.map((d) => (
          <TabBlock key={d.tab} data={d} />
        ))}
        <TabBlock data={start.data}>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            <SwitchRow setting="how.start_video_on" on={start.on} label={t("admin.homepage.videos.startOn")} hint={t("admin.homepage.videos.startOnHint")} />
            <SwitchRow setting="how.start_video_autoplay" on={start.autoplay} label={t("admin.homepage.videos.startAuto")} hint={t("admin.homepage.videos.startAutoHint")} />
          </div>
        </TabBlock>
      </div>
    </section>
  );
}

/** One of the card's on/off settings, saved as soon as it is flipped. */
function SwitchRow({ setting, on, label, hint, className }: { setting: Switch; on: boolean; label: string; hint: string; className?: string }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(on);
  const [busy, start] = useTransition();

  const flip = () =>
    start(async () => {
      const next = !value;
      setValue(next);
      const res = await setHowSwitch(setting, next);
      if (!res.ok) {
        setValue(!next);
        return toast(t(res.error), "danger");
      }
      toast(t("admin.saved"));
      router.refresh();
    });

  return (
    <label className={cx("flex cursor-pointer items-center gap-3 rounded-xl bg-[#F4F5F7] px-4 py-3.5", className)}>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <strong className="text-[15.5px] text-ink">{label}</strong>
        <span className="text-sm text-muted">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        disabled={readOnly || busy}
        onClick={flip}
        className={cx("relative block h-7 w-[46px] flex-none rounded-full transition-colors disabled:cursor-not-allowed", value ? "bg-[#14633C]" : "bg-[#B9BCC4]")}
      >
        <span className={cx("absolute top-[3px] size-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] transition-[left]", value ? "left-[21px]" : "left-[3px]")} />
      </button>
    </label>
  );
}

function TabBlock({ data, children }: { data: HowVideoTabData; children?: React.ReactNode }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const router = useRouter();
  const toast = useToast();
  const [link, setLink] = useState(data.video.url);
  const [busy, start] = useTransition();
  const typed = link.trim() ? parseVideoUrl(link) : null;
  const bad = Boolean(link.trim()) && !typed;
  // The preview follows what is typed, so the admin sees the video before saving.
  // While a link is half typed or wrong, the preview keeps showing what is live.
  const shown = typed ?? (data.video.kind ? data.video : null);
  // Without its own video, the Start a contest corner plays the clients' one: the preview shows that.
  const borrowed = !shown && !data.video.kind && data.fallback?.video.kind ? data.fallback : null;
  const preview = shown ? embedUrl(shown, { autoplay: false, muted: true }) : borrowed ? embedUrl(borrowed.video, { autoplay: false, muted: true }) : null;

  const save = (value: string) =>
    start(async () => {
      const res = await saveHowVideo(data.tab, value);
      if (!res.ok) return toast(t(res.error), "danger");
      toast(t(value ? "admin.homepage.videos.saved" : "admin.homepage.videos.removed"));
      if (!value) setLink("");
      router.refresh();
    });

  return (
    <div className="py-5">
      <h3 className="text-[15.5px] font-bold text-ink">{data.title}</h3>
      {data.hint && <p className="mt-1 text-sm text-muted">{data.hint}</p>}
      {children}
      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
        <div className="min-w-0">
          <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">
            {t("admin.homepage.videos.url")}
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              readOnly={readOnly}
              inputMode="url"
              placeholder="https://youtu.be/…"
              aria-invalid={bad}
              className={cx(INPUT, bad && "border-danger")}
            />
          </label>
          <p className={cx("mt-1 text-xs", bad ? "font-semibold text-danger" : "text-muted")}>{bad ? t("admin.homepage.videos.badUrl") : t("admin.homepage.videos.urlHint")}</p>
          {!readOnly && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => save(link.trim())} loading={busy} disabled={bad || !link.trim() || link.trim() === data.video.url}>
                {t("admin.homepage.videos.save")}
              </Button>
              {data.video.kind && (
                <Button variant="ghost" onClick={() => save("")} disabled={busy}>
                  {t("admin.homepage.videos.remove")}
                </Button>
              )}
            </div>
          )}
        </div>
        <figure className="m-0">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-canvas ring-1 ring-line">
            {preview ? (
              <iframe src={preview} title={`${t("admin.homepage.videos.preview")}: ${data.title}`} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" className="absolute inset-0 size-full border-0" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted">{data.none ?? t("admin.homepage.videos.none")}</span>
            )}
          </div>
          <figcaption className="mt-1 text-xs text-muted">{borrowed ? borrowed.note : t("admin.homepage.videos.preview")}</figcaption>
        </figure>
      </div>

      {data.cover}

      {data.points && data.tab !== "start" && <Points tab={data.tab} points={data.points} />}
    </div>
  );
}

/** The four "In this video" points, in English and Bangla; saved as site texts (also editable in Admin → Texts). */
function Points({ tab, points }: { tab: HowVideoTab; points: NonNullable<HowVideoTabData["points"]> }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const router = useRouter();
  const toast = useToast();
  const all = points.flatMap((p) => [p.title, p.body]);
  const [values, setValues] = useState(() => Object.fromEntries(all.map((p) => [p.key, { en: p.en, bn: p.bn }])));
  const [busy, start] = useTransition();
  const changed = all.filter((p) => values[p.key].en !== p.en || values[p.key].bn !== p.bn);
  const set = (key: string, lang: "en" | "bn", v: string) => setValues((s) => ({ ...s, [key]: { ...s[key], [lang]: v } }));

  const save = () =>
    start(async () => {
      for (const p of changed) {
        const res = await saveText(p.key, values[p.key]);
        if (!res.ok) return toast(t(res.error), "danger");
      }
      toast(t("admin.homepage.videos.pointsSaved"));
      router.refresh();
    });

  const field = (p: HowPoint, lang: "en" | "bn", label: string) => (
    <label className="flex flex-col gap-1 text-xs font-bold text-muted">
      {label}
      <input value={values[p.key][lang]} onChange={(e) => set(p.key, lang, e.target.value)} readOnly={readOnly} maxLength={120} lang={lang} className={cx(INPUT, "h-10 text-sm")} />
    </label>
  );

  return (
    <details className="mt-4 rounded-xl ring-1 ring-line" data-tab={tab}>
      <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-ink">{t("admin.homepage.videos.points")}</summary>
      <div className="space-y-4 px-4 pb-4">
        {points.map((p, i) => (
          <fieldset key={p.title.key} className="m-0 grid gap-2 border-0 p-0 sm:grid-cols-2">
            <legend className="mb-1 text-sm font-bold text-ink">{t("admin.homepage.videos.point", { n: i + 1 })}</legend>
            {field(p.title, "en", t("admin.homepage.videos.titleEn"))}
            {field(p.title, "bn", t("admin.homepage.videos.titleBn"))}
            {field(p.body, "en", t("admin.homepage.videos.bodyEn"))}
            {field(p.body, "bn", t("admin.homepage.videos.bodyBn"))}
          </fieldset>
        ))}
        {!readOnly && (
          <Button variant="secondary" onClick={save} loading={busy} disabled={changed.length === 0}>
            {t("admin.homepage.videos.savePoints")}
          </Button>
        )}
      </div>
    </details>
  );
}
