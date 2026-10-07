"use client";

import { useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";
import { clearFiles } from "./file-store";
import { clearState } from "./state";

const COLORS = ["var(--color-primary)", "var(--color-accent)", "var(--color-success)", "var(--color-info)", "var(--color-danger)"];

// Deterministic "random" spread, so server and browser render the same HTML.
const PIECES = Array.from({ length: 36 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: ((i * 7) % 10) / 25,
  duration: 1.6 + ((i * 13) % 12) / 10,
  rotate: (i * 53) % 360,
  color: COLORS[i % COLORS.length],
}));

/** A short, one-time CSS confetti burst. Skipped when the user prefers reduced motion. */
function Confetti() {
  const pieces = PIECES;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden motion-reduce:hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute -top-4 block h-3 w-2 rounded-sm"
          style={{
            left: `${p.left}%`,
            background: p.color,
            transform: `rotate(${p.rotate}deg)`,
            animation: `confetti-fall ${p.duration}s ${p.delay}s ease-in forwards`,
          }}
        />
      ))}
      <style>{`@keyframes confetti-fall { to { transform: translateY(110vh) rotate(720deg); opacity: 0.6; } }`}</style>
    </div>
  );
}

// C-12
export function ContestLive({ url, pickBy }: { url: string; pickBy: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [celebrate, setCelebrate] = useState(true);

  useEffect(() => {
    // The contest is live: the browser copy of the wizard is no longer needed.
    clearState();
    void clearFiles();
    const timer = setTimeout(() => setCelebrate(false), 3500);
    return () => clearTimeout(timer);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast(t("wizard.result.copied"));
    } catch {
      toast(t("auth.errors.generic"), "danger");
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10 sm:py-14">
      {celebrate && <Confetti />}
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-success/10 text-success">
        <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="mt-5 text-center text-h2 font-bold leading-tight text-ink lg:text-h2-lg">{t("wizard.result.liveTitle")}</h1>

      <div className="mt-8 rounded-lg bg-surface p-4 ring-1 ring-line">
        <p className="text-sm font-medium text-muted">{t("wizard.result.linkLabel")}</p>
        <p className="mt-1 break-all font-mono text-sm text-ink">{url}</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" onClick={copy} className="sm:flex-1">
            {t("wizard.result.copy")}
          </Button>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#1877f2] px-4 text-[0.9375rem] font-semibold text-white hover:brightness-95 sm:flex-1"
          >
            {t("wizard.result.share")}
          </a>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-h3 font-semibold text-ink">{t("wizard.result.nextTitle")}</h2>
        <ol className="mt-3 space-y-3">
          {[t("wizard.result.next1"), t("wizard.result.next2"), t("wizard.result.next3", { date: pickBy })].map((line, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{i + 1}</span>
              <span className="pt-0.5 text-ink">{line}</span>
            </li>
          ))}
        </ol>
      </div>

      <ButtonLink href="/dashboard" size="lg" block className="mt-10">
        {t("wizard.result.dashboard")}
      </ButtonLink>
    </div>
  );
}
