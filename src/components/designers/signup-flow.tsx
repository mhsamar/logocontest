"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, PasswordField, PhoneField, TextAreaField, TextField } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import { cx } from "@/lib/cx";
import {
  checkDesignerBasics,
  checkDesignerLogin,
  checkDesignerProfile,
  checkUsername,
  createDesignerAccount,
  type StepField,
  type StepResult,
} from "@/lib/designers/actions";
import { suggestUsername, USERNAME_MAX, type PayoutInput } from "@/lib/designers/signup";
import { useI18n } from "@/lib/i18n/client";
import { subscribeToPush } from "@/lib/push/client";

const TOTAL = 4;

type Form = {
  name: string;
  mobile: string;
  email: string;
  password: string;
  username: string;
  bio: string;
  payoutType: "bkash" | "bank";
  bkashNumber: string;
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
  email: "",
  password: "",
  username: "",
  bio: "",
  payoutType: "bkash",
  bkashNumber: "",
  bankName: "",
  branch: "",
  accountName: "",
  accountNumber: "",
  routingNumber: "",
  acceptedRules: false,
};

type UsernameState = { status: "idle" | "checking" | "ok" | "error"; message?: string };

/** D-01 designer sign-up: four short steps (UI-JOURNEY). */
export function DesignerSignupFlow({ passwordMin, bioMax }: { passwordMin: number; bioMax: number }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>(EMPTY);
  const [result, setResult] = useState<StepResult | null>(null);
  const [usernameState, setUsernameState] = useState<UsernameState>({ status: "idle" });
  const [busy, start] = useTransition();

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setResult(null);
  };

  // Suggest a username from the name when the designer reaches step 3.
  useEffect(() => {
    if (step === 3 && !form.username) {
      const suggestion = suggestUsername(form.name);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time suggestion when the step opens
      if (suggestion) setForm((f) => ({ ...f, username: suggestion }));
    }
  }, [step, form.username, form.name]);

  // Live username check, a moment after typing stops.
  useEffect(() => {
    if (step !== 3 || !form.username) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when there is nothing to check
      setUsernameState({ status: "idle" });
      return;
    }
    setUsernameState({ status: "checking" });
    const timer = setTimeout(async () => {
      const r = await checkUsername(form.username).catch(() => null);
      if (!r) return setUsernameState({ status: "idle" });
      setUsernameState(r.ok ? { status: "ok", message: r.username } : { status: "error", message: t(r.error) });
    }, 400);
    return () => clearTimeout(timer);
  }, [form.username, step, t]);

  const fieldError = (field: StepField) =>
    result && !result.ok && result.field === field ? t(result.error.key, result.error.params) : undefined;
  const generalError = result && !result.ok && !result.field ? t(result.error.key, result.error.params) : null;

  const payout = (): PayoutInput =>
    form.payoutType === "bkash"
      ? { type: "bkash", bkashNumber: form.bkashNumber }
      : { type: "bank", bankName: form.bankName, branch: form.branch, accountName: form.accountName, accountNumber: form.accountNumber, routingNumber: form.routingNumber };

  const next = () => {
    if (step === TOTAL) {
      start(async () => {
        // Ask for notification permission while we still have the click (welcome push, BLUEPRINT §12).
        const push = form.acceptedRules ? await subscribeToPush() : null;
        const r = await createDesignerAccount({ ...form, payout: payout(), push }).catch((): StepResult => ({ ok: false, error: { key: "auth.errors.generic" } }));
        setResult(r);
        if (r.ok) {
          router.push("/contests");
          router.refresh();
        } else if (r.field) {
          // Jump back to the step that holds the wrong field.
          const at: Partial<Record<StepField, number>> = { name: 1, mobile: 1, email: 2, password: 2, username: 3, bio: 3 };
          if (at[r.field]) setStep(at[r.field]!);
        }
      });
      return;
    }
    start(async () => {
      const r =
        step === 1
          ? await checkDesignerBasics({ name: form.name, mobile: form.mobile })
          : step === 2
            ? await checkDesignerLogin({ email: form.email, password: form.password })
            : await checkDesignerProfile({ username: form.username, bio: form.bio });
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
            label={t("designerSignup.mobile")}
            placeholder="01XXX-XXXXXX"
            value={form.mobile}
            onChange={(e) => set("mobile", e.target.value)}
            error={fieldError("mobile")}
          />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <TextField
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
          <div>
            <TextField
              label={t("designerSignup.username.label")}
              hint={fieldError("username") ? undefined : t("designerSignup.username.hint")}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={USERNAME_MAX}
              value={form.username}
              onChange={(e) => set("username", e.target.value.toLowerCase())}
              error={fieldError("username") ?? (usernameState.status === "error" ? usernameState.message : undefined)}
              autoFocus
            />
            <p className="mt-1.5 text-sm" aria-live="polite">
              {usernameState.status === "checking" && <span className="text-muted">{t("designerSignup.username.checking")}</span>}
              {usernameState.status === "ok" && (
                <span className="font-medium text-success">✓ {t("designerSignup.username.available", { username: usernameState.message! })}</span>
              )}
            </p>
            {form.username && (
              <p className="mt-1 truncate rounded-md bg-canvas px-3 py-2 font-mono text-xs text-muted">
                {t("designerSignup.username.preview", { username: form.username })}
              </p>
            )}
          </div>
          <TextAreaField
            label={t("designerSignup.bio.label")}
            hint={t("designerSignup.bio.hint")}
            optionalLabel={t("common.optional")}
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
            maxLength={bioMax}
            counterLabel={`${count.format(form.bio.length)} / ${count.format(bioMax)}`}
            error={fieldError("bio")}
          />
        </div>
      )}

      {step === 4 && (
        <div className="space-y-5">
          <fieldset>
            <legend className="text-sm font-medium text-ink">{t("designerSignup.payout.title")}</legend>
            <div className="mt-2 grid grid-cols-2 gap-1 rounded-full bg-canvas p-1 ring-1 ring-line" role="tablist">
              {(["bkash", "bank"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  role="tab"
                  aria-selected={form.payoutType === type}
                  onClick={() => set("payoutType", type)}
                  className={cx(
                    "min-h-10 rounded-full text-sm font-semibold transition-colors",
                    form.payoutType === type ? "bg-ink text-white" : "text-muted hover:text-ink",
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

          <div className="rounded-lg bg-cream/40 p-4 ring-1 ring-cream">
            <h2 className="font-semibold text-ink">{t("designerSignup.rules.title")}</h2>
            <ol className="mt-2 space-y-1.5 text-sm text-ink">
              {(["r1", "r2", "r3", "r4", "r5"] as const).map((r, i) => (
                <li key={r} className="flex gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[0.6875rem] font-bold text-white">
                    {count.format(i + 1)}
                  </span>
                  {t(`designerSignup.rules.${r}`)}
                </li>
              ))}
            </ol>
            <Checkbox
              className="mt-3"
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
        <Link href="/login" className="font-semibold text-primary hover:underline">
          {t("designerSignup.login")}
        </Link>
      </p>
    </form>
  );
}
