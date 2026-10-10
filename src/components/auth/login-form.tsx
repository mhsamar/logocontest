"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { PasswordField, TextField } from "@/components/ui/field";
import { login, type AuthFormState } from "@/lib/auth/actions";
import { useI18n } from "@/lib/i18n/client";
import { FormError, useFieldError } from "./form-error";

export function LoginForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<AuthFormState, FormData>(login, { status: "idle" });
  const fieldError = useFieldError(state);

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <FormError state={state} />
      <TextField
        name="identifier"
        label={t("auth.login.identifierLabel")}
        placeholder={t("auth.login.identifierPlaceholder")}
        autoComplete="username"
        inputMode="email"
        error={fieldError("phone")}
        required
        autoFocus
      />
      <div className="space-y-2">
        <PasswordField
          name="password"
          label={t("auth.password.label")}
          showLabel={t("auth.password.show")}
          hideLabel={t("auth.password.hide")}
          autoComplete="current-password"
          error={fieldError("password")}
          required
        />
        <div className="text-right">
          <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">
            {t("auth.login.forgot")}
          </Link>
        </div>
      </div>
      <Button type="submit" size="lg" block loading={pending}>
        {t("auth.login.submit")}
      </Button>
    </form>
  );
}
