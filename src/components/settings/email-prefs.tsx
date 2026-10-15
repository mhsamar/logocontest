"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import type { OptionalKey } from "@/lib/email/catalog";
import { saveEmailPrefs, setFromLink } from "@/lib/email/prefs-actions";

/** Email settings (owner, 2026-10-15): one switch per kind of email; codes and security emails always come. */
export function EmailPrefsForm({ keys, off }: { keys: OptionalKey[]; off: OptionalKey[] }) {
  const { t } = useI18n();
  const toast = useToast();
  const [offNow, setOffNow] = useState<OptionalKey[]>(off);
  const [busy, start] = useTransition();
  const dirty = [...offNow].sort().join() !== [...off].sort().join();
  const save = () =>
    start(async () => {
      const res = await saveEmailPrefs(offNow);
      toast(res.ok ? t("email.prefs.saved") : t("auth.errors.generic"), res.ok ? undefined : "danger");
    });
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {keys.map((k) => (
          <Checkbox
            key={k}
            name={`email-${k}`}
            label={t(`email.prefs.types.${k}.label` as MessageKey)}
            description={t(`email.prefs.types.${k}.hint` as MessageKey)}
            checked={!offNow.includes(k)}
            onChange={(e) => setOffNow((cur) => (e.target.checked ? cur.filter((x) => x !== k) : [...cur, k]))}
          />
        ))}
      </div>
      <div className="flex justify-end">
        <Button type="button" variant="success" loading={busy} disabled={!dirty} onClick={save}>
          {t("email.prefs.save")}
        </Button>
      </div>
    </div>
  );
}

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
