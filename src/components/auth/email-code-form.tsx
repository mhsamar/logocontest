"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { OtpField } from "@/components/ui/field";
import { confirmEmailCode, resendVerification, type CodeFormState } from "@/lib/auth/email-actions";
import { useI18n } from "@/lib/i18n/client";
import { cx } from "@/lib/cx";

/**
 * Type the 6-digit confirm-your-email code (UI-JOURNEY "Email confirmation banner").
 * "compact" sits in the banner; "page" is the full form on /verify-email.
 */
export function EmailCodeForm({ length, variant, onConfirmed }: { length: number; variant: "compact" | "page"; onConfirmed?: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const [state, action, pending] = useActionState<CodeFormState, FormData>(confirmEmailCode, { status: "idle" });
  const [resent, setResent] = useState<CodeFormState>({ status: "idle" });
  const [resending, startResend] = useTransition();

  useEffect(() => {
    if (state.status !== "ok") return;
    if (onConfirmed) onConfirmed();
    // Let the "Email confirmed" message show for a moment, then reload so the banner goes away.
    const timer = setTimeout(() => router.refresh(), 1800);
    return () => clearTimeout(timer);
  }, [state.status, onConfirmed, router]);

  if (state.status === "ok") {
    return <p className="font-semibold text-success">{t("auth.verify.okTitle")}</p>;
  }

  const error = state.status === "error" && state.error ? t(state.error.key, state.error.params) : undefined;
  const resendNote =
    resent.status === "sent" ? (
      <span className="text-success">{t("auth.verify.resent")}</span>
    ) : resent.status === "error" && resent.error ? (
      <span className="text-danger">{t(resent.error.key, resent.error.params)}</span>
    ) : null;
  const resendButton = (
    <button
      type="button"
      disabled={resending}
      onClick={() => startResend(async () => setResent(await resendVerification()))}
      className="min-h-9 font-semibold text-primary underline disabled:opacity-60"
    >
      {t("auth.verify.resend")}
    </button>
  );

  if (variant === "compact") {
    // Owner, 2026-10-17: one tidy row: the code box, Confirm and Resend code side by side at the same height; on phones
    // the box takes its own line and the two buttons share the next one.
    return (
      <div className="w-full space-y-2">
        <form action={action} className="mx-auto flex w-full max-w-xl flex-wrap items-center justify-center gap-2.5">
          <input
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={length}
            placeholder={"0".repeat(length)}
            aria-label={t("auth.verify.codeLabel")}
            aria-invalid={error ? true : undefined}
            className={cx(
              "min-h-[52px] min-w-0 flex-[1_1_220px] rounded-2xl bg-surface px-3 text-center font-mono text-xl tracking-[0.35em] text-ink ring-1 ring-inset ring-line placeholder:text-line focus:outline-none focus:ring-2 focus:ring-primary max-[560px]:basis-full",
              error && "ring-2 ring-danger",
            )}
          />
          <Button type="submit" loading={pending} size="lg" className="max-[560px]:flex-1">
            {t("auth.verify.confirm")}
          </Button>
          <Button type="button" variant="secondary" size="lg" loading={resending} onClick={() => startResend(async () => setResent(await resendVerification()))} className="max-[560px]:flex-1">
            {t("auth.verify.resend")}
          </Button>
        </form>
        {(error || resendNote) && (
          <p role={error ? "alert" : "status"} className={cx("m-0", error && "text-danger")}>
            {error ?? resendNote}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4">
        <OtpField name="code" length={length} label={t("auth.verify.codeLabel")} error={error} autoFocus />
        <Button type="submit" size="lg" block loading={pending}>
          {t("auth.verify.confirm")}
        </Button>
      </form>
      <div className="flex flex-col items-center gap-1 text-sm">
        {resendButton}
        {resendNote}
      </div>
    </div>
  );
}
