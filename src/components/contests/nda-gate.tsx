"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { acceptNda } from "@/lib/contests/nda-actions";
import { useI18n } from "@/lib/i18n/client";

/** NDA / Confidential contest (BLUEPRINT §7.4, owner 2026-10-08): the agreement designers accept before seeing anything. */
export function NdaGate({ contestId, viewer, loginHref }: { contestId: string; viewer: "guest" | "designer" | "other"; loginHref: string }) {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const accept = () =>
    start(async () => {
      setError(null);
      const res = await acceptNda(contestId);
      if (!res.ok) setError(t(res.error));
    });

  return (
    <section className="mt-6 max-w-2xl animate-rise rounded-2xl bg-gradient-to-br from-[#eef4ff] to-[#dfe9ff] p-5 shadow-card ring-1 ring-[#bcd0ff] sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 animate-float-soft items-center justify-center rounded-xl bg-[#1d4ed8] text-white shadow-card">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6Z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-ink">{t("contest.nda.title")}</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink/80">{t("contest.nda.body")}</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {error && <Alert tone="danger">{error}</Alert>}
        {viewer === "designer" && (
          <Button onClick={accept} loading={busy}>
            {busy ? t("contest.nda.accepting") : t("contest.nda.accept")}
          </Button>
        )}
        {viewer === "guest" && (
          <>
            <p className="text-sm text-muted">{t("contest.nda.login")}</p>
            <ButtonLink href={loginHref}>{t("nav.login")}</ButtonLink>
          </>
        )}
        {viewer === "other" && <p className="text-sm text-muted">{t("contest.nda.designersOnly")}</p>}
      </div>
    </section>
  );
}
