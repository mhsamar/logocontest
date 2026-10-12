"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { confirmEmailCode, resendVerification, type CodeFormState } from "@/lib/auth/email-actions";
import { useI18n } from "@/lib/i18n/client";

const toAscii = (s: string) => s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));

/**
 * The owner's confirm-your-email bar on their profile (owner, 2026-10-12; Design/designer-profile): one box per
 * digit. Typing moves to the next box, Backspace moves back, and pasting the whole code fills every box. It sends
 * the same form as before (confirmEmailCode), so the checks are unchanged.
 */
export function ProfileEmailBar({ email, length }: { email: string; length: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(""));
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const [state, action, pending] = useActionState<CodeFormState, FormData>(confirmEmailCode, { status: "idle" });
  const [resent, setResent] = useState<CodeFormState>({ status: "idle" });
  const [resending, startResend] = useTransition();

  useEffect(() => {
    if (state.status !== "ok") return;
    const timer = setTimeout(() => router.refresh(), 1800);
    return () => clearTimeout(timer);
  }, [state.status, router]);

  const fill = (from: number, text: string) => {
    const got = toAscii(text).replace(/\D/g, "").slice(0, length - from).split("");
    if (got.length === 0) return;
    setDigits((cur) => {
      const next = [...cur];
      got.forEach((d, k) => (next[from + k] = d));
      return next;
    });
    boxes.current[Math.min(length - 1, from + got.length)]?.focus();
  };

  if (state.status === "ok") {
    return (
      <div className="dp-eb" role="status">
        <b className="text-success">{t("auth.verify.okTitle")}</b>
      </div>
    );
  }
  const error = state.status === "error" && state.error ? t(state.error.key, state.error.params) : null;

  return (
    <form action={action} className="dp-eb">
      <span className="dp-ebi" aria-hidden>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="M4 7l8 6 8-6" />
        </svg>
      </span>
      <span className="min-w-0 flex-[1_1_260px]">
        <b>{t("designerProfile.x.email.title")}</b> {t("designerProfile.x.email.body", { length, email })}
        {error && (
          <span role="alert" className="block text-sm font-semibold text-danger">
            {error}
          </span>
        )}
        {resent.status === "sent" && <span className="block text-sm font-semibold text-success">{t("auth.verify.resent")}</span>}
        {resent.status === "error" && resent.error && <span className="block text-sm font-semibold text-danger">{t(resent.error.key, resent.error.params)}</span>}
      </span>
      <input type="hidden" name="code" value={digits.join("")} />
      <div className="dp-otp" role="group" aria-label={t("designerProfile.x.email.group", { length })}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              boxes.current[i] = el;
            }}
            value={d}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            aria-label={t("designerProfile.x.email.digit", { n: i + 1 })}
            aria-invalid={error ? true : undefined}
            onChange={(e) => {
              const v = toAscii(e.target.value).replace(/\D/g, "");
              if (v.length > 1) return fill(i, v); // autofill can drop the whole code in one box
              setDigits((cur) => cur.map((x, k) => (k === i ? v : x)));
              if (v) boxes.current[i + 1]?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digits[i] && i > 0) {
                e.preventDefault();
                setDigits((cur) => cur.map((x, k) => (k === i - 1 ? "" : x)));
                boxes.current[i - 1]?.focus();
              } else if (e.key === "ArrowLeft" && i > 0) boxes.current[i - 1]?.focus();
              else if (e.key === "ArrowRight" && i < length - 1) boxes.current[i + 1]?.focus();
            }}
            onPaste={(e) => {
              e.preventDefault();
              fill(i, e.clipboardData.getData("text"));
            }}
            onFocus={(e) => e.currentTarget.select()}
          />
        ))}
      </div>
      <button type="submit" className="dp-b1 min-h-[42px] px-[18px]" disabled={pending || digits.join("").length !== length}>
        {t("auth.verify.confirm")}
      </button>
      <button
        type="button"
        disabled={resending}
        onClick={() => startResend(async () => setResent(await resendVerification()))}
        className="border-0 bg-transparent p-0 text-sm font-bold text-primary disabled:opacity-60"
      >
        {t("auth.verify.resend")}
      </button>
    </form>
  );
}
