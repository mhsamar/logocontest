"use client";

import { ShareOnFacebook } from "@/components/wizard/share-facebook";
import { setContestShare } from "@/lib/cards/actions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, TextAreaField, TextField } from "@/components/ui/field";
import { wizardVisitId } from "@/components/wizard/visit-id";
import { deleteFile, getFile } from "@/components/wizard/file-store";
import type { LocalFile, ServerFile } from "@/components/wizard/state";
import { Part } from "@/components/wizard/steps-brief";
import { FilesStep } from "@/components/wizard/steps-order";
import { normalizeEmail } from "@/lib/auth/identity";
import { toE164 } from "@/lib/phone";
import { isPersonName } from "@/lib/profile/name-rules";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { saveWizardLead } from "@/lib/wizard-tracking";
import { Stepper } from "@/components/ui/stepper";
import { PriceBar, PriceSidebar } from "@/components/wizard/price-summary";
import { AccountStep, PasswordStep } from "@/components/wizard/steps-account";
import { checkAccountDetails, createAccountAndDraft, prepareBriefUpload, previewPromo, recordBriefUpload, removeBriefFile, saveDraft, startCheckout } from "@/lib/contests/actions";
import type { PublicMethod } from "@/lib/payments/manual-rules";
import { MethodPicker, PromoField } from "@/components/payments/pay-bits";
import type { PromoPreview } from "@/components/wizard/step-review";
import { emptyBrief, noUpgrades, type Order, type UpgradeKey } from "@/lib/contests/brief";
import { calculatePrice, validateOrder, type PricingConfig } from "@/lib/contests/pricing";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { formatTaka } from "@/lib/money";
import { subscribeToPush } from "@/lib/push/client";
import { answerText } from "./service-answer";
import { FieldInput } from "./field-input";
import { cleanAnswers, LIMITS, sizeText, type Answers, type BriefField, type Lang, type ServiceDef } from "@/lib/services/types";

/** Add-ons a non-logo contest can take (the AI logo checker is for logos only). */
const SERVICE_UPGRADES: UpgradeKey[] = ["promoted", "highlight", "urgent", "private", "blind", "nda"];

/** Reference images wait in this browser (IndexedDB) until the contest is saved, then go up (as in the logo wizard). */
type Draft = { title: string; description: string; answers: Answers; prize: number; days: number; upgrades: Order["upgrades"]; contestId: string | null; localFiles?: LocalFile[]; shareFb?: boolean };
const BUCKET = "contest-files";
const NAME_MAX = 60;

export type ServiceWizardProps = {
  service: ServiceDef;
  user: { name: string; mobile: string } | null;
  pricing: PricingConfig;
  passwordMin: number;
  resume: { contestId: string; title: string; description: string; answers: Answers; order: Order; files?: ServerFile[] } | null;
  /** Reference images (owner, 2026-10-17: every contest has them, like the logo contest). */
  fileLimits: { maxFiles: number; maxMb: number };
  /** The money-back guarantee's number of designers while it is offered (owner, 2026-10-21), else null. */
  guarantee?: number | null;
  /** Designer Pro plan (owner, 2026-10-13): after saving, the optional "Invite Pro designers" step comes before paying. */
  inviteFirst?: boolean;
  /** Back from the invite step: open at "Review and pay". */
  startAtPay?: boolean;
  /** Payment methods switched on in Admin › Payments › Methods (owner, 2026-10-14). */
  methods: PublicMethod[];
  /** "Share my contest on Facebook" (owner, 2026-10-19), once migration 0067 has run; the resumed draft's choice. */
  shareSwitch?: boolean;
  resumeShare?: boolean;
};

/**
 * Contest wizard for a non-logo service (owner, 2026-10-13): the service's brief (a title, a short description and
 * the questions set in Admin → Services), prize and days, then review and pay. Saved on this device until the draft
 * is on the server. The same actions as the logo wizard save and check out. Owner, 2026-10-17: a visitor starts like
 * in the logo contest, with "Tell us about you" (real name, mobile and email, asked once), sets a password with the
 * prize, and every contest has reference images.
 */
export function ServiceWizard({ service, user, pricing, passwordMin, resume, inviteFirst, startAtPay, methods, fileLimits, shareSwitch, resumeShare, guarantee = null }: ServiceWizardProps) {
  // The prize is typed in taka, so its hints stay in taka; the rest is in the visitor's currency (owner, 2026-10-14).
  const { t, locale, price: money } = useI18n();
  const router = useRouter();
  const l = (x: Lang) => (locale === "bn" ? x.bn || x.en : x.en);
  const cfg = useMemo<PricingConfig>(() => ({ ...pricing, customMin: service.minPrize }), [pricing, service.minPrize]);
  const key = `lc-service-wizard-${service.slug}`;
  type Step = "you" | "brief" | "order" | "pay";
  const steps: Step[] = user ? ["brief", "order", "pay"] : ["you", "brief", "order", "pay"];

  const [d, setD] = useState<Draft>(() =>
    resume
      ? { title: resume.title, description: resume.description, answers: resume.answers, prize: resume.order.customPrize ?? service.defaultPrize, days: resume.order.durationDays, upgrades: resume.order.upgrades, contestId: resume.contestId, shareFb: resumeShare ?? true }
      : { title: "", description: "", answers: {}, prize: service.defaultPrize, days: Math.min(cfg.durationMax, Math.max(cfg.durationMin, service.defaultDays)), upgrades: noUpgrades(), contestId: null },
  );
  const [step, setStep] = useState<Step>(resume && startAtPay ? "pay" : user ? "brief" : "you");
  const [name, setName] = useState("");
  const [serverFiles, setServerFiles] = useState<ServerFile[]>(resume?.files ?? []);
  const [uploading, setUploading] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [mobile, setMobile] = useState("");
  // Any country, Bangladesh by default; and "on WhatsApp" (owner, 2026-10-14).
  const [country, setCountry] = useState("BD");
  const [whatsapp, setWhatsapp] = useState(false);
  const [email, setEmail] = useState("");
  const [accountError, setAccountError] = useState<{ field: "mobile" | "email"; message: string; taken: boolean } | null>(null);
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState<string | null>(methods.length === 1 ? methods[0].key : null);
  const [promo, setPromo] = useState<PromoPreview | null>(null);
  const [terms, setTerms] = useState(false);
  const [contentOk, setContentOk] = useState(false);

  // Keep the brief on this device while it isn't saved on the server yet.
  useEffect(() => {
    if (resume) return;
    try {
      const saved = sessionStorage.getItem(key);
      const kept = saved ? (JSON.parse(saved) as Partial<Draft>) : null;
      // A new contest starts blank (owner, 2026-10-14): a saved draft is opened from the dashboard instead.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is only readable after mount
      if (kept && !kept.contestId) setD((cur) => ({ ...cur, ...kept }));
    } catch {
      // ignore
    }
  }, [key, resume]);
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(d));
    } catch {
      // ignore
    }
  }, [d, key]);

  const order: Order = { package: "custom", customPrize: d.prize, durationDays: d.days, upgrades: { ...d.upgrades, logo_scan: false } };
  const orderError = validateOrder(order, cfg);
  const price = orderError ? null : calculatePrice(order, cfg);
  const { errors } = cleanAnswers(service, d.answers);
  const titleError = d.title.trim().length < LIMITS.title.min || d.title.trim().length > LIMITS.title.max;
  const descError = d.description.trim().length < LIMITS.description.min || d.description.trim().length > LIMITS.description.max;
  const briefValid = !titleError && !descError && Object.keys(errors).length === 0;
  const index = steps.indexOf(step);
  const brief = { ...emptyBrief(), brandName: d.title.trim(), businessDescription: d.description.trim(), businessType: "other" as const, noWebsite: true };
  const svc = { slug: service.slug, answers: d.answers };

  // Step 1 for a visitor (owner, 2026-10-17, as in the logo contest): real name, mobile and email, asked once.
  const personName = name.trim().replace(/\s+/g, " ");
  const nameOk = isPersonName(personName) && personName.length >= 2 && personName.length <= NAME_MAX;
  const aboutOk = nameOk && toE164(mobile, country) !== null && normalizeEmail(email) !== null;
  const localFiles = d.localFiles ?? [];
  const valid =
    step === "you"
      ? aboutOk
      : step === "brief"
        ? briefValid
        : step === "order"
          ? !orderError && (Boolean(user) || password.length >= passwordMin)
          : Boolean(method && terms && contentOk) && !uploading;
  const go = (s: Step) => {
    setError(null);
    setTouched(false);
    setStep(s);
    window.scrollTo({ top: 0 });
  };

  // The reference images go up once the contest is saved; false when one couldn't be sent (it stays to try again).
  const uploadFiles = useCallback(async (contestId: string, files: LocalFile[]): Promise<boolean> => {
    if (!files.length) return true;
    setUploading(true);
    const supabase = createBrowserSupabase();
    const left: LocalFile[] = [];
    for (const f of files) {
      const ok = await (async () => {
        const blob = await getFile(f.id);
        if (!blob) return true; // gone from this browser: nothing to send
        const prepared = await prepareBriefUpload({ contestId, name: f.name, type: f.type, size: f.size });
        if (!prepared.ok) return false;
        const up = await supabase.storage.from(BUCKET).uploadToSignedUrl(prepared.path, prepared.token, blob, { contentType: f.type });
        if (up.error) return false;
        const rec = await recordBriefUpload({ contestId, path: prepared.path, name: f.name, type: f.type, size: f.size, isCurrentLogo: false });
        if (!rec.ok) return false;
        setServerFiles((sf) => [...sf, { id: rec.id, name: f.name, type: f.type, isCurrentLogo: false }]);
        await deleteFile(f.id);
        return true;
      })().catch(() => false);
      if (!ok) left.push(f);
    }
    setD((cur) => ({ ...cur, localFiles: left }));
    setUploading(false);
    return left.length === 0;
  }, []);

  // After the contest is saved: send the reference images, then the invite step or payment.
  const afterSave = async (contestId: string) => {
    if (!(await uploadFiles(contestId, localFiles))) return setError(t("services.wizard.uploadFailed"));
    if (inviteFirst) return router.push(`/start/invite?draft=${contestId}`);
    go("pay");
  };

  const onNext = () => {
    if (!valid) return setTouched(true);
    if (step === "you") {
      return start(async () => {
        const res = await checkAccountDetails({ mobile, country, email });
        if (!res.ok) {
          const k = res.error.key;
          const phoneKeys = ["auth.errors.phoneTaken", "auth.errors.invalidPhone", "auth.errors.invalidPhoneIntl"];
          const isField = [...phoneKeys, "wizard.errors.emailTaken", "wizard.errors.email", "auth.errors.emailFake", "auth.errors.emailDisposable", "auth.errors.emailNoMail", "auth.errors.emailTypo"].includes(k);
          if (!isField) return setError(t(k, res.error.params));
          return setAccountError({ field: phoneKeys.includes(k) ? "mobile" : "email", message: t(k, res.error.params), taken: k === "auth.errors.phoneTaken" || k === "wizard.errors.emailTaken" });
        }
        // A new client's mobile for the team (owner, 2026-10-14), so they can help if the visitor doesn't finish.
        void saveWizardLead({ visitId: wizardVisitId(), mobile, country, brandName: d.title, service: service.slug });
        go("brief");
      });
    }
    if (step === "brief") {
      if (!user) void saveWizardLead({ visitId: wizardVisitId(), mobile, country, brandName: d.title, service: service.slug });
      return go("order");
    }
    if (step === "order") {
      if (user) {
        return start(async () => {
          const res = await saveDraft({ brief, order, contestId: d.contestId, service: svc });
          if (!res.ok) return setError(t(res.error.key, res.error.params));
          setD((cur) => ({ ...cur, contestId: res.contestId }));
          if (shareSwitch) void setContestShare({ contestId: res.contestId, on: d.shareFb !== false });
          await afterSave(res.contestId);
        });
      }
      // A new client: the account is made here, with the password set on this step (as in the logo contest).
      return start(async () => {
        const push = await subscribeToPush();
        const res = await createAccountAndDraft({ push, name: personName, mobile, country, whatsapp, email, password, brief, order, service: svc });
        if (!res.ok) {
          // The mobile or email was taken in the meantime: back to step 1 to change it.
          if (res.error.key === "auth.errors.phoneTaken" || res.error.key === "wizard.errors.emailTaken") {
            setAccountError({ field: res.error.key === "auth.errors.phoneTaken" ? "mobile" : "email", message: t(res.error.key), taken: true });
            return go("you");
          }
          return setError(t(res.error.key, res.error.params));
        }
        setD((cur) => ({ ...cur, contestId: res.contestId }));
        if (shareSwitch) void setContestShare({ contestId: res.contestId, on: d.shareFb !== false });
        setPassword("");
        router.refresh();
        await afterSave(res.contestId);
      });
    }
    return start(async () => {
      const res = await startCheckout({ contestId: d.contestId!, method: method!, promo: promoNow?.code ?? null, acceptedTerms: terms, acceptedContentRules: contentOk });
      if (res && !res.ok) setError(t(res.error.key, res.error.params));
    });
  };

  const setAnswer = (k: string, v: string | string[]) => setD((cur) => ({ ...cur, answers: { ...cur.answers, [k]: v } }));
  const fieldError = (f: BriefField) => (touched && errors[f.key] ? t(`services.wizard.errors.${errors[f.key]}`) : undefined);
  const heading = step === "brief" ? l(service.name) : step === "you" ? t("wizard.you.heading") : t(`services.wizard.steps.${step}`);
  const showPrice = step === "order" || step === "pay";
  // A promo code was checked against the total at that moment; after the order changes it no longer counts.
  const promoNow = promo && price && promo.total + promo.saves === price.total ? promo : null;

  return (
    <div className="flex flex-1 flex-col bg-canvas px-4 pb-10 pt-6 min-[721px]:px-6 min-[721px]:pt-10">
      <div className="mx-auto flex w-full max-w-[1100px] items-start gap-6">
        <div className="mx-auto w-full max-w-2xl min-[721px]:rounded-[28px] min-[721px]:border min-[721px]:border-line min-[721px]:bg-surface min-[721px]:p-10 min-[721px]:shadow-card">
          <div className="mb-8 flex items-center gap-3">
            <button
              type="button"
              onClick={() => (index <= 0 ? router.push("/start") : go(steps[index - 1]))}
              aria-label={t("wizard.frame.back")}
              className="flex size-11 shrink-0 items-center justify-center rounded-[14px] border border-line bg-surface text-ink transition-colors hover:bg-chip"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="flex-1">
              <Stepper current={index + 1} total={steps.length} label={t("common.stepOf", { current: index + 1, total: steps.length })} />
            </div>
          </div>

          <div key={step} className="animate-step-in">
            <span className="rounded-full bg-tint px-3 py-1 text-[13px] font-bold text-primary">{l(service.name)}</span>
            <h1 className="m-0 mt-3 text-[clamp(28px,3.4vw,40px)] font-semibold leading-[1.08] tracking-[-0.035em] text-ink">{heading}</h1>

            {/* 1. About you (visitors): real name, mobile and email, as in the logo contest (owner, 2026-10-17) */}
            {step === "you" && (
              <div className="mt-4 space-y-5">
                <p className="m-0 text-[17px] leading-relaxed text-muted">{t("wizard.you.helper")}</p>
                <TextField
                  mark
                  label={t("wizard.you.nameLabel")}
                  hint={t("wizard.you.nameHint")}
                  autoComplete="name"
                  value={name}
                  maxLength={NAME_MAX}
                  onChange={(e) => setName(e.target.value)}
                  error={touched && !nameOk ? t("wizard.you.nameError") : undefined}
                  autoFocus
                />
                <AccountStep
                  mobile={mobile}
                  email={email}
                  country={country}
                  onCountry={(iso) => {
                    setCountry(iso);
                    setAccountError(null);
                  }}
                  whatsapp={whatsapp}
                  onWhatsapp={setWhatsapp}
                  onMobile={(v) => {
                    setMobile(v);
                    setAccountError(null);
                  }}
                  onEmail={(v) => {
                    setEmail(v);
                    setAccountError(null);
                  }}
                  mobileError={accountError?.field === "mobile" ? accountError.message : undefined}
                  emailError={accountError?.field === "email" ? accountError.message : undefined}
                  taken={Boolean(accountError?.taken)}
                  autoFocus={false}
                />
              </div>
            )}

            {step === "brief" && (
              <div className="mt-4 space-y-5">
                {l(service.clientInstruction) && <p className="m-0 whitespace-pre-line text-[17px] leading-relaxed text-muted">{l(service.clientInstruction)}</p>}
                {sizeText(service) && <p className="m-0 rounded-[14px] bg-frame px-4 py-3 text-[14.5px] text-ink">{t("services.wizard.size", { size: sizeText(service) })}</p>}
                <TextField label={t("services.wizard.title")} hint={t("services.wizard.titleHint")} value={d.title} maxLength={LIMITS.title.max} onChange={(e) => setD({ ...d, title: e.target.value })} error={touched && titleError ? t("services.wizard.errors.title") : undefined} />
                <TextAreaField
                  label={t("services.wizard.description")}
                  hint={t("services.wizard.descriptionHint")}
                  value={d.description}
                  maxLength={LIMITS.description.max}
                  onChange={(e) => setD({ ...d, description: e.target.value })}
                  error={touched && descError ? t("services.wizard.errors.description", { min: LIMITS.description.min }) : undefined}
                  ideas={{
                    items: (["d1", "d2", "d3", "d4", "d5"] as const).map((k) => t(`services.wizard.suggest.${k}`, { service: l(service.name).toLocaleLowerCase(locale === "bn" ? "bn" : "en"), title: d.title.trim() || t("services.wizard.suggest.yourName") })).filter((x) => x.length <= LIMITS.description.max),
                    onPick: (text) => setD({ ...d, description: text }),
                  }}
                />
                {service.fields.map((f) => (
                  <div key={f.key} className={f.section ? "space-y-5 pt-4" : undefined}>
                    {f.section && <h2 className="m-0 border-t border-line pt-6 text-[20px] font-semibold leading-tight tracking-[-0.02em] text-ink">{l(f.section)}</h2>}
                    <FieldInput f={f} value={d.answers[f.key]} onChange={(v) => setAnswer(f.key, v)} error={fieldError(f)} l={l} />
                  </div>
                ))}
                {/* Reference images (owner, 2026-10-17): every contest, like the logo contest. Sent once the contest is saved. */}
                <div className="pt-4">
                  <Part title={t("services.wizard.references")} sub={t("services.wizard.referencesHint", { max: fileLimits.maxFiles, mb: fileLimits.maxMb })}>
                    <FilesStep
                      localFiles={localFiles}
                      serverFiles={serverFiles}
                      limits={fileLimits}
                      currentLogo={false}
                      onChange={(files) => setD((cur) => ({ ...cur, localFiles: files }))}
                      onRemoveServerFile={(id) =>
                        start(async () => {
                          if (d.contestId) await removeBriefFile({ contestId: d.contestId, fileId: id });
                          setServerFiles((f) => f.filter((x) => x.id !== id));
                        })
                      }
                    />
                  </Part>
                </div>
              </div>
            )}

            {step === "order" && (
              <div className="mt-6 space-y-7">
                <div>
                  <TextField
                    label={t("services.wizard.prize")}
                    hint={t("services.wizard.prizeHint", { min: formatTaka(service.minPrize, locale), step: formatTaka(cfg.customStep, locale) })}
                    type="number"
                    inputMode="numeric"
                    min={service.minPrize}
                    step={cfg.customStep}
                    value={String(d.prize)}
                    onChange={(e) => setD({ ...d, prize: Number(e.target.value) })}
                    error={orderError && orderError !== "duration" ? t(`services.wizard.errors.prize_${orderError}`, { min: formatTaka(service.minPrize, locale), step: formatTaka(cfg.customStep, locale) }) : undefined}
                  />
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {[service.defaultPrize, service.defaultPrize * 2, service.defaultPrize * 3].map((p) => (
                      <button key={p} type="button" aria-pressed={d.prize === p} onClick={() => setD({ ...d, prize: p })} className={cx("min-h-10 rounded-full px-4 text-[14.5px] font-bold ring-1", d.prize === p ? "bg-ink text-white ring-ink" : "bg-surface ring-line")}>
                        {money(p)}
                      </button>
                    ))}
                  </div>
                </div>
                <fieldset className="m-0 border-0 p-0">
                  <legend className="mb-2.5 text-base font-semibold text-ink">{t("services.wizard.days")}</legend>
                  <div className="flex flex-wrap gap-2">
                    {[...new Set([service.defaultDays, ...cfg.durationOptions])].filter((n) => n >= cfg.durationMin && n <= cfg.durationMax).sort((a, b) => a - b).map((n) => (
                      <button key={n} type="button" aria-pressed={d.days === n} onClick={() => setD({ ...d, days: n })} className={cx("min-h-10 rounded-full px-4 text-[14.5px] font-bold ring-1", d.days === n ? "bg-ink text-white ring-ink" : "bg-surface ring-line")}>
                        {t("wizard.c08.days", { days: n })}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="m-0 border-0 p-0">
                  <legend className="mb-2.5 text-base font-semibold text-ink">{t("services.wizard.addons")}</legend>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {SERVICE_UPGRADES.map((u) => (
                      <label key={u} className={cx("flex cursor-pointer items-start gap-3 rounded-[14px] p-3.5 ring-1", d.upgrades[u] ? "bg-tint ring-primary" : "bg-surface ring-line")}>
                        <input type="checkbox" checked={d.upgrades[u]} onChange={(e) => setD({ ...d, upgrades: { ...d.upgrades, [u]: e.target.checked } })} className="mt-1 size-[18px] accent-[#8B0000]" />
                        <span className="flex flex-col">
                          <strong className="text-[15px]">
                            {t(`wizard.upgrades.${u}.name`)} · {money(cfg.upgradePrices[u])}
                          </strong>
                          <span className="text-[13.5px] text-muted">{t(`wizard.upgrades.${u}.desc`)}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {shareSwitch && <ShareOnFacebook on={d.shareFb !== false} isPrivate={d.upgrades.private || d.upgrades.nda} onChange={(on) => setD({ ...d, shareFb: on })} />}
                {/* A new client sets a password with the prize (as in the logo contest); the account is made on Next. */}
                {!user && (
                  <Part title={t("wizard.c10.heading")} sub={t("wizard.c10.helper")}>
                    <PasswordStep password={password} onPassword={setPassword} min={passwordMin} autoFocus={false} />
                  </Part>
                )}
              </div>
            )}

            {step === "pay" && price && (
              <div className="mt-6 space-y-5">
                <dl className="m-0 rounded-[20px] border border-line bg-surface p-5 text-sm">
                  <div className="flex justify-between gap-3 py-1">
                    <dt className="text-muted">{t("services.wizard.title")}</dt>
                    <dd className="m-0 text-right font-semibold text-ink">{d.title}</dd>
                  </div>
                  {service.fields.filter((f) => d.answers[f.key]?.length).map((f) => (
                    <div key={f.key} className="flex justify-between gap-3 py-1">
                      <dt className="text-muted">{l(f.label)}</dt>
                      <dd className="m-0 line-clamp-2 text-right text-ink">{answerText(f, d.answers[f.key], l)}</dd>
                    </div>
                  ))}
                  <div className="mt-2 flex justify-between border-t border-line pt-3 font-semibold text-ink">
                    <dt>{t("wizard.summary.total")}</dt>
                    <dd className="m-0 text-lg tabular-nums">
                      {promoNow && <s className="mr-2 text-sm font-medium text-muted">{money(price.total)}</s>}
                      {money(promoNow ? promoNow.total : price.total)}
                    </dd>
                  </div>
                  <div className="mt-3 flex flex-col">
                    <PromoField
                      applied={promoNow ? { code: promoNow.code, line: t("pay.promo.feeApplied", { code: promoNow.code, fee: promoNow.fee, normal: promoNow.normal }), saves: t("pay.promo.saves", { amount: money(promoNow.saves) }) } : null}
                      apply={async (code) => {
                        const res = await previewPromo({ contestId: d.contestId!, code });
                        if (!res.ok) return { ok: false, error: t(res.error.key, res.error.params) };
                        setPromo(res);
                        return { ok: true };
                      }}
                      onRemove={() => setPromo(null)}
                    />
                  </div>
                </dl>
                <MethodPicker methods={methods} value={method} onChange={setMethod} title={t("wizard.c11.methodTitle")} />
                <div className="rounded-[16px] bg-frame p-4 text-[14px] text-ink">
                  <p className="m-0 font-semibold">{t("wizard.contentRules.title")}</p>
                  <ul className="m-0 mt-1.5 space-y-1 pl-5">
                    <li>{t("wizard.contentRules.r1")}</li>
                    <li>{t("wizard.contentRules.r2")}</li>
                    <li className="font-semibold text-[#A3121B]">{t("wizard.contentRules.r3")}</li>
                  </ul>
                  <div className="mt-2.5">
                    <Checkbox checked={contentOk} onChange={(e) => setContentOk(e.target.checked)} label={t("wizard.contentRules.agree")} />
                  </div>
                </div>
                <Checkbox
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                  label={
                    <>
                      {t("wizard.c11.termsBefore")}{" "}
                      <Link href="/legal/terms" target="_blank" className="font-semibold text-primary underline">
                        {t("footer.terms")}
                      </Link>{" "}
                      {t("wizard.c11.termsAfter")}{" "}
                      <Link href="/legal/payment-refund" target="_blank" className="font-semibold text-primary underline">
                        {t("footer.refund")}
                      </Link>{" "}
                      {guarantee ? t("wizard.c11.termsEndGuarantee", { n: guarantee }) : t("wizard.c11.termsEnd")}
                    </>
                  }
                />
              </div>
            )}
          </div>

          {error && (
            <div className="mt-6">
              <Alert tone="danger">{error}</Alert>
            </div>
          )}

          <div className="sticky bottom-0 -mx-4 mt-8 border-t border-line bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur min-[721px]:static min-[721px]:mx-0 min-[721px]:border-0 min-[721px]:bg-transparent min-[721px]:px-0 min-[721px]:pt-0">
            {showPrice && <PriceBar price={price} feePercent={price?.feePercent ?? cfg.serviceFeePercent} />}
            <Button size="lg" block onClick={onNext} loading={busy}>
              {step === "pay" ? t("services.wizard.pay") : t("services.wizard.next")}
            </Button>
          </div>
        </div>
        {showPrice && <PriceSidebar price={price} feePercent={price?.feePercent ?? cfg.serviceFeePercent} />}
      </div>
    </div>
  );
}
