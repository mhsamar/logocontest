"use client";

import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Checkbox, PasswordField, PhoneField, TextField } from "@/components/ui/field";
import { useI18n } from "@/lib/i18n/client";

// C-09: mobile number and email, both required. No OTP (owner, 2026-10-07).
export function AccountStep({
  mobile,
  email,
  onMobile,
  onEmail,
  mobileError,
  emailError,
  taken,
  country = "BD",
  onCountry,
  whatsapp = false,
  onWhatsapp,
}: {
  mobile: string;
  email: string;
  /** Any country, Bangladesh by default; and "on WhatsApp" (owner, 2026-10-14). */
  country?: string;
  onCountry?: (iso: string) => void;
  whatsapp?: boolean;
  onWhatsapp?: (on: boolean) => void;
  onMobile: (v: string) => void;
  onEmail: (v: string) => void;
  mobileError?: string;
  emailError?: string;
  taken: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-5">
      <PhoneField
        mark
        label={t("auth.phone.label")}
        hint={country === "BD" ? t("auth.phone.hint") : t("auth.phone.hintAny")}
        placeholder={country === "BD" ? t("auth.phone.placeholder") : undefined}
        country={country}
        onCountryChange={onCountry}
        countryLabel={t("auth.phone.country")}
        value={mobile}
        onChange={(e) => onMobile(e.target.value)}
        error={mobileError}
        autoFocus
      />
      {onWhatsapp && <Checkbox label={t("auth.phone.whatsapp")} description={t("auth.phone.whatsappHint")} checked={whatsapp} onChange={(e) => onWhatsapp(e.target.checked)} />}
      <TextField
        mark
        label={t("wizard.c09.emailLabel")}
        hint={t("wizard.c09.emailHint")}
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => onEmail(e.target.value)}
        error={emailError}
      />
      {taken && (
        <Alert tone="info">
          {t("wizard.c09.existing")}{" "}
          <Link href="/login?as=client&next=/start" className="font-semibold underline">
            {t("nav.login")}
          </Link>
        </Alert>
      )}
    </div>
  );
}

// C-10
export function strength(password: string): "weak" | "ok" | "strong" {
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  if (password.length >= 12 && kinds >= 3) return "strong";
  if (password.length >= 8 && kinds >= 2) return "ok";
  return "weak";
}

export function PasswordStep({
  password,
  onPassword,
  min,
  error,
}: {
  password: string;
  onPassword: (p: string) => void;
  min: number;
  error?: string;
}) {
  const { t } = useI18n();
  const level = strength(password);
  return (
    <div className="space-y-3">
      <PasswordField
        label={t("auth.password.label")}
        hint={t("auth.password.hint", { min })}
        showLabel={t("auth.password.show")}
        hideLabel={t("auth.password.hide")}
        autoComplete="new-password"
        value={password}
        onChange={(e) => onPassword(e.target.value)}
        error={error}
        autoFocus
      />
      {password && (
        <div className="flex items-center gap-2" aria-live="polite">
          <div className="flex flex-1 gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={
                  "h-1 flex-1 rounded-full " +
                  (i <= ["weak", "ok", "strong"].indexOf(level)
                    ? level === "weak"
                      ? "bg-danger"
                      : level === "ok"
                        ? "bg-warning"
                        : "bg-success"
                    : "bg-line")
                }
              />
            ))}
          </div>
          <span className="text-xs text-muted">{t(`wizard.c10.${level}`)}</span>
        </div>
      )}
    </div>
  );
}
