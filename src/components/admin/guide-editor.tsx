/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "@/components/ui/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { GuideBody } from "@/components/guides/guide-body";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { pictureUrl, SITE_BUCKET } from "@/lib/content/pictures";
import { cx } from "@/lib/cx";
import { deleteGuide, prepareGuidePicture, saveGuide } from "@/lib/guides/actions";
import { bnReady, GUIDE_CATEGORIES, guideImageOk, guideProblems, LIMITS, MIN_WORDS, PROBLEM_TEXT, readingMinutes, slugify, wordCount, type GuideCategory } from "@/lib/guides/rules";
import { COMPRESS, compressImage, isCompressible } from "@/lib/images/compress";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { AdminAction } from "./admin-action";
import { AdmCard, AdmCheckbox, ADM_INPUT, CardTitle } from "./ui";
import { useReadOnly } from "./read-only";

/** What the editor starts from: a saved guide, or an empty new one. */
export type GuideEditorValue = {
  id: string | null;
  slug: string;
  category: GuideCategory;
  titleEn: string;
  titleBn: string;
  summaryEn: string;
  summaryBn: string;
  bodyEn: string;
  bodyBn: string;
  coverPath: string | null;
  status: "draft" | "published";
  inFooter: boolean;
};


const Label = ({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) => (
  <label htmlFor={htmlFor} className="text-[14.5px] font-bold text-ink">
    {children}
  </label>
);

const toolBtn = "inline-flex min-h-9 min-w-9 items-center justify-center rounded-[9px] border border-adm-line bg-surface px-2.5 text-[13.5px] font-bold text-ink hover:bg-adm-row disabled:opacity-40";

/** Uploads one picture for a guide and gives back its stored path. */
async function uploadPicture(picked: File): Promise<{ ok: true; path: string } | { ok: false; error: MessageKey }> {
  const file = isCompressible(picked) ? await compressImage(picked, { ...COMPRESS.site, maxSide: 1800, out: ["image/webp", "image/jpeg"] }) : picked;
  const prepared = await prepareGuidePicture({ type: file.type, size: file.size });
  if (!prepared.ok) return prepared;
  const { error } = await createBrowserSupabase().storage.from(SITE_BUCKET).uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
  return error ? { ok: false, error: "admin.guides.errors.upload" } : { ok: true, path: prepared.path };
}

/** Admin › Guides: write a guide in English (and Bangla), see it as readers will, and publish it. */
export function GuideEditor({ initial }: { initial: GuideEditorValue }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const [previewLang, setPreviewLang] = useState<"en" | "bn">("en");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"cover" | "en" | "bn" | null>(null);
  const [saving, start] = useTransition();
  const coverInput = useRef<HTMLInputElement>(null);
  const bodyPicInput = useRef<HTMLInputElement>(null);
  const bodyFor = useRef<"en" | "bn">("en");
  const areas = { en: useRef<HTMLTextAreaElement>(null), bn: useRef<HTMLTextAreaElement>(null) };

  const set = <K extends keyof GuideEditorValue>(k: K, value: GuideEditorValue[K]) => setV((x) => ({ ...x, [k]: value }));
  const imageOk = useMemo(() => guideImageOk(process.env.NEXT_PUBLIC_SUPABASE_URL), []);
  const input = (status: "draft" | "published") => ({ ...v, status });
  const toPublish = guideProblems(input("published"), imageOk);
  const forDraft = guideProblems(input("draft"), imageOk);
  const wordsEn = wordCount(v.bodyEn);
  const wordsBn = wordCount(v.bodyBn);
  const published = initial.status === "published";
  const bangla = bnReady(v);

  const setTitleEn = (text: string) => setV((x) => ({ ...x, titleEn: text, slug: slugTouched ? x.slug : slugify(text) }));

  /** Changes the selected text in a body box and puts the cursor after the change. */
  const edit = (lang: "en" | "bn", change: (selected: string, before: string) => { text: string; select?: [number, number] }) => {
    const el = areas[lang].current;
    const body = lang === "en" ? v.bodyEn : v.bodyBn;
    const from = el?.selectionStart ?? body.length;
    const to = el?.selectionEnd ?? body.length;
    const out = change(body.slice(from, to), body.slice(0, from));
    const next = body.slice(0, from) + out.text + body.slice(to);
    set(lang === "en" ? "bodyEn" : "bodyBn", next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const [a, b] = out.select ?? [out.text.length, out.text.length];
      el.setSelectionRange(from + a, from + b);
    });
  };
  const lineStart = (before: string) => (before === "" || before.endsWith("\n") ? "" : "\n");
  const block = (lang: "en" | "bn", mark: string, fallback: string) =>
    edit(lang, (sel, before) => {
      const pre = lineStart(before);
      const lines = (sel || fallback).split("\n").map((l, i) => `${mark === "1." ? `${i + 1}.` : mark} ${l.replace(/^(#{2,3}|[-*]|\d+[.)])\s+/, "")}`);
      const text = `${pre}${lines.join("\n")}\n`;
      return { text, select: sel ? undefined : [pre.length + mark.length + 1, pre.length + mark.length + 1 + fallback.length] };
    });
  const bold = (lang: "en" | "bn") => edit(lang, (sel) => ({ text: `**${sel || t("admin.guides.tools.boldText")}**`, select: sel ? undefined : [2, 2 + t("admin.guides.tools.boldText").length] }));
  const link = (lang: "en" | "bn") => {
    const href = window.prompt(t("admin.guides.tools.linkPrompt"), "/");
    if (!href) return;
    edit(lang, (sel) => ({ text: `[${sel || t("admin.guides.tools.linkText")}](${href.trim()})` }));
  };

  const pickBodyPicture = (lang: "en" | "bn") => {
    bodyFor.current = lang;
    bodyPicInput.current?.click();
  };
  const addBodyPicture = async (file: File) => {
    const lang = bodyFor.current;
    setUploading(lang);
    setError(null);
    const res = await uploadPicture(file);
    setUploading(null);
    if (!res.ok) return setError(t(res.error));
    edit(lang, (_sel, before) => {
      const alt = t("admin.guides.tools.pictureAlt");
      const pre = before === "" ? "" : before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
      return { text: `${pre}![${alt}](${pictureUrl(res.path)})\n\n`, select: [pre.length + 2, pre.length + 2 + alt.length] };
    });
  };
  const setCover = async (file: File) => {
    setUploading("cover");
    setError(null);
    const res = await uploadPicture(file);
    setUploading(null);
    if (!res.ok) return setError(t(res.error));
    set("coverPath", res.path);
  };

  const save = (status: "draft" | "published") =>
    start(async () => {
      setError(null);
      const res = await saveGuide({ ...v, status });
      if (!res.ok) return setError(t(res.error, { min: MIN_WORDS }));
      toast(t(status === "published" ? (published ? "admin.guides.savedLive" : "admin.guides.published") : "admin.guides.savedDraft"));
      setV((x) => ({ ...x, status, slug: res.slug }));
      if (!v.id) router.replace(`/admin/guides/${res.id}`);
      router.refresh();
    });

  const field = (id: string, label: string, value: string, max: number, onChange: (s: string) => void, opts: { area?: boolean; lang?: "en" | "bn"; hint?: string } = {}) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {opts.area ? (
        <textarea id={id} value={value} maxLength={max} rows={3} readOnly={readOnly} lang={opts.lang} onChange={(e) => onChange(e.target.value)} className={cx(ADM_INPUT, "h-auto py-2.5")} />
      ) : (
        <input id={id} value={value} maxLength={max} readOnly={readOnly} lang={opts.lang} onChange={(e) => onChange(e.target.value)} className={ADM_INPUT} />
      )}
      <span className="flex justify-between gap-3 text-xs text-muted">
        <span>{opts.hint}</span>
        <span className="tabular-nums">
          {value.length} / {max}
        </span>
      </span>
    </div>
  );

  const bodyBox = (lang: "en" | "bn") => {
    const value = lang === "en" ? v.bodyEn : v.bodyBn;
    const words = lang === "en" ? wordsEn : wordsBn;
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor={`guide-body-${lang}`}>{t(lang === "en" ? "admin.guides.body.en" : "admin.guides.body.bn")}</Label>
          {!readOnly && (
            <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label={t("admin.guides.tools.label")}>
              <button type="button" className={toolBtn} onClick={() => block(lang, "##", t("admin.guides.tools.headingText"))} title={t("admin.guides.tools.h2")}>
                H2
              </button>
              <button type="button" className={toolBtn} onClick={() => block(lang, "###", t("admin.guides.tools.headingText"))} title={t("admin.guides.tools.h3")}>
                H3
              </button>
              <button type="button" className={toolBtn} onClick={() => bold(lang)} title={t("admin.guides.tools.bold")}>
                <strong>B</strong>
              </button>
              <button type="button" className={toolBtn} onClick={() => block(lang, "-", t("admin.guides.tools.pointText"))} title={t("admin.guides.tools.list")}>
                • —
              </button>
              <button type="button" className={toolBtn} onClick={() => block(lang, "1.", t("admin.guides.tools.pointText"))} title={t("admin.guides.tools.steps")}>
                1. —
              </button>
              <button type="button" className={toolBtn} onClick={() => link(lang)} title={t("admin.guides.tools.link")}>
                {t("admin.guides.tools.linkShort")}
              </button>
              <button type="button" className={toolBtn} disabled={uploading !== null} onClick={() => pickBodyPicture(lang)} title={t("admin.guides.tools.picture")}>
                {uploading === lang ? "…" : t("admin.guides.tools.pictureShort")}
              </button>
            </div>
          )}
        </div>
        <textarea
          ref={areas[lang]}
          id={`guide-body-${lang}`}
          lang={lang}
          value={value}
          maxLength={LIMITS.body}
          rows={lang === "en" ? 22 : 14}
          readOnly={readOnly}
          onChange={(e) => set(lang === "en" ? "bodyEn" : "bodyBn", e.target.value)}
          className={cx(ADM_INPUT, "h-auto py-3 font-mono text-[14.5px] leading-relaxed")}
        />
        <span className="flex flex-wrap justify-between gap-3 text-xs text-muted">
          <span className={cx(lang === "en" && words < MIN_WORDS && "font-bold text-adm-warn")}>
            {lang === "en" ? t("admin.guides.body.wordsEn", { n: words, min: MIN_WORDS, minutes: readingMinutes(value) }) : t("admin.guides.body.wordsBn", { n: words })}
          </span>
          <span className="tabular-nums">
            {value.length} / {LIMITS.body}
          </span>
        </span>
      </div>
    );
  };

  // What Bangla readers will see: the Bangla version once it is complete, the English one until then.
  const pv = previewLang === "bn" && bangla ? { title: v.titleBn, summary: v.summaryBn, body: v.bodyBn } : { title: v.titleEn, summary: v.summaryEn, body: v.bodyEn };
  const cover = pictureUrl(v.coverPath);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] xl:items-start">
      <input
        ref={bodyPicInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void addBodyPicture(file);
        }}
      />
      <div className="flex min-w-0 flex-col gap-4">
        {/* 1. Title, address and group */}
        <AdmCard className="p-5">
          <CardTitle title={t("admin.guides.basics.title")} sub={t("admin.guides.basics.sub")} />
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {field("guide-title-en", t("admin.guides.basics.titleEn"), v.titleEn, LIMITS.title, setTitleEn, { lang: "en", hint: t("admin.guides.basics.titleHint") })}
            {field("guide-title-bn", t("admin.guides.basics.titleBn"), v.titleBn, LIMITS.title, (s) => set("titleBn", s), { lang: "bn" })}
          </div>
          <div className="mt-4 flex flex-col gap-1.5">
            <Label htmlFor="guide-slug">{t("admin.guides.basics.slug")}</Label>
            <div className="flex items-center overflow-hidden rounded-[12px] border border-[#dcdee3] focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-primary">
              <span className="shrink-0 bg-chip px-3 py-3 text-[14px] text-muted">logocontest.bd/guides/</span>
              <input
                id="guide-slug"
                value={v.slug}
                maxLength={LIMITS.slug}
                readOnly={readOnly}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-"));
                }}
                onBlur={() => set("slug", v.slug.replace(/^-+|-+$/g, ""))}
                className="h-12 min-w-0 flex-1 bg-surface px-2 text-[15.5px] font-medium text-ink outline-none"
              />
            </div>
            <span className="text-xs text-muted">{t(published ? "admin.guides.basics.slugLive" : "admin.guides.basics.slugHint")}</span>
          </div>
          <fieldset className="mt-4 border-0 p-0">
            <legend className="mb-2 text-[14.5px] font-bold text-ink">{t("admin.guides.basics.category")}</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {GUIDE_CATEGORIES.map((c) => (
                <label key={c} className={cx("flex cursor-pointer items-center gap-2.5 rounded-[14px] border p-3", v.category === c ? "border-primary bg-adm-row" : "border-adm-line")}>
                  <input type="radio" name="guide-category" checked={v.category === c} disabled={readOnly} onChange={() => set("category", c)} className="size-4 accent-primary" />
                  <span className="text-[15px] font-semibold">{t(`guides.categories.${c}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </AdmCard>

        {/* 2. Summary and cover */}
        <AdmCard className="p-5">
          <CardTitle title={t("admin.guides.summary.title")} sub={t("admin.guides.summary.sub")} />
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {field("guide-summary-en", t("admin.guides.summary.en"), v.summaryEn, LIMITS.summary, (s) => set("summaryEn", s), { area: true, lang: "en", hint: t("admin.guides.summary.hint") })}
            {field("guide-summary-bn", t("admin.guides.summary.bn"), v.summaryBn, LIMITS.summary, (s) => set("summaryBn", s), { area: true, lang: "bn" })}
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="aspect-[16/9] w-full shrink-0 overflow-hidden rounded-[14px] border border-adm-line bg-chip sm:w-56">
              {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center px-3 text-center text-sm text-muted">{t("admin.guides.cover.none")}</span>}
            </div>
            <div className="flex flex-col gap-2">
              <p className="m-0 font-semibold text-ink">{t("admin.guides.cover.title")}</p>
              <p className="m-0 text-[13.5px] text-muted">{t("admin.guides.cover.hint")}</p>
              {!readOnly && (
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={coverInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    tabIndex={-1}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void setCover(file);
                    }}
                  />
                  <Button variant="secondary" loading={uploading === "cover"} disabled={uploading !== null} onClick={() => coverInput.current?.click()}>
                    {t(v.coverPath ? "admin.guides.cover.replace" : "admin.guides.cover.upload")}
                  </Button>
                  {v.coverPath && (
                    <Button variant="ghost" onClick={() => set("coverPath", null)}>
                      {t("admin.guides.cover.remove")}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </AdmCard>

        {/* 3. The text */}
        <AdmCard className="p-5">
          <CardTitle title={t("admin.guides.body.title")} sub={t("admin.guides.body.sub")} />
          <details className="mt-3 rounded-[12px] bg-chip px-4 py-2.5 text-[13.5px]">
            <summary className="cursor-pointer font-bold text-ink">{t("admin.guides.help.marks")}</summary>
            <pre className="m-0 mt-2 whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-ink">{t("admin.guides.help.marksText")}</pre>
          </details>
          <div className="mt-4 flex flex-col gap-6">
            {bodyBox("en")}
            {bodyBox("bn")}
            <p className={cx("m-0 rounded-[12px] px-3.5 py-2.5 text-[13.5px]", bangla ? "bg-adm-good-bg text-adm-good" : "bg-adm-sample-bg text-adm-sample")}>
              {t(bangla ? "admin.guides.body.bnReady" : "admin.guides.body.bnNotReady", { min: MIN_WORDS })}
            </p>
          </div>
        </AdmCard>

        {/* 4. Publish */}
        {!readOnly && (
          <AdmCard className="flex flex-col gap-3 p-5">
            <AdmCheckbox label={t("admin.guides.inFooter")} checked={v.inFooter} onChange={(e) => set("inFooter", e.target.checked)} />
            {toPublish.length > 0 && (
              <div className="rounded-[12px] bg-chip px-4 py-3 text-sm">
                <p className="m-0 font-semibold text-ink">{t("admin.guides.missing")}</p>
                <ul className="m-0 mt-1 list-inside list-disc text-muted">
                  {toPublish.map((p) => (
                    <li key={p}>{t(PROBLEM_TEXT[p], { min: MIN_WORDS })}</li>
                  ))}
                </ul>
              </div>
            )}
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              {initial.id && (
                <span className="sm:mr-auto">
                  <AdminAction
                    label={t("admin.guides.delete")}
                    title={t("admin.guides.deleteTitle", { title: initial.titleEn })}
                    body={t("admin.guides.deleteBody")}
                    confirm={t("admin.guides.deleteConfirm")}
                    done={t("admin.guides.deleted")}
                    tone="ghost"
                    fields={[]}
                    run={async () => {
                      const res = await deleteGuide(initial.id!);
                      if (res.ok) router.push("/admin/guides");
                      return res;
                    }}
                  />
                </span>
              )}
              <Link href="/admin/guides" className="inline-flex min-h-12 items-center justify-center rounded-[12px] px-5 font-bold text-muted hover:text-ink">
                {t("admin.guides.cancel")}
              </Link>
              {published ? (
                <>
                  <Button size="lg" variant="secondary" onClick={() => save("draft")} loading={saving} disabled={forDraft.length > 0 || uploading !== null}>
                    {t("admin.guides.unpublish")}
                  </Button>
                  <Button size="lg" onClick={() => save("published")} loading={saving} disabled={toPublish.length > 0 || uploading !== null}>
                    {t("admin.guides.saveLive")}
                  </Button>
                </>
              ) : (
                <>
                  <Button size="lg" variant="secondary" onClick={() => save("draft")} loading={saving} disabled={forDraft.length > 0 || uploading !== null}>
                    {t("admin.guides.saveDraft")}
                  </Button>
                  <Button size="lg" onClick={() => save("published")} loading={saving} disabled={toPublish.length > 0 || uploading !== null}>
                    {t("admin.guides.publish")}
                  </Button>
                </>
              )}
            </div>
          </AdmCard>
        )}
      </div>

      {/* Preview, as readers will see it */}
      <aside className="xl:sticky xl:top-24">
        <AdmCard className="p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="m-0 text-[17px] font-semibold">{t("admin.guides.preview")}</h2>
            <div className="flex rounded-[10px] bg-chip p-0.5 text-[13px] font-bold">
              {(["en", "bn"] as const).map((l) => (
                <button key={l} type="button" onClick={() => setPreviewLang(l)} aria-pressed={previewLang === l} className={cx("min-h-8 rounded-[8px] px-2.5", previewLang === l ? "bg-surface text-ink shadow-sm" : "text-muted")}>
                  {l === "en" ? "English" : "বাংলা"}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 max-h-[75vh] overflow-y-auto rounded-[16px] border border-adm-line bg-white">
            {cover && <img src={cover} alt="" className="aspect-[16/9] w-full object-cover" />}
            <div className="flex flex-col gap-3 p-5">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-primary">{t(`guides.categories.${v.category}`)}</span>
              <p className="m-0 text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink">{pv.title || "…"}</p>
              {pv.summary && <p className="m-0 text-[15px] leading-relaxed text-muted">{pv.summary}</p>}
              {pv.body ? <GuideBody body={pv.body} /> : <p className="m-0 rounded-[12px] border border-dashed border-adm-line px-4 py-10 text-center text-sm text-muted">{t("admin.guides.previewEmpty")}</p>}
            </div>
          </div>
          {published && (
            <a href={`/guides/${initial.slug}`} target="_blank" rel="noopener" className="mt-3 inline-flex min-h-10 items-center font-bold text-primary hover:underline">
              {t("admin.guides.openLive")}
            </a>
          )}
        </AdmCard>
      </aside>
    </div>
  );
}
