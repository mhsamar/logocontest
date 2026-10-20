"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { SendCheckModal, type SendCheckSetup } from "@/components/logo-check/send-check";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/cx";
import { discardEntryImage, prepareEntryImageUpload, submitEntry } from "@/lib/entries/actions";
import { DECLARATION_KEYS, type DeclarationKey } from "@/lib/entries/declarations";
import { useI18n } from "@/lib/i18n/client";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const TYPES = ["image/jpeg", "image/png", "image/webp"];

type Item = { key: string; url: string; status: "uploading" | "done" | "failed"; path?: string; label: string; /** Size of the uploaded file (KB), shown in the logo check. */ kb?: number };

const LABEL_MAX = 60;
/** "signboard_mockup-2.png" → "signboard mockup 2": the starting name of a mockup, which the designer can change. */
const nameFromFile = (file: string) =>
  file
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LABEL_MAX);
type Limits = { min: number; max: number; px: number; mb: number; /** Days the winner has to send the final files (Settings). */ deliverDays?: number; /** A contest service's own design size (owner, 2026-10-13: real shape); square px×px when absent. */ size?: { w: number; h: number } | null };

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
async function toSquare(img: HTMLImageElement, px: number, h = px): Promise<Blob> {
  // A contest service's design keeps its real shape (owner, 2026-10-13): px × h instead of a square.
  const w = px;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  probe.drawImage(img, 0, 0, 1, 1, 0, 0, 1, 1);
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
  ctx.fillStyle = a < 20 ? "#ffffff" : `rgb(${r}, ${g}, ${b})`;
  ctx.fillRect(0, 0, w, h);
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = Math.round(img.naturalWidth * scale);
  const dh = Math.round(img.naturalHeight * scale);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, Math.round((w - dw) / 2), Math.round((h - dh) / 2), dw, dh);
  const as = (type: string) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.92));
  const webp = await as("image/webp");
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await as("image/jpeg");
  if (!jpeg) throw new Error("encode");
  return jpeg;
}

/** D-04 Submit a design (owner, 2026-10-08): 1–8 mockups in one box each (drag and drop works), each made px×px automatically, and eight declarations (one: no nude or sexual content). */
/** `check`: the logo check before sending (owner, 2026-10-14; logo contests only); without it the design is sent straight away. */
export function SubmitForm({ contestId, slug, limits, contestName, check, canHide = false }: { contestId: string; slug: string; limits: Limits; contestName: string; check?: SendCheckSetup | null; /** Pro "Hide my design" (owner, 2026-10-14). */ canHide?: boolean }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [ticked, setTicked] = useState<Set<DeclarationKey>>(new Set());
  const [hide, setHide] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  // The design check held it for the team (owner, 2026-10-15).
  const [held, setHeld] = useState(false);
  // Every design waits for approval (owner, 2026-10-20): a neutral note, not the "doubted picture" one.
  const [heldAll, setHeldAll] = useState(false);
  const [over, setOver] = useState(false);
  const [busy, start] = useTransition();
  const [sending, setSending] = useState(false);
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
    update(key, upError ? { status: "failed" } : { status: "done", path: prepared.path, kb: Math.max(1, Math.round(blob.size / 1024)) });
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
      // Already the right size, type and light (owner, 2026-10-14: 600 KB): upload as it is. Anything else is made
      // square (and light) first, so a picture of any size works.
      const [fw, fh] = limits.size ? [limits.size.w, limits.size.h] : [limits.px, limits.px];
      if (img.naturalWidth === fw && img.naturalHeight === fh && TYPES.includes(file.type) && file.size <= 600 * 1024) {
        setItems((list) => [...list, { key, url: original, status: "uploading", label: nameFromFile(file.name) }]);
        void upload(key, file);
        continue;
      }
      let blob: Blob;
      try {
        blob = await toSquare(img, fw, fh);
      } catch {
        toast(t("submit.errors.cantOpen"), "danger");
        continue;
      }
      setItems((list) => [...list, { key, url: track(URL.createObjectURL(blob)), status: "uploading", label: nameFromFile(file.name) }]);
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
    items.some((i) => !i.label.trim()) && t("submit.missing.names"),
    uploading && t("submit.missing.uploading"),
    ticked.size < DECLARATION_KEYS.length && t("submit.missing.declarations", { n: fmt(DECLARATION_KEYS.length) }),
  ].filter(Boolean) as string[];

  // "Submit new design": an empty form for the next design.
  const startNew = () => {
    setDone(null);
    setItems([]);
    setTicked(new Set());
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = (checkId: string | null = null) =>
    start(async () => {
      setError(null);
      const res = await submitEntry({ contestId, paths: ready.map((i) => i.path!), labels: ready.map((i) => i.label.trim()), declarations: [...ticked], checkId, hidden: canHide && hide });
      setSending(false);
      if (!res.ok) return setError(t(res.error.key, res.error.params));
      setHeld(res.held);
      setHeldAll(res.heldAll);
      setDone(res.number);
    });

  // Logo check (owner, 2026-10-14): Send opens Upload → Check → Send for the cover; "Upload a new version" takes the
  // checked cover away so the designer adds the new file.
  const cover = items[0]?.status === "done" && items[0].path ? items[0] : null;
  const [w, h] = limits.size ? [limits.size.w, limits.size.h] : [limits.px, limits.px];
  const newVersion = () => {
    setSending(false);
    if (cover) remove(cover);
    window.setTimeout(() => input.current?.click(), 50);
  };

  return (
    <div className="space-y-6">
      {/* 1. Mockups */}
      <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">{t("submit.mockups.title")}</h2>
          <span className="text-sm font-semibold tabular-nums text-muted">{t("submit.mockups.counter", { n: fmt(items.length), max: fmt(limits.max) })}</span>
        </div>

        <p className="m-0 mt-1 text-sm font-medium text-primary-dark">{t("submit.mockups.rule", { max: fmt(limits.max), mb: fmt(limits.mb) })}</p>
        <p className="m-0 mt-0.5 text-xs text-muted">
          {slotsLeft <= 0 ? t("submit.mockups.full", { max: fmt(limits.max) }) : `${t("submit.mockups.drop")} ${t("submit.mockups.addHint", { px: limits.px })}`}
        </p>

        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            void pick(files);
          }}
        />
        {/* One box per mockup (owner, 2026-10-11): filled boxes first, then the empty ones. Drop images anywhere here. */}
        <div
          className="relative mt-4"
          onDragOver={(e) => {
            if (slotsLeft <= 0 || !e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setOver(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const all = [...e.dataTransfer.files];
            const files = all.filter((f) => TYPES.includes(f.type));
            if (files.length < all.length) toast(t("submit.errors.type"), "danger");
            void pick(files);
          }}
        >
          <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4">
            {Array.from({ length: limits.max }, (_, i) => {
              const item = items[i];
              if (!item)
                return (
                  <li key={`empty-${i}`}>
                    <button
                      type="button"
                      onClick={() => input.current?.click()}
                      aria-label={t("submit.mockups.slot", { n: fmt(i + 1) })}
                      className={cx(
                        "flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-[14px] border-2 border-dashed bg-chip/60 text-muted transition-colors hover:border-primary hover:text-primary",
                        i === items.length ? "border-primary/60" : "border-line",
                      )}
                    >
                      <span className="flex size-10 items-center justify-center rounded-full bg-tint text-primary" aria-hidden>
                        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                        </svg>
                      </span>
                      <span className="text-xs font-semibold">{i === 0 ? t("submit.mockups.cover") : fmt(i + 1)}</span>
                    </button>
                  </li>
                );
              return (
                <li key={item.key} className={cx("relative overflow-hidden rounded-[14px] bg-chip ring-1", i === 0 ? "ring-2 ring-primary" : "ring-line")}>
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
                  {/* Every mockup has a name (owner, 2026-10-11): it starts from the file name. */}
                  <div className="border-t border-line bg-surface px-1.5 pt-1.5">
                    <input
                      value={item.label}
                      onChange={(e) => update(item.key, { label: e.target.value.slice(0, LABEL_MAX) })}
                      maxLength={LABEL_MAX}
                      placeholder={t("submit.mockups.name")}
                      aria-label={t("submit.mockups.nameLabel", { n: fmt(i + 1) })}
                      className={cx(
                        "h-9 w-full rounded-[10px] border bg-white px-2.5 text-[13px] font-medium text-ink placeholder:text-muted focus:outline-2 focus:outline-offset-1 focus:outline-primary",
                        item.label.trim() ? "border-line" : "border-danger",
                      )}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-1 bg-surface px-1.5 py-1">
                    {i > 0 && item.status === "done" ? (
                      <button type="button" onClick={() => makeCover(item)} className="min-h-9 rounded-[10px] px-2 text-xs font-semibold text-primary hover:bg-chip">
                        {t("submit.mockups.makeCover")}
                      </button>
                    ) : (
                      <span />
                    )}
                    <button type="button" onClick={() => remove(item)} className="min-h-9 rounded-[10px] px-2 text-xs font-semibold text-muted hover:bg-chip hover:text-danger">
                      {t("submit.mockups.remove")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {over && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[14px] border-2 border-dashed border-primary bg-tint/90 text-center text-sm font-bold text-primary">
              {t("submit.mockups.dropHere")}
            </div>
          )}
        </div>
      </section>

      {/* 2. Confirm */}
      <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line sm:p-6">
        <h2 className="text-lg font-bold text-ink">{t("submit.confirm.title")}</h2>
        <div className="mt-2 divide-y divide-line">
          {DECLARATION_KEYS.map((k) => (
            <Checkbox
              key={k}
              label={t(`submit.declarations.${k}`, { days: limits.deliverDays ?? 3 })}
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
        {/* One tick for all of them (owner, 2026-10-16). */}
        <div className="mt-1 border-t-2 border-line pt-1" data-agree-all>
          <Checkbox
            label={<strong className="font-bold text-ink">{t("submit.confirm.agreeAll")}</strong>}
            checked={ticked.size === DECLARATION_KEYS.length}
            onChange={(e) => setTicked(e.target.checked ? new Set(DECLARATION_KEYS) : new Set())}
          />
        </div>
        {/* Pro "Hide my design" (owner, 2026-10-14) */}
        {canHide && (
          <div className="mt-3 rounded-[14px] bg-[#F4F0FF] px-3.5 py-1" data-hide-option>
            <Checkbox label={t("pro.hide.submitLabel")} description={t("pro.hide.submitHint")} checked={hide} onChange={(e) => setHide(e.target.checked)} />
          </div>
        )}
      </section>

      {/* 3. Submit */}
      <div className="space-y-3">
        {missing.length > 0 && (
          <div className="rounded-[14px] bg-chip px-4 py-3 text-sm">
            <p className="font-semibold text-ink">{t("submit.missing.title")}</p>
            <ul className="mt-1 list-inside list-disc text-muted">
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        <Button size="lg" block onClick={() => (check ? setSending(true) : submit())} loading={busy && !sending} disabled={missing.length > 0 || done !== null}>
          {t("submit.button")}
        </Button>
        <p className="text-center text-sm">
          <Link href={`/contest/${slug}`} className="font-medium text-muted hover:text-primary">
            {t("submit.back")}
          </Link>
        </p>
      </div>

      {check && (
        <SendCheckModal
          open={sending}
          onClose={() => setSending(false)}
          contest={contestName}
          contestId={contestId}
          cover={cover ? { path: cover.path!, url: cover.url, name: cover.label || t("submit.mockups.cover"), kb: cover.kb ?? null, w, h } : null}
          setup={check}
          busy={busy}
          onSend={(checkId) => submit(checkId)}
          onNewVersion={newVersion}
        />
      )}

      {/* D-05 (owner, 2026-10-11): a pop-up after submitting, with View design and Submit new design */}
      <Modal
        open={done !== null}
        onClose={startNew}
        title={t(heldAll ? "submit.done.heldAllTitle" : held ? "submit.done.heldTitle" : "submit.done.title")}
        closeLabel={t("common.close")}
        footer={
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <ButtonLink href={`/contest/${slug}?tab=entries&entry=${done ?? ""}`} size="lg" className="flex-1">
              {t("submit.done.view")}
            </ButtonLink>
            {/* A different colour from "View design" (owner, 2026-10-16). */}
            <Button variant="dark" size="lg" className="flex-1" onClick={startNew}>
              {t("submit.done.another")}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col items-center py-2 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-success/10 text-success">
            <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
              <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="mt-4 text-lg font-semibold text-ink">{done !== null && t(heldAll ? "submit.done.heldAllBody" : held ? "submit.done.heldBody" : "submit.done.body", { n: fmt(done) })}</p>
          {!held && <p className="mt-1 text-sm text-muted">{t("submit.done.next")}</p>}
        </div>
      </Modal>
    </div>
  );
}
