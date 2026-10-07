"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { requestPasswordReset, type EmailActionState } from "@/lib/auth/email-actions";
import { useI18n } from "@/lib/i18n/client";

export function ForgotPasswordForm({ expired }: { expired: boolean }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<EmailActionState, FormData>(requestPasswordReset, { status: "idle" });

  if (state.status === "sent") return <Alert tone="success">{t("auth.reset.sentIfExists")}</Alert>;

  return (
    <form action={action} className="space-y-5" noValidate>
      {expired && <Alert tone="warning">{t("auth.errors.resetExpired")}</Alert>}
      <TextField
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        label={t("wizard.c09.emailLabel")}
        error={state.status === "error" && state.error ? t(state.error.key, state.error.params) : undefined}
        required
        autoFocus
      />
      <Button type="submit" size="lg" block loading={pending}>
        {t("auth.reset.sendLink")}
      </Button>
    </form>
  );
}
