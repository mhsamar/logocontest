/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { ShowcaseArt, SlideText } from "@/components/home/landing/hero-showcase";
import "@/components/home/landing/landing.css";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { SITE_BUCKET } from "@/lib/content/pictures";
import { cx } from "@/lib/cx";
import { prepareHeroPicture, processHeroPicture, saveHeroSlide, type HeroPicture, type HeroPictureKind } from "@/lib/home/hero-actions";
import { colorsFrom, HERO_ITEMS, logoSizes, photoPosition, type HeroColors, type HeroItem, type HeroRole, type HeroSlideView } from "@/lib/home/hero-slides";
import { useI18n } from "@/lib/i18n/client";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { AdmCard, AdmCheckbox, ADM_INPUT, CardTitle } from "./ui";
import { useReadOnly } from "./read-only";

/** What the editor starts from: an existing slide, or an empty new one. */
export type HeroEditorValue = {
  id: string | null;
  brand: string;
  personName: string;
  role: HeroRole;
  item: HeroItem;
  colors: HeroColors;
  photo: HeroPicture | null;
  photoFocus: number;
  logo: HeroPicture | null;
  logoWhite: HeroPicture | null;
  badgeLogo: "color" | "white";
  en: { line1: string; line2: string; text: string };
  bn: { line1: string; line2: string; text: string };
  isActive: boolean;
};

/** Pictures bigger than the upload limit are made smaller in the browser first (photos as JPEG, logos as PNG). */
async function shrink(file: File, kind: HeroPictureKind): Promise<File> {
  if (file.size <= 1.8 * 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const max = kind === "photo" ? 1600 : 1200;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const type = kind === "photo" ? "image/jpeg" : "image/png";
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.88));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, kind === "photo" ? ".jpg" : ".png"), { type }) : file;
  } catch {
    return file;
  }
}

/** One picture: preview, upload or replace, and why it failed. */
function PictureTile({
  kind,
  title,
  hint,
  picture,
  dark,
  busy,
  onPick,
  extra,
}: {
  kind: HeroPictureKind;
  title: string;
  hint: string;
  picture: HeroPicture | null;
  dark?: string;
  busy: boolean;
  onPick: (file: File) => void;
  extra?: React.ReactNode;
}) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex min-w-0 flex-col gap-2.5 rounded-[14px] border border-adm-line p-3">
      <div
        className={cx("flex h-40 items-center justify-center overflow-hidden rounded-[10px] sm:h-auto sm:aspect-square", kind === "photo" ? "bg-[#6E6C6A]" : "bg-[repeating-conic-gradient(#eef0f3_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]")}
        style={kind === "logoWhite" ? { background: dark ?? "#3A3C45" } : undefined}
      >
        {picture ? (
          <img src={picture.url} alt="" className={cx(kind === "photo" ? "h-full w-full object-cover" : "max-h-[70%] max-w-[70%] object-contain")} />
        ) : (
          <span className="px-3 text-center text-sm text-muted">{t("admin.hero.pictures.none")}</span>
        )}
      </div>
      <div>
        <p className="m-0 font-semibold text-ink">{title}</p>
        <p className="m-0 text-[13px] text-muted">{hint}</p>
      </div>
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept={kind === "photo" ? "image/jpeg,image/png,image/webp" : "image/png,image/webp"}
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) onPick(f);
            }}
          />
          <Button variant="secondary" loading={busy} onClick={() => input.current?.click()}>
            {busy ? t("admin.hero.pictures.working") : picture ? t("admin.hero.pictures.replace") : t("admin.hero.pictures.upload")}
          </Button>
          {extra}
        </div>
      )}
    </div>
  );
}

const Label = ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
  <label htmlFor={htmlFor} className="text-[14.5px] font-bold text-ink">
    {children}
  </label>
);

/** A-09b slide editor (owner, 2026-10-11): pictures, who, product, colours, words, with a live preview. */
export function HeroEditor({ initial }: { initial: HeroEditorValue }) {
  const { t, locale } = useI18n();
  const readOnly = useReadOnly();
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState(initial);
  const [colorsTouched, setColorsTouched] = useState(Boolean(initial.id));
  const [suggested, setSuggested] = useState<string | null>(null);
  const [busy, setBusy] = useState<HeroPictureKind | null>(null);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewLang, setPreviewLang] = useState<"en" | "bn">(locale === "bn" ? "bn" : "en");
  const [saving, start] = useTransition();
  const set = <K extends keyof HeroEditorValue>(k: K, val: HeroEditorValue[K]) => setV((x) => ({ ...x, [k]: val }));
  const setText = (lang: "en" | "bn", k: "line1" | "line2" | "text", val: string) => setV((x) => ({ ...x, [lang]: { ...x[lang], [k]: val } }));
  const setColor = (k: keyof HeroColors, val: string) => (setColorsTouched(true), setV((x) => ({ ...x, colors: { ...x.colors, [k]: val.toUpperCase() } })));

  const upload = async (kind: HeroPictureKind, picked: File) => {
    setPictureError(null);
    setBusy(kind);
    try {
      const file = await shrink(picked, kind);
      const prepared = await prepareHeroPicture(kind, { type: file.type, size: file.size });
      if (!prepared.ok) return setPictureError(t(prepared.error));
      const { error: upError } = await createBrowserSupabase().storage.from(SITE_BUCKET).uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
      if (upError) return setPictureError(t("admin.hero.errors.upload"));
      const res = await processHeroPicture(kind, prepared.path);
      if (!res.ok) return setPictureError(t(res.error));
      const { white, color, ...picture } = res.picture;
      if (kind === "photo") set("photo", picture);
      else if (kind === "logoWhite") set("logoWhite", picture);
      else {
        setV((x) => ({ ...x, logo: picture, logoWhite: white ?? x.logoWhite }));
        if (color) {
          setSuggested(color);
          if (!colorsTouched) setV((x) => ({ ...x, colors: colorsFrom(color) }));
        }
      }
    } finally {
      setBusy(null);
    }
  };

  // The live preview, drawn by the same component as the home page.
  const view: HeroSlideView | null = useMemo(() => {
    if (!v.photo || !v.logo || !v.logoWhite) return null;
    const words = previewLang === "bn" ? { line1: v.bn.line1 || v.en.line1, line2: v.bn.line2 || v.en.line2, text: v.bn.text || v.en.text } : v.en;
    return {
      key: "preview",
      brand: v.brand || "Brand",
      role: v.role,
      name: v.personName || "Name",
      item: v.item,
      colors: v.colors,
      photo: { src: v.photo.url, width: v.photo.width, height: v.photo.height, position: photoPosition(v.photoFocus) },
      logo: { src: v.logo.url, width: v.logo.width, height: v.logo.height },
      logoWhite: { src: v.logoWhite.url, width: v.logoWhite.width, height: v.logoWhite.height },
      logoSize: logoSizes(v.logo.width, v.logo.height, v.item),
      badgeLogo: v.badgeLogo,
      copy: { line1: words.line1 || "…", line2: words.line2 || "…", text: words.text || "…" },
    };
  }, [v, previewLang]);

  const missing = [
    !v.photo && t("admin.hero.missing.photo"),
    !v.logo && t("admin.hero.missing.logo"),
    !v.brand.trim() && t("admin.hero.missing.brand"),
    !v.personName.trim() && t("admin.hero.missing.name"),
    (!v.en.line1.trim() || !v.en.line2.trim() || !v.en.text.trim()) && t("admin.hero.missing.words"),
  ].filter(Boolean) as string[];

  const save = () =>
    start(async () => {
      setError(null);
      const res = await saveHeroSlide({
        id: v.id,
        brand: v.brand,
        personName: v.personName,
        role: v.role,
        item: v.item,
        colors: v.colors,
        photoPath: v.photo!.path,
        photoFocus: v.photoFocus,
        logoPath: v.logo!.path,
        logoWhitePath: v.logoWhite!.path,
        badgeLogo: v.badgeLogo,
        line1En: v.en.line1,
        line2En: v.en.line2,
        textEn: v.en.text,
        line1Bn: v.bn.line1,
        line2Bn: v.bn.line2,
        textBn: v.bn.text,
        isActive: v.isActive,
      });
      if (!res.ok) return setError(t(res.error));
      toast(t("admin.hero.saved"));
      router.push("/admin/hero");
      router.refresh();
    });

  const textField = (lang: "en" | "bn", k: "line1" | "line2" | "text", max: number) => {
    const id = `hero-${lang}-${k}`;
    const value = v[lang][k];
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>{t(`admin.hero.words.${k}`)}</Label>
        {k === "text" ? (
          <textarea id={id} value={value} maxLength={max} rows={2} readOnly={readOnly} onChange={(e) => setText(lang, k, e.target.value)} className={cx(ADM_INPUT, "h-auto py-2.5")} />
        ) : (
          <input id={id} value={value} maxLength={max} readOnly={readOnly} onChange={(e) => setText(lang, k, e.target.value)} className={ADM_INPUT} lang={lang} />
        )}
        <span className="text-right text-xs text-muted tabular-nums">
          {value.length} / {max}
        </span>
      </div>
    );
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] xl:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        {/* 1. Pictures */}
        <AdmCard className="p-5">
          <CardTitle title={t("admin.hero.pictures.title")} sub={t("admin.hero.pictures.sub")} />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <PictureTile kind="photo" title={t("admin.hero.pictures.photo")} hint={t("admin.hero.pictures.photoHint")} picture={v.photo} busy={busy === "photo"} onPick={(f) => upload("photo", f)} />
            <PictureTile kind="logo" title={t("admin.hero.pictures.logo")} hint={t("admin.hero.pictures.logoHint")} picture={v.logo} busy={busy === "logo"} onPick={(f) => upload("logo", f)} />
            <PictureTile
              kind="logoWhite"
              title={t("admin.hero.pictures.white")}
              hint={t("admin.hero.pictures.whiteHint")}
              picture={v.logoWhite}
              dark={v.colors.main}
              busy={busy === "logoWhite"}
              onPick={(f) => upload("logoWhite", f)}
            />
          </div>
          {pictureError && (
            <div className="mt-3">
              <Alert tone="danger">{pictureError}</Alert>
            </div>
          )}
          <div className="mt-4 flex flex-col gap-1.5">
            <Label htmlFor="hero-focus">{t("admin.hero.pictures.focus")}</Label>
            <div className="flex items-center gap-3 text-[13px] text-muted">
              <span>{t("admin.hero.pictures.top")}</span>
              <input id="hero-focus" type="range" min={0} max={100} step={5} value={v.photoFocus} disabled={readOnly} onChange={(e) => set("photoFocus", Number(e.target.value))} className="flex-1 accent-primary" />
              <span>{t("admin.hero.pictures.bottom")}</span>
            </div>
          </div>
        </AdmCard>

        {/* 2. Who */}
        <AdmCard className="p-5">
          <CardTitle title={t("admin.hero.who.title")} sub={t("admin.hero.who.sub")} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hero-brand">{t("admin.hero.who.brand")}</Label>
              <input id="hero-brand" value={v.brand} maxLength={40} readOnly={readOnly} onChange={(e) => set("brand", e.target.value)} className={ADM_INPUT} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hero-name">{t("admin.hero.who.name")}</Label>
              <input id="hero-name" value={v.personName} maxLength={40} readOnly={readOnly} onChange={(e) => set("personName", e.target.value)} className={ADM_INPUT} />
            </div>
          </div>
          <fieldset className="mt-4 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 text-[14.5px] font-bold text-ink">{t("admin.hero.who.role")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(["designer", "client"] as const).map((r) => (
                <label key={r} className={cx("flex cursor-pointer items-start gap-3 rounded-[14px] border p-3.5", v.role === r ? "border-primary bg-adm-row" : "border-adm-line")}>
                  <input type="radio" name="hero-role" checked={v.role === r} disabled={readOnly} onChange={() => set("role", r)} className="mt-1 size-4 accent-primary" />
                  <span>
                    <strong className="block text-[15px]">{t(`admin.hero.who.roles.${r}`)}</strong>
                    <span className="text-[13px] text-muted">{t(r === "designer" ? "home.hero.captionDesigner" : "home.hero.captionClient", { brand: v.brand || "…" })}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="m-0 mt-3 rounded-[12px] bg-adm-sample-bg px-3.5 py-2.5 text-[13.5px] text-adm-sample">{t("admin.hero.who.permission")}</p>
        </AdmCard>

        {/* 3. Product and colours */}
        <AdmCard className="p-5">
          <CardTitle title={t("admin.hero.look.title")} sub={t("admin.hero.look.sub")} />
          <fieldset className="mt-4 border-0 p-0">
            <legend className="mb-2 text-[14.5px] font-bold text-ink">{t("admin.hero.look.item")}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {HERO_ITEMS.map((it) => (
                <label key={it} className={cx("flex cursor-pointer items-center gap-2.5 rounded-[14px] border p-3", v.item === it ? "border-primary bg-adm-row" : "border-adm-line")}>
                  <input type="radio" name="hero-item" checked={v.item === it} disabled={readOnly} onChange={() => set("item", it)} className="size-4 accent-primary" />
                  <span className="text-[15px] font-semibold">{t(`admin.hero.look.items.${it}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["main", "dark", "light", "badge"] as const).map((k) => (
              <div key={k} className="flex flex-col gap-1.5">
                <Label htmlFor={`hero-color-${k}`}>{t(`admin.hero.look.colors.${k}`)}</Label>
                <span className="flex h-12 items-center gap-2 rounded-[12px] border border-[#dcdee3] px-2">
                  <input id={`hero-color-${k}`} type="color" value={v.colors[k]} disabled={readOnly} onChange={(e) => setColor(k, e.target.value)} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0" />
                  <span className="font-mono text-[13px] text-muted">{v.colors[k]}</span>
                </span>
              </div>
            ))}
          </div>
          {suggested && !readOnly && (
            <button type="button" onClick={() => (setV((x) => ({ ...x, colors: colorsFrom(suggested) })), setColorsTouched(true))} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full px-1 text-[14px] font-bold text-primary hover:underline">
              <span className="size-4 rounded-full ring-1 ring-line" style={{ background: suggested }} />
              {t("admin.hero.look.useLogo")}
            </button>
          )}
          <fieldset className="mt-4 border-0 p-0">
            <legend className="mb-2 text-[14.5px] font-bold text-ink">{t("admin.hero.look.badge")}</legend>
            <div className="flex flex-wrap gap-2">
              {(["color", "white"] as const).map((b) => (
                <label key={b} className={cx("flex cursor-pointer items-center gap-2.5 rounded-[14px] border px-3.5 py-2.5", v.badgeLogo === b ? "border-primary bg-adm-row" : "border-adm-line")}>
                  <input type="radio" name="hero-badge" checked={v.badgeLogo === b} disabled={readOnly} onChange={() => set("badgeLogo", b)} className="size-4 accent-primary" />
                  <span className="text-[15px] font-semibold">{t(`admin.hero.look.badges.${b}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </AdmCard>

        {/* 4. Words */}
        <AdmCard className="p-5">
          <CardTitle title={t("admin.hero.words.title")} sub={t("admin.hero.words.sub")} />
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <p className="m-0 text-[13px] font-bold uppercase tracking-wide text-adm-soft">English</p>
              {textField("en", "line1", 40)}
              {textField("en", "line2", 40)}
              {textField("en", "text", 200)}
            </div>
            <div className="flex flex-col gap-3">
              <p className="m-0 text-[13px] font-bold uppercase tracking-wide text-adm-soft">বাংলা</p>
              {textField("bn", "line1", 40)}
              {textField("bn", "line2", 40)}
              {textField("bn", "text", 200)}
              <p className="m-0 text-[13px] text-muted">{t("admin.hero.words.bnHint")}</p>
            </div>
          </div>
        </AdmCard>

        {/* 5. Save */}
        {!readOnly && (
          <AdmCard className="flex flex-col gap-3 p-5">
            <AdmCheckbox label={t("admin.hero.active")} checked={v.isActive} onChange={(e) => set("isActive", e.target.checked)} />
            {missing.length > 0 && (
              <div className="rounded-[12px] bg-chip px-4 py-3 text-sm">
                <p className="m-0 font-semibold text-ink">{t("admin.hero.missing.title")}</p>
                <ul className="m-0 mt-1 list-inside list-disc text-muted">
                  {missing.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Link href="/admin/hero" className="inline-flex min-h-12 items-center justify-center rounded-[12px] px-5 font-bold text-muted hover:text-ink">
                {t("admin.hero.cancel")}
              </Link>
              <Button size="lg" onClick={save} loading={saving} disabled={missing.length > 0 || busy !== null}>
                {t("admin.hero.save")}
              </Button>
            </div>
          </AdmCard>
        )}
      </div>

      {/* Live preview */}
      <aside className="xl:sticky xl:top-24">
        <AdmCard className="p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="m-0 text-[17px] font-semibold">{t("admin.hero.preview")}</h2>
            <div className="flex rounded-[10px] bg-chip p-0.5 text-[13px] font-bold">
              {(["en", "bn"] as const).map((l) => (
                <button key={l} type="button" onClick={() => setPreviewLang(l)} aria-pressed={previewLang === l} className={cx("min-h-8 rounded-[8px] px-2.5", previewLang === l ? "bg-surface text-ink shadow-sm" : "text-muted")}>
                  {l === "en" ? "English" : "বাংলা"}
                </button>
              ))}
            </div>
          </div>
          {view ? (
            <div className="lc-landing mt-3 rounded-[16px] bg-white p-3">
              <div className="lc-show">
                <div className="lc-show-slide" data-on="">
                  <ShowcaseArt slide={view} first t={t} />
                </div>
              </div>
              <div className="lc-hero-copy mt-2 flex flex-col gap-2 [&_.lc-hero-title]:text-[30px]" data-on="">
                <SlideText slide={view} first={false} />
              </div>
            </div>
          ) : (
            <p className="m-0 mt-3 rounded-[12px] border border-dashed border-adm-line px-4 py-10 text-center text-sm text-muted">{t("admin.hero.previewEmpty")}</p>
          )}
        </AdmCard>
      </aside>
    </div>
  );
}
