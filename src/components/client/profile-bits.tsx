"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { setProfileShown } from "@/lib/client/actions";
import { useI18n } from "@/lib/i18n/client";
import { CwIcon } from "./icons";

/** The privacy switch on the client's profile (CLIENT-HANDOFF §6). */
export function PrivacySwitch({ shown }: { shown: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const [on, setOn] = useState(shown);
  const [busy, start] = useTransition();
  return (
    <label className="tg" data-privacy>
      <input
        type="checkbox"
        className="vh"
        checked={on}
        disabled={busy}
        onChange={(e) => {
          const next = e.target.checked;
          setOn(next);
          start(async () => {
            const res = await setProfileShown(next);
            if (!res.ok) {
              setOn(!next);
              return toast(t(res.error), "danger");
            }
            toast(t(next ? "cw.profile.nowShown" : "cw.profile.nowHidden"));
          });
        }}
      />
      <i />
      {t("cw.profile.show")}
    </label>
  );
}

/** Share the public profile: the phone's share sheet, or copy the link. */
export function ShareProfileButton({ url, title }: { url: string; title: string }) {
  const { t } = useI18n();
  const toast = useToast();
  return (
    <button
      type="button"
      className="dic"
      aria-label={t("cw.profile.share")}
      title={t("cw.profile.share")}
      onClick={async () => {
        try {
          if (navigator.share) return await navigator.share({ title, url });
          await navigator.clipboard.writeText(url);
          toast(t("cw.profile.copied"));
        } catch {
          /* closed the share sheet */
        }
      }}
    >
      <CwIcon name="share" />
    </button>
  );
}
