"use client";

import Link from "@/components/ui/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, PasswordField, PhoneField, TextAreaField, TextField } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import { cx } from "@/lib/cx";
import {
  checkDesignerBasics,
  checkDesignerLogin,
  checkDesignerProfile,
  createDesignerAccount,
  type StepField,
  type StepResult,
} from "@/lib/designers/actions";
import { type PayoutInput } from "@/lib/designers/signup";
import { usernameBase } from "@/lib/profile/username-rules";
import { useI18n } from "@/lib/i18n/client";
import { subscribeToPush } from "@/lib/push/client";
import { FieldInput } from "@/components/services/field-input";
import { BkashKindPicker } from "@/components/settings/bkash-kind";
import type { MessageKey } from "@/lib/i18n/translate";
import { checkExtraAnswers, EMPTY_ONBOARDING, extraOn, type OnboardingConfig } from "@/lib/onboarding/config";
import type { Answers, Lang } from "@/lib/services/types";
import { trackPixel } from "@/lib/analytics/meta-pixel";

const TOTAL = 4;

type Form = {
  name: string;
  mobile: string;
  country: string;
  whatsapp: boolean;
  /** Answers to the owner's own questions (Admin › Onboarding, owner 2026-10-14). */
  answers: Answers;
  email: string;
  password: string;
  bio: string;
  payoutType: "bkash" | "bank";
  bkashNumber: string;
  bkashKind: string;
  bankName: string;
  branch: string;
  accountName: string;
  accountNumber: string;
  routingNumber: string;
  acceptedRules: boolean;
};

const EMPTY: Form = {
  name: "",
  mobile: "",
  country: "BD",
  whatsapp: false,
  answers: {},
  email: "",
  password: "",
  bio: "",
  payoutType: "bkash",
  bkashNumber: "",
  bkashKind: "",
  bankName: "",
  branch: "",
  accountName: "",
  accountNumber: "",
  routingNumber: "",
  acceptedRules: false,
};

/** D-01 designer sign-up: four short steps (UI-JOURNEY). */
export function DesignerSignupFlow({ passwordMin, bioMax, onboarding = EMPTY_ONBOARDING }: { passwordMin: number; bioMax: number; onboarding?: OnboardingConfig }) {
  const { t, locale } = useI18n();
  const [extraErrors, setExtraErrors] = useState<Record<string, string>>({});
  const hidden = (k: string) => onboarding.hidden.includes(k);
  const lang = (x: Lang) => (locale === "bn" ? x.bn || x.en : x.en || x.bn);
  // The owner's own questions on a step, under the step's own fields.
  const extraFields = (n: number) => {
    const qs = extraOn(onboarding, n);
    if (!qs.length) return null;
    return (
      <div className="space-y-4">
        {qs.map((q) => (
          <FieldInput
            key={q.key}
            f={q}
            l={lang}
            value={form.answers[q.key]}
            onChange={(v) => {
              set("answers", { ...form.answers, [q.key]: v });
              setExtraErrors((e) => ({ ...e, [q.key]: "" }));
            }}
            error={extraErrors[q.key] ? t(`services.wizard.errors.${extraErrors[q.key]}` as MessageKey) : undefined}
          />
        ))}
      </div>
    );
  };
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>(EMPTY);
  const [result, setResult] = useState<StepResult | null>(null);
  const [busy, start] = useTransition();

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setResult(null);
  };

  const fieldError = (field: StepField) =>
    result && !result.ok && result.field === field ? t(result.error.key, result.error.params) : undefined;
  const generalError = result && !result.ok && !result.field ? t(result.error.key, result.error.params) : null;

  const payout = (): PayoutInput =>
    form.payoutType === "bkash"
      ? { type: "bkash", bkashNumber: form.bkashNumber, bkashKind: form.bkashKind }
      : { type: "bank", bankName: form.bankName, branch: form.branch, accountName: form.accountName, accountNumber: form.accountNumber, routingNumber: form.routingNumber };

  const next = () => {
    if (step === TOTAL) {
      start(async () => {
        // Ask for notification permission while we still have the click (welcome push, BLUEPRINT §12).
        const push = form.acceptedRules ? await subscribeToPush() : null;
        const r = await createDesignerAccount({ ...form, payout: payout(), push }).catch((): StepResult => ({ ok: false, error: { key: "auth.errors.generic" } }));
        setResult(r);
        if (r.ok) {
          // Meta Pixel (owner, 2026-10-24): the designer's account now exists. Only one sign-up can succeed per form.
          trackPixel(`lead:${crypto.randomUUID()}`, "Lead");
          router.push("/contests");
          router.refresh();
        } else if (r.field) {
          // Jump back to the step that holds the wrong field.
          const at: Partial<Record<StepField, number>> = { name: 1, mobile: 1, email: 2, password: 2, bio: 3 };
          if (at[r.field]) setStep(at[r.field]!);
        }
      });
      return;
    }
    // The owner's own questions on this step are checked here first.
    const missing = checkExtraAnswers(onboarding, form.answers, [step]).errors;
    setExtraErrors(missing);
    if (Object.keys(missing).length) return;
    start(async () => {
      const r =
        step === 1
          ? await checkDesignerBasics({ name: form.name, mobile: form.mobile, country: form.country, answers: form.answers })
          : step === 2
            ? await checkDesignerLogin({ email: form.email, password: form.password })
            : await checkDesignerProfile({ bio: form.bio, answers: form.answers });
      setResult(r);
      if (r.ok) setStep((s) => s + 1);
    });
  };

  const count = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        next();
      }}
      className="space-y-5"
      noValidate
    >
      <Stepper
        current={step}
        total={TOTAL}
        label={`${t("common.stepOf", { current: step, total: TOTAL })} · ${t(`designerSignup.steps.s${step as 1 | 2 | 3 | 4}`)}`}
      />

      {generalError && <Alert tone="danger">{generalError}</Alert>}

      {step === 1 && (
        <div className="space-y-4">
          <TextField
            label={t("designerSignup.name.label")}
            hint={t("designerSignup.name.hint")}
            autoComplete="name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            error={fieldError("name")}
            maxLength={60}
            autoFocus
          />
          <PhoneField
            mark
            label={t("designerSignup.mobile")}
            placeholder={form.country === "BD" ? "01XXX-XXXXXX" : undefined}
            country={form.country}
            onCountryChange={(iso) => set("country", iso)}
            countryLabel={t("auth.phone.country")}
            value={form.mobile}
            onChange={(e) => set("mobile", e.target.value)}
            error={fieldError("mobile")}
          />
          {!hidden("whatsapp") && <Checkbox label={t("auth.phone.whatsapp")} description={t("auth.phone.whatsappHint")} checked={form.whatsapp} onChange={(e) => set("whatsapp", e.target.checked)} />}
          {extraFields(1)}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <TextField
            mark
            label={t("designerSignup.email")}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            error={fieldError("email")}
            autoFocus
          />
          <PasswordField
            label={t("designerSignup.password")}
            hint={t("auth.password.hint", { min: passwordMin })}
            showLabel={t("auth.password.show")}
            hideLabel={t("auth.password.hide")}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            error={fieldError("password")}
          />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          {/* The username is made by the site (owner, 2026-10-17): first name + designer number, e.g. das008. */}
          <div className="rounded-[14px] bg-chip px-4 py-3 text-[15px] text-ink" data-username-auto>
            <b className="block font-semibold">{t("designerSignup.username.label")}</b>
            <span className="text-muted">{t("designerSignup.username.auto", { example: `${usernameBase(form.name, "designer")}012` })}</span>
          </div>
          {!hidden("bio") && (
            <>
          <TextAreaField
            label={t("designerSignup.bio.label")}
            hint={t("designerSignup.bio.hint")}
            optionalLabel={t("common.optional")}
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
            maxLength={bioMax}
            counterLabel={`${count.format(form.bio.length)} / ${count.format(bioMax)}`}
            error={fieldError("bio")}
            // Ready bios to tap and edit (owner, 2026-10-13), from the button beside the label (2026-10-15).
            ideas={{
              items: (["b1", "b2", "b3", "b4", "b5"] as const).map((k) => t(`designerSignup.bio.suggest.${k}`, { name: form.name.trim().split(/\s+/)[0] || t("designerSignup.bio.suggest.you") })).filter((x) => x.length <= bioMax),
              onPick: (text) => set("bio", text),
            }}
          />
            </>
          )}
          {extraFields(3)}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-5">
          <fieldset>
            <legend className="text-[15px] font-semibold text-ink">{t("designerSignup.payout.title")}</legend>
            <div className="mt-2 grid grid-cols-2 gap-1 rounded-[18px] bg-chip p-1 ring-1 ring-line" role="tablist">
              {(["bkash", "bank"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  role="tab"
                  aria-selected={form.payoutType === type}
                  onClick={() => set("payoutType", type)}
                  className={cx(
                    "min-h-11 rounded-[14px] text-[15px] font-bold transition-colors",
                    form.payoutType === type ? "bg-surface text-primary shadow-card" : "text-muted hover:text-ink",
                  )}
                >
                  {t(`designerSignup.payout.${type}`)}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-4">
              {form.payoutType === "bkash" ? (
                <PhoneField
                  label={t("designerSignup.payout.bkashNumber")}
                  placeholder="01XXX-XXXXXX"
                  value={form.bkashNumber}
                  onChange={(e) => set("bkashNumber", e.target.value)}
                  error={fieldError("bkashNumber")}
                />
              ) : null}
              {form.payoutType === "bkash" ? (
                <BkashKindPicker value={form.bkashKind} onChange={(k) => set("bkashKind", k)} error={fieldError("bkashKind")} />
              ) : (
                <>
                  <TextField label={t("designerSignup.payout.bankName")} value={form.bankName} onChange={(e) => set("bankName", e.target.value)} error={fieldError("bankName")} />
                  <TextField
                    label={t("designerSignup.payout.branch")}
                    optionalLabel={t("common.optional")}
                    value={form.branch}
                    onChange={(e) => set("branch", e.target.value)}
                  />
                  <TextField
                    label={t("designerSignup.payout.accountName")}
                    value={form.accountName}
                    onChange={(e) => set("accountName", e.target.value)}
                    error={fieldError("accountName")}
                  />
                  <TextField
                    label={t("designerSignup.payout.accountNumber")}
                    inputMode="numeric"
                    value={form.accountNumber}
                    onChange={(e) => set("accountNumber", e.target.value)}
                    error={fieldError("accountNumber")}
                  />
                  <TextField
                    label={t("designerSignup.payout.routingNumber")}
                    optionalLabel={t("common.optional")}
                    inputMode="numeric"
                    value={form.routingNumber}
                    onChange={(e) => set("routingNumber", e.target.value)}
                    error={fieldError("routingNumber")}
                  />
                </>
              )}
            </div>
          </fieldset>

          <div className="rounded-[20px] bg-tint p-5">
            <h2 className="m-0 text-lg font-semibold text-ink">{t("designerSignup.rules.title")}</h2>
            <ol className="m-0 mt-3 list-none space-y-2 p-0 text-[15px] text-ink">
              {(["r1", "r2", "r3", "r4", "r5"] as const).map((r, i) => (
                <li key={r} className="flex gap-2">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[image:var(--gradient-red)] text-[0.6875rem] font-bold text-white">
                    {count.format(i + 1)}
                  </span>
                  {t(`designerSignup.rules.${r}`)}
                </li>
              ))}
            </ol>
            <a href="/legal/designer-rules" target="_blank" className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-primary underline-offset-4 hover:underline">
              {t("designerSignup.rules.readAll")} →
            </a>
            <Checkbox
              className="mt-1"
              label={t("designerSignup.rules.accept")}
              checked={form.acceptedRules}
              onChange={(e) => set("acceptedRules", e.target.checked)}
            />
            {fieldError("rules") && (
              <p role="alert" className="text-sm text-danger">
                {fieldError("rules")}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        {step > 1 && (
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              setResult(null);
              setStep((s) => s - 1);
            }}
            disabled={busy}
          >
            {t("designerSignup.back")}
          </Button>
        )}
        <Button type="submit" size="lg" block loading={busy} disabled={step === TOTAL && !form.acceptedRules}>
          {step === TOTAL ? t("designerSignup.create") : t("designerSignup.continue")}
        </Button>
      </div>

      <p className="text-center text-sm text-muted">
        {t("designerSignup.haveAccount")}{" "}
        <Link href="/login?as=designer" className="font-bold text-primary hover:underline">
          {t("designerSignup.login")}
        </Link>
      </p>
    </form>
  );
}
