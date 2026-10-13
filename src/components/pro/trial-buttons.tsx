"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";
import { cancelMyTrial, startMyTrial } from "@/lib/pro/actions";
import { Icon } from "./parts";

/** "Start 3-day free trial" (owner, 2026-10-14): once per account; then the Pro dashboard opens. */
export function StartTrialButton({ days, className = "pr-btn", light }: { days: number; className?: string; light?: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      style={light ? { width: "100%", justifyContent: "center" } : undefined}
      onClick={() =>
        start(async () => {
          const res = await startMyTrial();
          if (!res.ok) return toast(t(res.error), "danger");
          toast(t("pro.trial.started"));
          router.push("/dashboard");
        })
      }
    >
      <Icon name="crown" size={16} />
      {t("pro.trial.start", { days })}
    </button>
  );
}

/** End the free trial now (asked once more): Basic straight away, no new trial. */
export function EndTrialButton() {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, start] = useTransition();
  if (!asking)
    return (
      <button type="button" className="pr-link" style={{ border: 0, background: "none", cursor: "pointer", color: "#A3121B" }} onClick={() => setAsking(true)}>
        {t("pro.trial.end")}
      </button>
    );
  return (
    <div className="pr-cancel" role="dialog" aria-label={t("pro.trial.end")}>
      <p className="pr-mut" style={{ margin: 0 }}>
        {t("pro.trial.endConfirm")}
      </p>
      <div className="row">
        <button type="button" className="pr-out sm" onClick={() => setAsking(false)}>
          {t("pro.settings.keep")}
        </button>
        <button
          type="button"
          className="pr-btn sm"
          disabled={busy}
          onClick={() =>
            start(async () => {
              const res = await cancelMyTrial();
              if (!res.ok) return toast(t(res.error), "danger");
              toast(t("pro.trial.endedToast"));
              router.push("/dashboard");
            })
          }
        >
          {t("pro.trial.end")}
        </button>
      </div>
    </div>
  );
}
