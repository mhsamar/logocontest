"use client";

import { useActionState, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { OtpField, PhoneField } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import { requestCode, verifyCode, type AuthFormState } from "@/lib/auth/actions";
import type { OtpPurpose } from "@/lib/auth/otp-service";
import { useI18n } from "@/lib/i18n/client";
import { formatBdMobile } from "@/lib/phone";
import { FormError, useFieldError } from "./form-error";

const IDLE: AuthFormState = { status: "idle" };

function useSecondsUntil(deadline: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);
  return deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
}

/**
 * Phone → SMS code → final step. Used by registration and password reset;
 * the final step (name + password, or new password) is passed in.
 */
export function VerifiedPhoneFlow({
  purpose,
  sendLabel,
  verifyLabel,
  notice,
  finalStep,
}: {
  purpose: OtpPurpose;
  sendLabel: string;
  verifyLabel: string;
  notice?: string;
  finalStep: React.ReactNode;
}) {
  const { t } = useI18n();
  const [sent, requestAction, requesting] = useActionState(requestCode.bind(null, purpose), IDLE);
  const [verified, verifyAction, verifying] = useActionState(verifyCode.bind(null, purpose), IDLE);
  // "Use a different number" hides the code step until a new code is sent.
  const [dismissedSentAt, setDismissedSentAt] = useState<number | undefined>();

  const codeSent = Boolean(sent.phone && sent.sentAt && sent.sentAt !== dismissedSentAt);
  const step = verified.status === "ok" ? 2 : codeSent ? 1 : 0;
  const codeLength = sent.codeLength ?? 6;
  const resendIn = useSecondsUntil(sent.sentAt && sent.resendAfter ? sent.sentAt + sent.resendAfter * 1000 : null);

  const requestError = useFieldError(sent);
  const verifyError = useFieldError(verified);

  return (
    <div className="space-y-6">
      <Stepper current={step + 1} total={3} label={t("common.stepOf", { current: step + 1, total: 3 })} />

      {step === 0 && (
        <form action={requestAction} className="space-y-5" noValidate>
          <FormError state={sent} />
          <PhoneField
            name="phone"
            label={t("auth.phone.label")}
            hint={t("auth.phone.hint")}
            placeholder={t("auth.phone.placeholder")}
            defaultValue={sent.phone ? formatBdMobile(sent.phone) : undefined}
            error={requestError("phone")}
            required
            autoFocus
          />
          <Button type="submit" size="lg" block loading={requesting}>
            {sendLabel}
          </Button>
        </form>
      )}

      {step === 1 && sent.phone && (
        <div className="space-y-5">
          {notice && <Alert tone="info">{notice}</Alert>}
          {requestError("phone") && <Alert tone="danger">{requestError("phone")}</Alert>}
          <form action={verifyAction} className="space-y-5" noValidate>
            <FormError state={verified} />
            <input type="hidden" name="phone" value={sent.phone} />
            <OtpField
              name="code"
              length={codeLength}
              label={t("auth.otp.label")}
              hint={t("auth.otp.sentTo", { length: codeLength, phone: formatBdMobile(sent.phone) })}
              error={verifyError("code")}
              required
              autoFocus
            />
            <Button type="submit" size="lg" block loading={verifying}>
              {verifyLabel}
            </Button>
          </form>
          <div className="flex flex-col items-center gap-1">
            <form action={requestAction}>
              <input type="hidden" name="phone" value={sent.phone} />
              <Button type="submit" variant="ghost" disabled={resendIn > 0} loading={requesting}>
                {resendIn > 0 ? t("auth.otp.resendIn", { seconds: resendIn }) : t("auth.otp.resend")}
              </Button>
            </form>
            <Button variant="ghost" onClick={() => setDismissedSentAt(sent.sentAt)}>
              {t("auth.otp.changeNumber")}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && finalStep}
    </div>
  );
}
