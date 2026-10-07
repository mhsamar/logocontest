"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/field";
import { completeReset, type AuthFormState } from "@/lib/auth/actions";
import { useI18n } from "@/lib/i18n/client";
import { FormError, useFieldError } from "./form-error";
import { VerifiedPhoneFlow } from "./verified-phone-flow";

function NewPasswordStep({ passwordMin }: { passwordMin: number }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<AuthFormState, FormData>(completeReset, { status: "idle" });
  const fieldError = useFieldError(state);
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
        minLength={passwordMin}
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

export function ResetFlow({ passwordMin }: { passwordMin: number }) {
  const { t } = useI18n();
  return (
    <VerifiedPhoneFlow
      purpose="reset"
      sendLabel={t("auth.reset.sendCode")}
      verifyLabel={t("auth.reset.verify")}
      notice={t("auth.reset.sentIfExists")}
      finalStep={<NewPasswordStep passwordMin={passwordMin} />}
    />
  );
}
