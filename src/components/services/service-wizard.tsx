"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, TextAreaField, TextField } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import { PriceBar, PriceSidebar } from "@/components/wizard/price-summary";
import { AccountStep, PasswordStep } from "@/components/wizard/steps-account";
import { checkAccountDetails, createAccountAndDraft, saveDraft, startCheckout } from "@/lib/contests/actions";
import { emptyBrief, noUpgrades, type Order, type UpgradeKey } from "@/lib/contests/brief";
import { calculatePrice, validateOrder, type PricingConfig } from "@/lib/contests/pricing";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { formatTaka } from "@/lib/money";
import { subscribeToPush } from "@/lib/push/client";
import { answerText } from "./service-answer";
import { cleanAnswers, LIMITS, sizeText, type Answers, type BriefField, type Lang, type ServiceDef } from "@/lib/services/types";

/** Add-ons a non-logo contest can take (the AI logo checker is for logos only). */
const SERVICE_UPGRADES: UpgradeKey[] = ["promoted", "highlight", "urgent", "private", "blind", "nda"];

type Draft = { title: string; description: string; answers: Answers; prize: number; days: number; upgrades: Order["upgrades"]; contestId: string | null };

export type ServiceWizardProps = {
  service: ServiceDef;
  user: { name: string; mobile: string } | null;
  pricing: PricingConfig;
  passwordMin: number;
  resume: { contestId: string; title: string; description: string; answers: Answers; order: Order } | null;
};

/**
 * Contest wizard for a non-logo service (owner, 2026-10-13): the service's brief (a title, a short description and
 * the questions set in Admin → Services), prize and days, an account for new clients, then review and pay. Saved on
 * this device until the draft is on the server. The same actions as the logo wizard save and check out.
 */
export function ServiceWizard({ service, user, pricing, passwordMin, resume }: ServiceWizardProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const l = (x: Lang) => (locale === "bn" ? x.bn || x.en : x.en);
  const cfg = useMemo<PricingConfig>(() => ({ ...pricing, customMin: service.minPrize }), [pricing, service.minPrize]);
  const key = `lc-service-wizard-${service.slug}`;
  type Step = "brief" | "order" | "account" | "password" | "pay";
  const steps: Step[] = user ? ["brief", "order", "pay"] : ["brief", "order", "account", "password", "pay"];

  const [d, setD] = useState<Draft>(() =>
    resume
      ? { title: resume.title, description: resume.description, answers: resume.answers, prize: resume.order.customPrize ?? service.defaultPrize, days: resume.order.durationDays, upgrades: resume.order.upgrades, contestId: resume.contestId }
      : { title: "", description: "", answers: {}, prize: service.defaultPrize, days: Math.min(cfg.durationMax, Math.max(cfg.durationMin, service.defaultDays)), upgrades: noUpgrades(), contestId: null },
  );
  const [step, setStep] = useState<Step>("brief");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [accountError, setAccountError] = useState<{ field: "mobile" | "email"; message: string; taken: boolean } | null>(null);
  const [password, setPassword] = useState("");
  const [name, setName] = useState(user?.name ?? "");
  const [method, setMethod] = useState<"bkash" | "card" | null>(null);
  const [terms, setTerms] = useState(false);
  const [contentOk, setContentOk] = useState(false);

  // Keep the brief on this device while it isn't saved on the server yet.
  useEffect(() => {
    if (resume) return;
    try {
      const saved = sessionStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is only readable after mount
      if (saved) setD((cur) => ({ ...cur, ...(JSON.parse(saved) as Partial<Draft>) }));
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

  const valid =
    step === "brief" ? briefValid : step === "order" ? !orderError : step === "account" ? Boolean(mobile && email) : step === "password" ? password.length >= passwordMin : Boolean(method && terms && contentOk && name.trim().length >= 2);
  const go = (s: Step) => {
    setError(null);
    setTouched(false);
    setStep(s);
    window.scrollTo({ top: 0 });
  };

  const onNext = () => {
    if (!valid) return setTouched(true);
    if (step === "brief") return go("order");
    if (step === "order") {
      if (!user) return go("account");
      return start(async () => {
        const res = await saveDraft({ brief, order, contestId: d.contestId, service: svc });
        if (!res.ok) return setError(t(res.error.key, res.error.params));
        setD((cur) => ({ ...cur, contestId: res.contestId }));
        go("pay");
      });
    }
    if (step === "account") {
      return start(async () => {
        const res = await checkAccountDetails({ mobile, email });
        if (!res.ok) {
          const k = res.error.key;
          const isField = ["auth.errors.phoneTaken", "auth.errors.invalidPhone", "wizard.errors.emailTaken", "wizard.errors.email"].includes(k);
          if (!isField) return setError(t(k, res.error.params));
          return setAccountError({ field: k === "auth.errors.phoneTaken" || k === "auth.errors.invalidPhone" ? "mobile" : "email", message: t(k, res.error.params), taken: k === "auth.errors.phoneTaken" || k === "wizard.errors.emailTaken" });
        }
        go("password");
      });
    }
    if (step === "password") {
      return start(async () => {
        const push = await subscribeToPush();
        const res = await createAccountAndDraft({ push, mobile, email, password, brief, order, service: svc });
        if (!res.ok) return setError(t(res.error.key, res.error.params));
        setD((cur) => ({ ...cur, contestId: res.contestId }));
        setPassword("");
        router.refresh();
        go("pay");
      });
    }
    return start(async () => {
      const res = await startCheckout({ contestId: d.contestId!, method: method!, name: name.trim(), acceptedTerms: terms, acceptedContentRules: contentOk });
      if (res && !res.ok) setError(t(res.error.key, res.error.params));
    });
  };

  const setAnswer = (k: string, v: string | string[]) => setD((cur) => ({ ...cur, answers: { ...cur.answers, [k]: v } }));
  const fieldError = (f: BriefField) => (touched && errors[f.key] ? t(`services.wizard.errors.${errors[f.key]}`) : undefined);
  const heading = step === "brief" ? l(service.name) : t(`services.wizard.steps.${step}`);
  const showPrice = step === "order" || step === "pay";

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

            {step === "brief" && (
              <div className="mt-4 space-y-5">
                {l(service.clientInstruction) && <p className="m-0 whitespace-pre-line text-[17px] leading-relaxed text-muted">{l(service.clientInstruction)}</p>}
                {sizeText(service) && <p className="m-0 rounded-[14px] bg-frame px-4 py-3 text-[14.5px] text-ink">{t("services.wizard.size", { size: sizeText(service) })}</p>}
                <TextField label={t("services.wizard.title")} hint={t("services.wizard.titleHint")} value={d.title} maxLength={LIMITS.title.max} onChange={(e) => setD({ ...d, title: e.target.value })} error={touched && titleError ? t("services.wizard.errors.title") : undefined} />
                <TextAreaField label={t("services.wizard.description")} hint={t("services.wizard.descriptionHint")} value={d.description} maxLength={LIMITS.description.max} onChange={(e) => setD({ ...d, description: e.target.value })} error={touched && descError ? t("services.wizard.errors.description", { min: LIMITS.description.min }) : undefined} />
                {service.fields.map((f) => (
                  <FieldInput key={f.key} f={f} value={d.answers[f.key]} onChange={(v) => setAnswer(f.key, v)} error={fieldError(f)} l={l} />
                ))}
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
                        {formatTaka(p, locale)}
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
                            {t(`wizard.upgrades.${u}.name`)} · {formatTaka(cfg.upgradePrices[u], locale)}
                          </strong>
                          <span className="text-[13.5px] text-muted">{t(`wizard.upgrades.${u}.desc`)}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            )}

            {step === "account" && (
              <div className="mt-6">
                <AccountStep
                  mobile={mobile}
                  email={email}
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
                />
              </div>
            )}
            {step === "password" && (
              <div className="mt-6">
                <PasswordStep password={password} onPassword={setPassword} min={passwordMin} />
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
                    <dd className="m-0 text-lg tabular-nums">{formatTaka(price.total, locale)}</dd>
                  </div>
                </dl>
                <TextField label={t("wizard.c11.nameLabel")} hint={t("wizard.c11.nameHint")} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                <fieldset className="m-0 border-0 p-0">
                  <legend className="mb-3 text-base font-semibold text-ink">{t("wizard.c11.methodTitle")}</legend>
                  <div className="grid grid-cols-2 gap-3">
                    {(["bkash", "card"] as const).map((m) => (
                      <button key={m} type="button" onClick={() => setMethod(m)} aria-pressed={method === m} className={cx("flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg bg-surface ring-1", method === m ? "ring-2 ring-primary" : "ring-line")}>
                        <span className={cx("text-base font-bold", m === "bkash" ? "text-[#e2136e]" : "text-ink")}>{t(`wizard.c11.${m}`)}</span>
                        <span className="text-xs text-muted">{t(`wizard.c11.${m}Hint`)}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
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
                      {t("wizard.c11.termsEnd")}
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


function FieldInput({ f, value, onChange, error, l }: { f: BriefField; value: string | string[] | undefined; onChange: (v: string | string[]) => void; error?: string; l: (x: Lang) => string }) {
  const { t } = useI18n();
  const optional = f.required ? undefined : t("common.optional");
  const label = l(f.label);
  const hint = l(f.help) || undefined;
  const str = typeof value === "string" ? value : "";
  const list = Array.isArray(value) ? value : [];
  if (f.type === "text" || f.type === "link")
    return <TextField label={label} hint={hint} optionalLabel={optional} value={str} type={f.type === "link" ? "url" : "text"} inputMode={f.type === "link" ? "url" : undefined} maxLength={f.type === "link" ? LIMITS.link : LIMITS.text} onChange={(e) => onChange(e.target.value)} error={error} />;
  if (f.type === "long_text") return <TextAreaField label={label} hint={hint} optionalLabel={optional} value={str} maxLength={LIMITS.longText} onChange={(e) => onChange(e.target.value)} error={error} />;
  if (f.type === "colours")
    return (
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1 text-sm font-medium text-ink">
          {label} {optional && <span className="text-muted">({optional})</span>}
        </legend>
        {hint && <p className="m-0 mb-2 text-sm text-muted">{hint}</p>}
        <div className="flex flex-wrap items-center gap-2">
          {list.map((c) => (
            <button key={c} type="button" onClick={() => onChange(list.filter((x) => x !== c))} aria-label={t("services.wizard.removeColour", { colour: c })} className="flex min-h-10 items-center gap-2 rounded-full bg-surface px-3 text-sm font-semibold ring-1 ring-line">
              <span className="size-5 rounded-full ring-1 ring-line" style={{ background: c }} />
              {c.toUpperCase()} ✕
            </button>
          ))}
          {list.length < LIMITS.colours && (
            <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-bold text-primary ring-1 ring-dashed ring-line">
              <input type="color" className="size-6 cursor-pointer border-0 bg-transparent p-0" onChange={(e) => !list.includes(e.target.value) && onChange([...list, e.target.value])} />
              {t("services.wizard.addColour")}
            </label>
          )}
        </div>
        {error && <p className="m-0 mt-1.5 text-sm text-danger">{error}</p>}
      </fieldset>
    );
  const multi = f.type === "multi_choice";
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-1 text-sm font-medium text-ink">
        {label} {optional && <span className="text-muted">({optional})</span>}
      </legend>
      {hint && <p className="m-0 mb-2 text-sm text-muted">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {f.options.map((o) => {
          const on = multi ? list.includes(o.en) : str === o.en;
          return (
            <button key={o.en} type="button" aria-pressed={on} onClick={() => onChange(multi ? (on ? list.filter((x) => x !== o.en) : [...list, o.en]) : on ? "" : o.en)} className={cx("min-h-10 rounded-full px-4 text-[14.5px] font-semibold ring-1", on ? "bg-primary text-white ring-primary" : "bg-surface ring-line")}>
              {l(o)}
            </button>
          );
        })}
      </div>
      {error && <p className="m-0 mt-1.5 text-sm text-danger">{error}</p>}
    </fieldset>
  );
}
