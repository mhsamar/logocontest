"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { clock, parseClock, type Chapter } from "@/components/home/landing/hero-video-rules";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/cx";
import { embedUrl, parseVideoUrl, type HowVideo } from "@/lib/home/how-video";
import { saveHeroChapters, saveHeroVideo, setHeroVideoSwitch } from "@/lib/home/hero-video-actions";
import { useI18n } from "@/lib/i18n/client";
import { useReadOnly } from "./read-only";

const INPUT = "h-11 w-full rounded-[10px] border border-[#DCDEE3] bg-white px-3 text-[15px] font-medium text-ink focus:outline-2 focus:outline-offset-1 focus:outline-primary read-only:bg-canvas";

/**
 * Admin → Homepage, "Home hero video" (owner, 2026-11-06): the YouTube link with a live preview, the video and
 * "start with sound" switches, the poster picture and the chapters under the video. Saving shows on the home page at once.
 */
export function HeroVideoCard({ video, on, sound, chapters, poster }: { video: HowVideo; on: boolean; sound: boolean; chapters: Chapter[]; poster: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line" id="hero-video">
      <h2 className="font-semibold text-ink">{t("admin.homepage.heroVideo.title")}</h2>
      <p className="mt-1 text-sm text-muted">{t("admin.homepage.heroVideo.lead")}</p>
      <LinkBlock video={video} />
      <div className="mt-1 grid gap-2 lg:grid-cols-2">
        <Switch setting="hero.video_on" on={on} label={t("admin.homepage.heroVideo.on")} hint={t("admin.homepage.heroVideo.onHint")} />
        <Switch setting="hero.video_sound" on={sound} label={t("admin.homepage.heroVideo.sound")} hint={t("admin.homepage.heroVideo.soundHint")} />
      </div>
      {poster}
      <Chapters initial={chapters} />
    </section>
  );
}

function LinkBlock({ video }: { video: HowVideo }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const router = useRouter();
  const toast = useToast();
  const [link, setLink] = useState(video.url);
  const [busy, start] = useTransition();
  const typed = link.trim() ? parseVideoUrl(link) : null;
  const youtube = typed?.kind === "youtube" ? typed : null;
  const bad = Boolean(link.trim()) && !youtube;
  // The preview follows what is typed; while a link is half typed or wrong it keeps showing what is live.
  const shown = youtube ?? (video.kind === "youtube" ? video : null);
  const preview = shown ? embedUrl(shown, { autoplay: false, muted: true }) : null;

  const save = (value: string) =>
    start(async () => {
      const res = await saveHeroVideo(value);
      if (!res.ok) return toast(t(res.error), "danger");
      toast(t(value ? "admin.homepage.videos.saved" : "admin.homepage.videos.removed"));
      if (!value) setLink("");
      router.refresh();
    });

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
      <div className="min-w-0">
        <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">
          {t("admin.homepage.heroVideo.url")}
          <input value={link} onChange={(e) => setLink(e.target.value)} readOnly={readOnly} inputMode="url" placeholder="https://youtu.be/…" aria-invalid={bad} className={cx(INPUT, bad && "border-danger")} />
        </label>
        <p className={cx("mt-1 text-xs", bad ? "font-semibold text-danger" : "text-muted")}>
          {bad ? t("admin.homepage.heroVideo.badUrl") : youtube ? t("admin.homepage.heroVideo.found", { id: youtube.id }) : t("admin.homepage.heroVideo.urlHint")}
        </p>
        {!readOnly && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => save(link.trim())} loading={busy} disabled={bad || !link.trim() || link.trim() === video.url}>
              {t("admin.homepage.videos.save")}
            </Button>
            {video.kind && (
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
            <iframe src={preview} title={t("admin.homepage.videos.preview")} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" className="absolute inset-0 size-full border-0" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted">{t("admin.homepage.heroVideo.none")}</span>
          )}
        </div>
        <figcaption className="mt-1 text-xs text-muted">{t("admin.homepage.videos.preview")}</figcaption>
      </figure>
    </div>
  );
}

function Switch({ setting, on, label, hint }: { setting: "hero.video_on" | "hero.video_sound"; on: boolean; label: string; hint: string }) {
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
      const res = await setHeroVideoSwitch(setting, next);
      if (!res.ok) {
        setValue(!next);
        return toast(t(res.error), "danger");
      }
      toast(t("admin.saved"));
      router.refresh();
    });
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#F4F5F7] px-4 py-3.5">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <strong className="text-[15.5px] text-ink">{label}</strong>
        <span className="text-sm text-muted">{hint}</span>
      </span>
      <button type="button" role="switch" aria-checked={value} aria-label={label} disabled={readOnly || busy} onClick={flip} className={cx("relative block h-7 w-[46px] flex-none rounded-full transition-colors disabled:cursor-not-allowed", value ? "bg-[#14633C]" : "bg-[#B9BCC4]")}>
        <span className={cx("absolute top-[3px] size-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] transition-[left]", value ? "left-[21px]" : "left-[3px]")} />
      </button>
    </label>
  );
}

type Row = { time: string; label: string; key: number };
let nextKey = 0;
const toRows = (list: Chapter[]): Row[] => list.map((c) => ({ time: clock(c.at), label: c.label, key: nextKey++ }));

/** The chapters under the video: time (m:ss) and label, added, edited, removed and reordered, then saved together. */
function Chapters({ initial }: { initial: Chapter[] }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>(() => toRows(initial));
  const [busy, start] = useTransition();
  const parsed = rows.map((r) => ({ at: parseClock(r.time), label: r.label.trim() }));
  const bad = parsed.some((p) => p.at === null || !p.label || p.label.length > 40);
  const set = (i: number, patch: Partial<Row>) => setRows((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, by: number) =>
    setRows((list) => {
      const next = [...list];
      const [r] = next.splice(i, 1);
      next.splice(i + by, 0, r);
      return next;
    });
  const save = () =>
    start(async () => {
      const res = await saveHeroChapters(parsed.map((p) => ({ at: p.at ?? 0, label: p.label })));
      if (!res.ok) return toast(t(res.error), "danger");
      toast(t("admin.saved"));
      router.refresh();
    });

  return (
    <div className="mt-2 border-t border-line pt-4">
      <h3 className="text-[15.5px] font-bold text-ink">{t("admin.homepage.heroVideo.chapters")}</h3>
      <p className="mt-1 text-sm text-muted">{t("admin.homepage.heroVideo.chaptersHint")}</p>
      <ol className="mt-3 space-y-2">
        {rows.map((r, i) => {
          const wrongTime = parseClock(r.time) === null;
          return (
            <li key={r.key} className="flex flex-wrap items-center gap-2">
              <input value={r.time} onChange={(e) => set(i, { time: e.target.value })} readOnly={readOnly} aria-label={t("admin.homepage.heroVideo.time")} placeholder="0:15" aria-invalid={wrongTime} className={cx(INPUT, "w-24 font-mono", wrongTime && "border-danger")} />
              <input value={r.label} onChange={(e) => set(i, { label: e.target.value })} readOnly={readOnly} maxLength={40} lang="bn" aria-label={t("admin.homepage.heroVideo.label")} className={cx(INPUT, "min-w-0 flex-1")} />
              {!readOnly && (
                <span className="flex gap-1">
                  <Button variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t("admin.homepage.moveUp")}>
                    ↑
                  </Button>
                  <Button variant="ghost" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={t("admin.homepage.moveDown")}>
                    ↓
                  </Button>
                  <Button variant="ghost" onClick={() => setRows((list) => list.filter((_, j) => j !== i))} aria-label={t("admin.homepage.remove")}>
                    ×
                  </Button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {!readOnly && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setRows((list) => [...list, { time: "", label: "", key: nextKey++ }])} disabled={rows.length >= 8}>
            {t("admin.homepage.heroVideo.addChapter")}
          </Button>
          <Button onClick={save} loading={busy} disabled={bad}>
            {t("admin.homepage.heroVideo.saveChapters")}
          </Button>
        </div>
      )}
    </div>
  );
}
