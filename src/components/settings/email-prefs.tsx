"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { setFromLink } from "@/lib/email/prefs-actions";

/** The Unsubscribe link's page: asks first, then offers Undo. */
export function UnsubscribeBox({ link, type }: { link: { u: string; k: string; s: string }; type: string }) {
  const { t } = useI18n();
  const [done, setDone] = useState<"off" | "on" | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, start] = useTransition();
  const set = (on: boolean) =>
    start(async () => {
      const res = await setFromLink({ ...link, on });
      setFailed(!res.ok);
      if (res.ok) setDone(on ? "on" : "off");
    });
  return (
    <div className="space-y-4">
      <p className="m-0 text-[16px] text-ink">{done === "off" ? t("email.unsub.done", { type }) : done === "on" ? t("email.unsub.again", { type }) : t("email.unsub.lead", { type })}</p>
      {failed && <p className="m-0 text-[15px] font-semibold text-danger">{t("auth.errors.generic")}</p>}
      <div className="flex flex-wrap gap-2">
        {done === "off" ? (
          <Button type="button" variant="secondary" loading={busy} onClick={() => set(true)}>
            {t("email.unsub.undo")}
          </Button>
        ) : (
          done === null && (
            <Button type="button" loading={busy} onClick={() => set(false)}>
              {t("email.unsub.button")}
            </Button>
          )
        )}
      </div>
      <p className="m-0 text-[14px] text-muted">{t("email.unsub.always")}</p>
    </div>
  );
}
