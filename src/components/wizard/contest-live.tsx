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
    <div className="flex w-full flex-1 flex-col px-3.5 pb-3.5 max-[720px]:px-2 max-[720px]:pb-2">
      <div className="flex-1 rounded-[32px] bg-frame px-6 py-10 sm:px-10 sm:py-14 max-[720px]:rounded-[24px] max-[720px]:bg-surface max-[720px]:px-4 max-[720px]:py-6">
        <div className="mx-auto w-full max-w-xl min-[721px]:rounded-[28px] min-[721px]:border min-[721px]:border-line min-[721px]:bg-surface min-[721px]:p-10 min-[721px]:shadow-card">
          {celebrate && <Confetti />}
          <div className="mx-auto flex size-16 items-center justify-center rounded-[20px] bg-success/10 text-success">
            <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="m-0 mt-5 text-center text-[clamp(28px,3.4vw,40px)] font-semibold leading-[1.08] tracking-[-0.035em] text-ink">{t("wizard.result.liveTitle")}</h1>

          <div className="mt-8 rounded-[20px] bg-chip p-5">
            <p className="m-0 text-sm font-semibold text-muted">{t("wizard.result.linkLabel")}</p>
            <p className="mt-1 break-all font-mono text-sm text-ink">{url}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" onClick={copy} className="sm:flex-1">
                {t("wizard.result.copy")}
              </Button>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-[14px] bg-[#1877f2] px-4 text-[15px] font-bold text-white hover:brightness-95 sm:flex-1"
              >
                {t("wizard.result.share")}
              </a>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="m-0 text-[22px] font-semibold tracking-[-0.02em] text-ink">{t("wizard.result.nextTitle")}</h2>
            <ol className="m-0 mt-4 list-none space-y-3 p-0">
              {[t("wizard.result.next1"), t("wizard.result.next2"), t("wizard.result.next3", { date: pickBy })].map((line, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[image:var(--gradient-red)] text-sm font-bold text-white">{i + 1}</span>
                  <span className="pt-0.5 text-ink">{line}</span>
                </li>
              ))}
            </ol>
          </div>

          <ButtonLink href="/dashboard" size="lg" block className="mt-10">
            {t("wizard.result.dashboard")}
          </ButtonLink>
          </div>
        </div>
    </div>
  );
}
