"use client";

import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { usePushDevice } from "@/lib/push/use-push-device";
import { AdminIcon } from "./icons";

/**
 * "Phone notifications" in the admin account menu (owner, 2026-10-22): turn on browser notifications on this phone
 * or computer, then send a test to see they arrive.
 */
export function PushSwitch() {
  const { t } = useI18n();
  const { state, note, broken, pending, turnOn, test } = usePushDevice();

  if (state === "checking" || state === "viewing") return null;
  const lead: MessageKey = state === "server" ? "admin.push.driverOff" : `admin.push.${state}`;
  const button = "inline-flex h-11 shrink-0 items-center gap-2 rounded-[12px] px-[18px] text-[15px] font-bold disabled:opacity-60";

  return (
    <div className="-mt-px flex flex-col gap-2.5 border-y border-adm-line-soft px-4 py-3.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-adm-bg text-primary">
          <AdminIcon name="bell" size={18} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-snug">
          <strong className="text-[15.5px] font-bold">{t("admin.push.title")}</strong>
          <span className="text-sm text-muted">{t(lead)}</span>
        </div>
      </div>
      {(state === "off" || state === "on") && (
        <div className="flex flex-wrap justify-end gap-2">
          {(state === "off" || broken) && (
            <button type="button" role="menuitem" onClick={() => turnOn(state === "on")} disabled={pending} className={`${button} bg-primary text-white hover:bg-adm-deep`}>
              {t(state === "on" ? "admin.push.turnOnAgain" : "admin.push.turnOn")}
            </button>
          )}
          {state === "on" && (
            <button type="button" role="menuitem" onClick={test} disabled={pending} className={`${button} bg-tint text-primary hover:bg-[#f6dad8]`}>
              {t("admin.push.test")}
            </button>
          )}
        </div>
      )}
      <p role="status" className="m-0 text-sm font-semibold text-adm-strong empty:-mt-2.5">
        {note ? t(`admin.push.${note}`) : ""}
      </p>
    </div>
  );
}
