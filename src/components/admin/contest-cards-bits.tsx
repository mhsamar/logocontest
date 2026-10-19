"use client";

/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { postCardNow, remakeCard, resetCardCaption, saveCaptionTemplate, saveCardCaption, saveCardLine, saveCardSettings, saveHashtags, scheduleCard, skipCard } from "@/lib/cards/actions";
import { CARD_SIZES, CARD_STYLES, CAPTION_VARS, DEFAULT_CAPTION, DEFAULT_HASHTAGS, type CardSizeKey, type CardStyle } from "@/lib/cards/rules";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { AdminIcon } from "./icons";
import { useReadOnly } from "./read-only";
import { ADM_INPUT } from "./ui";

/** Admin › Contest cards (owner, 2026-10-19; Design/contest-cards/admin-contest-cards.html). */

type Res = { ok: true; message?: MessageKey; params?: Record<string, string> } | { ok: false; error: MessageKey; params?: Record<string, string> };

function useRun() {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [what, setWhat] = useState<string | null>(null);
  const run = (key: string, fn: () => Promise<Res>, then?: () => void) => {
    setWhat(key);
    start(async () => {
      const res = await fn();
      setWhat(null);
      if (!res.ok) return void toast(t(res.error, res.params), "danger");
      toast(t(res.message ?? "admin.saved", res.params));
      then?.();
      router.refresh();
    });
  };
  return { busy, what, run };
}

const SEG = "min-h-10 rounded-[10px] px-3.5 text-[14.5px] font-bold transition-colors";
const segOn = (on: boolean) => (on ? "bg-[#111216] text-white" : "bg-[#F4F5F7] text-ink hover:bg-[#ECEDF0]");

export type CardView = {
  id: string;
  style: CardStyle;
  status: string;
  attempts: number;
  lineBn: string;
  caption: string;
  images: Partial<Record<CardSizeKey, string>>;
  fbPostUrl: string | null;
  canPost: boolean;
  skipped: boolean;
};

export function CardDetail({ card, fbReady }: { card: CardView; fbReady: boolean }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const { busy, what, run } = useRun();
  const [size, setSize] = useState<CardSizeKey>("1080x1350");
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(card.caption);
  const [line, setLine] = useState(card.lineBn);
  const [when, setWhen] = useState(false);
  const [at, setAt] = useState("");
  const src = card.images[size];
  const ratio = CARD_SIZES.find((s) => s.key === size)!;
  const done = card.status === "posted" || card.status === "scheduled";
  const failed = card.status === "failed";

  return (
    <div className="grid gap-5 min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* The card */}
      <div className="flex min-w-0 flex-col gap-3">
        <div role="tablist" aria-label={t("admin.cards.detail.style")} className="flex flex-wrap gap-1.5">
          {CARD_SIZES.map((s) => (
            <button key={s.key} type="button" role="tab" aria-selected={size === s.key} onClick={() => setSize(s.key)} className={cx(SEG, segOn(size === s.key))}>
              {t(`admin.cards.detail.sizes.${s.key}`)}
            </button>
          ))}
        </div>
        <div className="overflow-hidden rounded-[14px] bg-[#F4F5F7] ring-1 ring-[#E9EAEE]" style={{ aspectRatio: `${ratio.width} / ${ratio.height}`, maxHeight: 560 }}>
          {src ? <img src={src} alt="" className="block h-full w-full object-contain" data-card-preview={size} /> : <p className="m-0 p-6 text-center text-[14.5px] text-muted">{t("admin.cards.detail.noPicture")}</p>}
        </div>
        {!card.skipped && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-bold text-muted">{t("admin.cards.detail.style")}</span>
            {CARD_STYLES.map((s) => (
              <button key={s} type="button" disabled={readOnly || busy || done} onClick={() => run(`style-${s}`, () => remakeCard(card.id, s))} aria-pressed={card.style === s} className={cx(SEG, card.style === s ? "bg-primary text-white" : "bg-[#F4F5F7] text-ink hover:bg-[#ECEDF0]", "disabled:cursor-not-allowed")}>
                {what === `style-${s}` ? "…" : t(`admin.cards.detail.styles.${s}`)}
              </button>
            ))}
          </div>
        )}
        {!card.skipped && !readOnly && !done && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="card-line" className="text-[13px] font-bold uppercase tracking-[.06em] text-muted">
              {t("admin.cards.detail.line")}
            </label>
            <div className="flex flex-wrap gap-2">
              <input id="card-line" value={line} maxLength={70} onChange={(e) => setLine(e.target.value)} className={cx(ADM_INPUT, "min-w-0 flex-[1_1_220px] font-[Hind_Siliguri,sans-serif]")} />
              <Button variant="secondary" disabled={busy || line === card.lineBn} loading={what === "line"} onClick={() => run("line", () => saveCardLine(card.id, line))}>
                {t("admin.cards.detail.saveLine")}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* How the post looks, and the buttons */}
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <strong className="text-[15.5px] text-ink">{t("admin.cards.detail.preview")}</strong>
          {!readOnly && !done && !card.skipped && <span className="text-[13px] text-muted">{t("admin.cards.detail.captionHint")}</span>}
        </div>
        <div className="rounded-[14px] border border-[#E3E4E8] bg-white p-4">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-full bg-[#8B0000] text-[18px] font-bold text-white">f</span>
            <span className="flex flex-col leading-tight">
              <strong className="text-[15px]">logocontest.bd</strong>
              <span className="text-[13px] text-muted">{t("admin.cards.detail.pagePreview")}</span>
            </span>
          </div>
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={7} maxLength={2000} className="w-full rounded-[12px] border border-[#DCDEE3] p-3 text-[14.5px] leading-relaxed" aria-label={t("admin.cards.settings.caption")} />
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" className="mr-auto text-[14px] font-bold text-primary hover:underline" onClick={() => run("reset", () => resetCardCaption(card.id), () => setEditing(false))}>
                  {t("admin.cards.detail.resetCaption")}
                </button>
                <Button variant="secondary" onClick={() => (setCaption(card.caption), setEditing(false))}>
                  {t("admin.cards.detail.cancel")}
                </Button>
                <Button loading={what === "caption"} onClick={() => run("caption", () => saveCardCaption(card.id, caption), () => setEditing(false))}>
                  {t("admin.cards.detail.saveCaption")}
                </Button>
              </div>
            </div>
          ) : (
            <button type="button" disabled={readOnly || done || card.skipped} onClick={() => setEditing(true)} className="block w-full whitespace-pre-wrap break-words rounded-[10px] text-left text-[14.5px] leading-relaxed text-ink enabled:hover:bg-[#F8F8FA] disabled:cursor-default" data-card-caption>
              {card.caption || "—"}
            </button>
          )}
          {src && size === "1080x1350" && <img src={src} alt="" className="mt-3 block w-full rounded-[10px]" />}
        </div>

        {card.fbPostUrl && (
          <a href={card.fbPostUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "secondary", block: true })}>
            {t("admin.cards.detail.viewPost")}
          </a>
        )}
        {!readOnly && !card.skipped && (
          <div className="grid grid-cols-2 gap-2.5">
            {!done && (
              <Button disabled={!fbReady || !card.canPost} loading={what === "post"} onClick={() => run("post", () => postCardNow(card.id))} data-card-post>
                {t(failed ? "admin.cards.detail.sendAgain" : "admin.cards.detail.postNow")}
              </Button>
            )}
            {!done && (
              <Button variant="secondary" disabled={!fbReady || !card.canPost} onClick={() => setWhen(true)}>
                {t("admin.cards.detail.schedule")}
              </Button>
            )}
            {src && (
              <a href={`/api/contest-cards/${card.id}/${size}.png`} className={buttonClasses({ variant: "secondary" })} download>
                <AdminIcon name="download" size={16} />
                {t("admin.cards.detail.downloadPng")}
              </a>
            )}
            {src && (
              <a href={`/api/contest-cards/${card.id}/all.zip`} className={buttonClasses({ variant: "secondary" })} download>
                <AdminIcon name="download" size={16} />
                {t("admin.cards.detail.zip")}
              </a>
            )}
            {!done && (
              <Button variant="secondary" className="col-span-2" loading={what === "remake"} onClick={() => run("remake", () => remakeCard(card.id))}>
                {t("admin.cards.detail.remake")}
              </Button>
            )}
          </div>
        )}
        {!readOnly && !done && !card.skipped && (
          <button type="button" disabled={busy} onClick={() => run("skip", () => skipCard(card.id))} className="self-center text-[14.5px] font-bold text-muted underline underline-offset-2 hover:text-primary" data-card-skip>
            {t("admin.cards.detail.skip")}
          </button>
        )}
      </div>

      <Modal
        open={when}
        onClose={() => setWhen(false)}
        title={t("admin.cards.detail.scheduleTitle")}
        closeLabel={t("common.close")}
        footer={
          <Button disabled={!at} loading={what === "schedule"} onClick={() => run("schedule", () => scheduleCard(card.id, new Date(at).toISOString()), () => setWhen(false))}>
            {t("admin.cards.detail.schedule")}
          </Button>
        }
      >
        <p className="m-0 text-[14.5px] text-muted">{t("admin.cards.detail.scheduleLead")}</p>
        <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className={cx(ADM_INPUT, "mt-3")} aria-label={t("admin.cards.detail.scheduleTitle")} />
      </Modal>
    </div>
  );
}

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} className={cx("relative block h-7 w-[46px] flex-none rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60", on ? "bg-[#14633C]" : "bg-[#B9BCC4]")}>
      <span className={cx("absolute top-[3px] size-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] transition-[left]", on ? "left-[21px]" : "left-[3px]")} />
    </button>
  );
}

const BOX = "flex flex-col gap-3 rounded-[14px] border border-[#E9EAEE] bg-white p-4";

export type CardSettingsValue = { auto_post: boolean; check_first: boolean; last24: boolean; post_when: "now" | "best" | "custom"; custom_time: string; style: "auto" | CardStyle; big_prize_from: number };

export function CardSettings({ value, caption, hashtags, money }: { value: CardSettingsValue; caption: string; hashtags: string[]; money: string }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const { busy, what, run } = useRun();
  const [v, setV] = useState(value);
  const [text, setText] = useState(caption);
  const [tags, setTags] = useState(hashtags);
  const [tag, setTag] = useState("");
  const set = <K extends keyof CardSettingsValue>(k: K, x: CardSettingsValue[K]) => setV((cur) => ({ ...cur, [k]: x }));
  const addTag = () => {
    const clean = tag.trim();
    if (clean && !tags.includes(clean)) setTags([...tags, clean.startsWith("#") ? clean : `#${clean}`]);
    setTag("");
  };
  const row = (key: "auto_post" | "check_first" | "last24", title: MessageKey, lead: MessageKey) => (
    <div className={cx(BOX, "flex-row items-center")}>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <strong className="text-[15.5px] text-ink">{t(title)}</strong>
        <span className="text-[14px] text-muted">{t(lead)}</span>
      </span>
      <Switch on={v[key]} onChange={(x) => set(key, x)} label={t(title)} disabled={readOnly} />
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 min-[900px]:grid-cols-2">
        {row("auto_post", "admin.cards.settings.autoPost", "admin.cards.settings.autoPostLead")}
        {row("check_first", "admin.cards.settings.checkFirst", "admin.cards.settings.checkFirstLead")}
        {row("last24", "admin.cards.settings.last24", "admin.cards.settings.last24Lead")}
        <div className={cx(BOX, "flex-row items-center")}>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <strong className="text-[15.5px] text-ink">{t("admin.cards.settings.private")}</strong>
            <span className="text-[14px] text-muted">{t("admin.cards.settings.privateLead")}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-[14px] font-bold text-[#14633C]">
            <AdminIcon name="lock" size={15} />
            {t("admin.cards.settings.always")}
          </span>
        </div>
        <div className={BOX}>
          <strong className="text-[15.5px] text-ink">{t("admin.cards.settings.when")}</strong>
          <div className="flex flex-wrap gap-1.5">
            {(["now", "best", "custom"] as const).map((w) => (
              <button key={w} type="button" disabled={readOnly} aria-pressed={v.post_when === w} onClick={() => set("post_when", w)} className={cx(SEG, segOn(v.post_when === w))}>
                {t(`admin.cards.settings.whenOpts.${w}`)}
              </button>
            ))}
          </div>
          {v.post_when === "custom" && (
            <label className="flex items-center gap-2 text-[14px] text-muted">
              {t("admin.cards.settings.customTime")}
              <input type="time" value={v.custom_time} disabled={readOnly} onChange={(e) => set("custom_time", e.target.value)} className={cx(ADM_INPUT, "h-10 w-32")} />
            </label>
          )}
        </div>
        <div className={BOX}>
          <strong className="text-[15.5px] text-ink">{t("admin.cards.settings.style")}</strong>
          <div className="flex flex-wrap gap-1.5">
            {(["auto", ...CARD_STYLES] as const).map((s) => (
              <button key={s} type="button" disabled={readOnly} aria-pressed={v.style === s} onClick={() => set("style", s)} className={cx(SEG, segOn(v.style === s))}>
                {t(`admin.cards.settings.styleOpts.${s}`)}
              </button>
            ))}
          </div>
          <label className="flex flex-wrap items-center gap-2 text-[14px] text-muted">
            {t("admin.cards.settings.bigFrom")}
            <input type="number" min={1} step={500} value={v.big_prize_from} disabled={readOnly} onChange={(e) => set("big_prize_from", Math.max(1, Math.round(Number(e.target.value) || 0)))} className={cx(ADM_INPUT, "h-10 w-36")} />
          </label>
          <span className="text-[13.5px] text-muted">{t("admin.cards.settings.autoNote", { amount: money })}</span>
        </div>
      </div>
      {!readOnly && (
        <div className="flex justify-end">
          <Button loading={what === "settings"} disabled={busy} onClick={() => run("settings", () => saveCardSettings(v))} data-card-settings-save>
            {t("admin.cards.settings.save")}
          </Button>
        </div>
      )}

      {/* Caption template */}
      <div className={BOX}>
        <strong className="text-[15.5px] text-ink">{t("admin.cards.settings.caption")}</strong>
        <textarea value={text} onChange={(e) => setText(e.target.value)} disabled={readOnly} rows={5} maxLength={2000} className="w-full rounded-[12px] border border-[#DCDEE3] bg-[#FBFBFC] p-3 font-mono text-[13.5px] leading-relaxed" aria-label={t("admin.cards.settings.caption")} />
        <span className="break-words text-[13px] text-muted">{t("admin.cards.settings.captionVars", { vars: CAPTION_VARS.map((x) => `{{${x}}}`).join(" ") })}</span>
        {!readOnly && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" loading={what === "caption-reset"} onClick={() => run("caption-reset", () => saveCaptionTemplate(null), () => setText(DEFAULT_CAPTION))}>
              {t("admin.cards.settings.reset")}
            </Button>
            <Button loading={what === "caption"} onClick={() => run("caption", () => saveCaptionTemplate(text))}>
              {t("admin.cards.settings.saveCaption")}
            </Button>
          </div>
        )}
      </div>

      {/* Hashtags */}
      <div className={cx(BOX, "min-[900px]:max-w-[50%]")}>
        <strong className="text-[15.5px] text-ink">{t("admin.cards.settings.hashtags")}</strong>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((h) => (
            <span key={h} className="inline-flex items-center gap-1 rounded-[10px] bg-[#F4F5F7] py-1.5 pl-3 pr-1.5 text-[14px] font-bold text-ink">
              {h}
              {!readOnly && (
                <button type="button" aria-label={t("admin.cards.settings.remove", { tag: h })} onClick={() => setTags(tags.filter((x) => x !== h))} className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-white hover:text-primary">
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
        {!readOnly && (
          <>
            <div className="flex gap-2">
              <input value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())} placeholder={t("admin.cards.settings.addPlaceholder")} maxLength={40} className={cx(ADM_INPUT, "h-10 min-w-0 flex-1")} aria-label={t("admin.cards.settings.add")} />
              <Button variant="secondary" onClick={addTag}>
                + {t("admin.cards.settings.add")}
              </Button>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" loading={what === "tags-reset"} onClick={() => run("tags-reset", () => saveHashtags(null), () => setTags(DEFAULT_HASHTAGS))}>
                {t("admin.cards.settings.reset")}
              </Button>
              <Button loading={what === "tags"} onClick={() => run("tags", () => saveHashtags(tags))}>
                {t("admin.cards.settings.saveHashtags")}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
