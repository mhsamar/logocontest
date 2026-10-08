"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/cx";
import { discardEntryImage, prepareEntryImageUpload, submitEntry } from "@/lib/entries/actions";
import { DECLARATION_KEYS, type DeclarationKey } from "@/lib/entries/declarations";
import { useI18n } from "@/lib/i18n/client";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const TYPES = ["image/jpeg", "image/png", "image/webp"];

type Item = { key: string; url: string; status: "uploading" | "done" | "failed"; path?: string };
type Limits = { min: number; max: number; px: number; mb: number };

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Any image becomes a px×px square automatically (owner, 2026-10-08): the whole
 * image is kept and centred, and the spare edges take the colour of its top-left
 * corner (white for transparent images). Nothing is cut off.
 */
async function toSquare(img: HTMLImageElement, px: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext("2d")!;
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  probe.drawImage(img, 0, 0, 1, 1, 0, 0, 1, 1);
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
  ctx.fillStyle = a < 20 ? "#ffffff" : `rgb(${r}, ${g}, ${b})`;
  ctx.fillRect(0, 0, px, px);
  const scale = Math.min(px / img.naturalWidth, px / img.naturalHeight);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, Math.round((px - w) / 2), Math.round((px - h) / 2), w, h);
  const as = (type: string) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.92));
  const webp = await as("image/webp");
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await as("image/jpeg");
  if (!jpeg) throw new Error("encode");
  return jpeg;
}

/** D-04 Submit a design (owner, 2026-10-08): 1–8 mockups, each made px×px automatically, and seven declarations. */
export function SubmitForm({ contestId, slug, limits }: { contestId: string; slug: string; limits: Limits }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [ticked, setTicked] = useState<Set<DeclarationKey>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [busy, start] = useTransition();
  const fmt = (n: number) => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(n);

  // Let go of object URLs when leaving the page.
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  const track = (u: string) => (urls.current.push(u), u);

  const slotsLeft = limits.max - items.length;
  const update = (key: string, patch: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const upload = async (key: string, blob: Blob) => {
    const prepared = await prepareEntryImageUpload({ contestId, type: blob.type, size: blob.size });
    if (!prepared.ok) {
      update(key, { status: "failed" });
      return toast(t(prepared.error.key, prepared.error.params), "danger");
    }
    const { error: upError } = await createBrowserSupabase().storage.from("entry-files").uploadToSignedUrl(prepared.path, prepared.token, blob, { contentType: blob.type });
    update(key, upError ? { status: "failed" } : { status: "done", path: prepared.path });
  };

  const pick = async (files: File[]) => {
    const room = limits.max - items.length;
    if (files.length > room) toast(t("submit.mockups.full", { max: limits.max }), "danger");
    for (const file of files.slice(0, Math.max(0, room))) {
      const original = track(URL.createObjectURL(file));
      const img = await loadImage(original);
      if (!img) {
        toast(t("submit.errors.cantOpen"), "danger");
        continue;
      }
      const key = crypto.randomUUID();
      // Already the right size and type: upload as it is. Anything else is made square first.
      if (img.naturalWidth === limits.px && img.naturalHeight === limits.px && TYPES.includes(file.type)) {
        setItems((list) => [...list, { key, url: original, status: "uploading" }]);
        void upload(key, file);
        continue;
      }
      let blob: Blob;
      try {
        blob = await toSquare(img, limits.px);
      } catch {
        toast(t("submit.errors.cantOpen"), "danger");
        continue;
      }
      setItems((list) => [...list, { key, url: track(URL.createObjectURL(blob)), status: "uploading" }]);
      void upload(key, blob);
    }
  };

  const remove = (item: Item) => {
    setItems((list) => list.filter((i) => i.key !== item.key));
    if (item.path) void discardEntryImage(contestId, item.path);
  };
  const makeCover = (item: Item) => setItems((list) => [item, ...list.filter((i) => i.key !== item.key)]);

  const uploading = items.some((i) => i.status === "uploading");
  const ready = items.filter((i) => i.status === "done");
  const missing = [
    ready.length < limits.min && t("submit.missing.images"),
    uploading && t("submit.missing.uploading"),
    ticked.size < DECLARATION_KEYS.length && t("submit.missing.declarations"),
  ].filter(Boolean) as string[];

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await submitEntry({ contestId, paths: ready.map((i) => i.path!), declarations: [...ticked] });
      if (!res.ok) return setError(t(res.error.key, res.error.params));
      setDone(res.number);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

  if (done !== null) {
    return (
      <div className="rounded-2xl bg-surface p-6 text-center shadow-card ring-1 ring-line sm:p-10">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/10 text-success">
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <h2 className="mt-4 text-h2 font-bold text-ink">{t("submit.done.title")}</h2>
        <p className="mt-2 text-muted">{t("submit.done.body", { n: fmt(done) })}</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <ButtonLink href={`/contest/${slug}?tab=entries&entry=${done}`} size="lg">
            {t("submit.done.view")}
          </ButtonLink>
          <Button variant="secondary" size="lg" onClick={() => location.reload()}>
            {t("submit.done.another")}
          </Button>
          <ButtonLink href="/contests" variant="ghost" size="lg">
            {t("submit.done.more")}
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Mockups */}
      <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">{t("submit.mockups.title")}</h2>
          <span className="text-sm font-semibold tabular-nums text-muted">{t("submit.mockups.counter", { n: fmt(items.length), max: fmt(limits.max) })}</span>
        </div>

        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            void pick(files);
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={slotsLeft <= 0}
          className="mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-canvas/60 px-4 py-8 text-center transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-line"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-cream text-primary-dark" aria-hidden>
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 16V4M7 9l5-5 5 5M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="font-semibold text-ink">{t("submit.mockups.add")}</span>
          <span className="text-sm font-medium text-primary-dark">{t("submit.mockups.rule", { max: fmt(limits.max), mb: fmt(limits.mb) })}</span>
          <span className="text-xs text-muted">{slotsLeft <= 0 ? t("submit.mockups.full", { max: fmt(limits.max) }) : t("submit.mockups.addHint", { px: limits.px })}</span>
        </button>

        {items.length > 0 && (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {items.map((item, i) => (
              <li key={item.key} className={cx("relative overflow-hidden rounded-xl bg-canvas ring-1", i === 0 ? "ring-2 ring-primary" : "ring-line")}>
                <img src={item.url} alt={t("submit.mockups.image", { n: i + 1 })} className="aspect-square w-full object-cover" />
                <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-xs font-bold text-white">
                  {i === 0 ? t("submit.mockups.cover") : fmt(i + 1)}
                </span>
                {item.status !== "done" && (
                  <div className={cx("absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs font-semibold", item.status === "failed" ? "bg-danger/80 text-white" : "bg-white/70 text-ink")}>
                    {item.status === "uploading" && <Spinner className="size-5" />}
                    {item.status === "uploading" ? t("submit.mockups.uploading") : t("submit.mockups.failed")}
                  </div>
                )}
                <div className="flex items-center justify-between gap-1 border-t border-line bg-surface px-1.5 py-1">
                  {i > 0 && item.status === "done" ? (
                    <button type="button" onClick={() => makeCover(item)} className="min-h-9 rounded-md px-2 text-xs font-semibold text-primary hover:bg-canvas">
                      {t("submit.mockups.makeCover")}
                    </button>
                  ) : (
                    <span />
                  )}
                  <button type="button" onClick={() => remove(item)} className="min-h-9 rounded-md px-2 text-xs font-semibold text-muted hover:bg-canvas hover:text-danger">
                    {t("submit.mockups.remove")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 2. Confirm */}
      <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line sm:p-6">
        <h2 className="text-lg font-bold text-ink">{t("submit.confirm.title")}</h2>
        <div className="mt-2 divide-y divide-line">
          {DECLARATION_KEYS.map((k) => (
            <Checkbox
              key={k}
              label={t(`submit.declarations.${k}`)}
              checked={ticked.has(k)}
              onChange={(e) =>
                setTicked((s) => {
                  const next = new Set(s);
                  if (e.target.checked) next.add(k);
                  else next.delete(k);
                  return next;
                })
              }
            />
          ))}
        </div>
      </section>

      {/* 3. Submit */}
      <div className="space-y-3">
        {missing.length > 0 && (
          <div className="rounded-xl bg-canvas px-4 py-3 text-sm">
            <p className="font-semibold text-ink">{t("submit.missing.title")}</p>
            <ul className="mt-1 list-inside list-disc text-muted">
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        <Button size="lg" block onClick={submit} loading={busy} disabled={missing.length > 0}>
          {t("submit.button")}
        </Button>
        <p className="text-center text-sm">
          <Link href={`/contest/${slug}`} className="font-medium text-muted hover:text-primary">
            {t("submit.back")}
          </Link>
        </p>
      </div>

    </div>
  );
}
