"use client";

import { Alert } from "@/components/ui/alert";
import type { AuthFormState } from "@/lib/auth/actions";
import { useI18n } from "@/lib/i18n/client";

/** Shows an action error that does not belong to a single field. */
export function FormError({ state }: { state: AuthFormState }) {
  const { t } = useI18n();
  if (state.status !== "error" || !state.error || state.field) return null;
  return <Alert tone="danger">{t(state.error.key, state.error.params)}</Alert>;
}

export function useFieldError(state: AuthFormState) {
  const { t } = useI18n();
  return (field: NonNullable<AuthFormState["field"]>) =>
    state.status === "error" && state.field === field && state.error ? t(state.error.key, state.error.params) : undefined;
}
