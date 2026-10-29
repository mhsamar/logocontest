"use client";

import Link from "@/components/ui/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, TextField } from "@/components/ui/field";
import { AccountStep, PasswordStep } from "@/components/wizard/steps-account";
import { normalizeEmail } from "@/lib/auth/identity";
import { pixelStartId, trackPixel } from "@/lib/analytics/meta-pixel";
import { useI18n } from "@/lib/i18n/client";
import { toE164 } from "@/lib/phone";
import { isPersonName } from "@/lib/profile/name-rules";
import type { V2Actions } from "./wizard-v2";

const PHONE_ERRORS = ["auth.errors.phoneTaken", "auth.errors.invalidPhone", "auth.errors.invalidPhoneIntl"];
const EMAIL_ERRORS = ["wizard.errors.emailTaken", "wizard.errors.email", "auth.errors.emailFake", "auth.errors.emailDisposable", "auth.errors.emailNoMail", "auth.errors.emailTypo"];
const PASSWORD_ERRORS = ["auth.errors.invalidCredentials", "auth.errors.passwordTooShort", "auth.errors.locked"];

/** The agreement on step 1 (or step 2 for a client who was signed in): pre-ticked, and it must stay ticked (spec §2). */
export function Agreement({ agreed, onAgreed }: { agreed: boolean; onAgreed: (on: boolean) => void }) {
  const { t } = useI18n();
  return (
    <Checkbox
      checked={agreed}
      onChange={(e) => onAgreed(e.target.checked)}
      label={
        <>
          {t("wizardV2.account.agreeStart")}
          <Link href="/legal/terms" target="_blank" className="font-semibold text-primary underline">
            {t("wizardV2.account.terms")}
          </Link>
          {t("wizardV2.account.and")}
          <Link href="/legal/payment-refund" target="_blank" className="font-semibold text-primary underline">
            {t("wizardV2.account.refund")}
          </Link>
          {t("wizardV2.account.agreeEnd")}
        </>
      }
    />
  );
}

/**
 * Step 1, About you: name, mobile (WhatsApp on by default), email and password, and the agreement that replaces the
 * old content-rules pop-up. An email that already has an account signs in with its password instead.
 */
export function AccountV2({
  actions,
  passwordMin,
  agreed,
  onAgreed,
  onError,
  onDone,
  onBar,
}: {
  actions: V2Actions;
  passwordMin: number;
  /** The step's buttons: the team's help card keeps clear of them. */
  onBar: (el: HTMLDivElement | null) => void;
  agreed: boolean;
  onAgreed: (on: boolean) => void;
  onError: (message: string | null) => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [country, setCountry] = useState("BD");
  const [whatsapp, setWhatsapp] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<{ field: "name" | "mobile" | "email" | "password"; message: string } | null>(null);
  const [tried, setTried] = useState(false);
  const [busy, start] = useTransition();

  const person = name.trim().replace(/\s+/g, " ");
  const nameOk = isPersonName(person) && person.length >= 2 && person.length <= 60;
  const e164 = toE164(mobile, country);
  const mail = normalizeEmail(email);
  // An existing account may have an older, shorter password: the minimum is checked on the server for new accounts.
  const ready = nameOk && e164 !== null && mail !== null && password.length > 0 && agreed;
  const shown = (field: "name" | "mobile" | "email" | "password") => (fieldError?.field === field ? fieldError.message : undefined);

  const submit = () => {
    setTried(true);
    if (!ready) return;
    onError(null);
    start(async () => {
      actions.lead({ mobile, country, name: person, email, whatsapp });
      // Asks for notification permission while we still have the click (BLUEPRINT §12: welcome push).
      const push = await actions.push();
      const res = await actions.account({ name: person, mobile, country, whatsapp, email, password, agreed, push });
      if (!res.ok) {
        const message = t(res.error.key, res.error.params);
        const field = PHONE_ERRORS.includes(res.error.key) ? "mobile" : EMAIL_ERRORS.includes(res.error.key) ? "email" : PASSWORD_ERRORS.includes(res.error.key) ? "password" : res.error.key === "designerSignup.errors.nameLetters" ? "name" : null;
        if (field) setFieldError({ field, message });
        else onError(message);
        return;
      }
      // Meta Pixel: the client's account now exists (only a new one; a sign-in sends nothing).
      if (res.created) trackPixel(`register:v2:${pixelStartId()}`, "CompleteRegistration");
      setPassword("");
      onDone();
    });
  };

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <TextField
        label={t("wizardV2.account.name")}
        hint={t("wizard.you.nameHint")}
        autoComplete="name"
        value={name}
        maxLength={60}
        onChange={(e) => {
          setName(e.target.value);
          setFieldError(null);
        }}
        error={shown("name") ?? (tried && !nameOk ? t("wizard.you.nameError") : undefined)}
        autoFocus
      />
      <AccountStep
        mobile={mobile}
        email={email}
        country={country}
        onCountry={(iso) => {
          setCountry(iso);
          setFieldError(null);
        }}
        whatsapp={whatsapp}
        onWhatsapp={setWhatsapp}
        onMobile={(v) => {
          setMobile(v);
          setFieldError(null);
        }}
        onEmail={(v) => {
          setEmail(v);
          setFieldError(null);
        }}
        mobileError={shown("mobile") ?? (tried && !e164 ? t(country === "BD" ? "auth.errors.invalidPhone" : "auth.errors.invalidPhoneIntl") : undefined)}
        emailError={shown("email") ?? (tried && !mail ? t("wizard.errors.email") : undefined)}
        taken={false}
        autoFocus={false}
      />
      <div className="space-y-1.5">
        <PasswordStep
          password={password}
          onPassword={(p) => (setPassword(p), setFieldError(null))}
          min={passwordMin}
          error={shown("password") ?? (tried && !password ? t("auth.errors.passwordTooShort", { min: passwordMin }) : undefined)}
          autoFocus={false}
        />
        <p className="m-0 text-sm text-muted">{t("wizardV2.account.existingHint")}</p>
      </div>
      <div>
        <Agreement agreed={agreed} onAgreed={onAgreed} />
        {tried && !agreed && <p className="m-0 text-sm text-danger">{t("wizardV2.errors.agree")}</p>}
      </div>
      <div ref={onBar}>
        <Button type="submit" size="lg" block loading={busy}>
          {t("wizardV2.next")}
        </Button>
      </div>
      <p className="m-0 text-center text-sm text-muted">
        {t("wizardV2.account.have")}{" "}
        <Link href="/login?as=client&next=/start-v2" className="font-semibold text-primary underline">
          {t("wizardV2.account.login")}
        </Link>
      </p>
    </form>
  );
}
