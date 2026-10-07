"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/field";
import type { AuthFormState } from "@/lib/auth/actions";
import { setNewPassword } from "@/lib/auth/email-actions";
import { useI18n } from "@/lib/i18n/client";
import { FormError, useFieldError } from "./form-error";

export function NewPasswordForm({ passwordMin }: { passwordMin: number }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<AuthFormState, FormData>(setNewPassword, { status: "idle" });
  const fieldError = useFieldError(state);

  if (state.status === "ok") {
    return (
      <div className="space-y-5">
        <Alert tone="success">{t("auth.reset.done")}</Alert>
        <ButtonLink href="/" size="lg" block>
          {t("notFound.home")}
        </ButtonLink>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormError state={state} />
      <PasswordField
        name="password"
        label={t("auth.password.newLabel")}
        hint={t("auth.password.hint", { min: passwordMin })}
        showLabel={t("auth.password.show")}
        hideLabel={t("auth.password.hide")}
        autoComplete="new-password"
        error={fieldError("password")}
        required
        autoFocus
      />
      <Button type="submit" size="lg" block loading={pending}>
        {t("auth.reset.submit")}
      </Button>
    </form>
  );
}
