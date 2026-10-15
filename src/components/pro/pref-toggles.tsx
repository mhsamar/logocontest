"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";
import { setProAlertServices, setProPreference, setSavedReminder } from "@/lib/pro/actions";

type PrefKey = "show_badge" | "client_messages" | "weekly_report" | "show_contact" | "alert_app" | "similar_alerts";

/** One Pro on/off switch row (Settings › Pro extras, Contests › Instant alerts). Saved at once. */
export function PrefToggle({ pref, on: initial, label, sub }: { pref: PrefKey; on: boolean; label: string; sub?: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [on, setOn] = useState(initial);
  const [busy, start] = useTransition();
  const flip = () =>
    start(async () => {
      const next = !on;
      setOn(next);
      const res = await setProPreference(pref, next);
      if (!res.ok) {
        setOn(!next);
        toast(t(res.error), "danger");
      }
    });
  return (
    <div className="pr-row-tg">
      <span>
        {label}
        {sub && <em>{sub}</em>}
      </span>
      <button type="button" role="switch" aria-checked={on} aria-label={label} className="pr-toggle" disabled={busy} onClick={flip} />
    </div>
  );
}

/** Which design types send an instant alert (none picked = all). */
export function AlertTypes({ options, picked: initial }: { options: { slug: string; name: string }[]; picked: string[] }) {
  const { t } = useI18n();
  const toast = useToast();
  const [picked, setPicked] = useState<string[]>(initial.length ? initial : options.map((o) => o.slug));
  const [busy, start] = useTransition();
  const flip = (slug: string) =>
    start(async () => {
      const before = picked;
      const next = picked.includes(slug) ? picked.filter((x) => x !== slug) : [...picked, slug];
      setPicked(next);
      // Everything picked is stored as "all", so new design types are included too.
      const res = await setProAlertServices(next.length === options.length ? [] : next);
      if (!res.ok) {
        setPicked(before);
        toast(t(res.error), "danger");
      }
    });
  return (
    <>
      {options.map((o) => (
        <div key={o.slug} className="pr-row-tg">
          <span>{o.name}</span>
          <button type="button" role="switch" aria-checked={picked.includes(o.slug)} aria-label={o.name} className="pr-toggle" disabled={busy} onClick={() => flip(o.slug)} />
        </div>
      ))}
    </>
  );
}

/** "Remind me" on a saved contest (Pro). */
export function RemindToggle({ contestId, on: initial, label }: { contestId: string; on: boolean; label: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [on, setOn] = useState(initial);
  const [busy, start] = useTransition();
  const flip = () =>
    start(async () => {
      const next = !on;
      setOn(next);
      const res = await setSavedReminder(contestId, next);
      if (!res.ok) {
        setOn(!next);
        toast(t(res.error), "danger");
      }
    });
  return (
    <label className="pr-remind">
      <button type="button" role="switch" aria-checked={on} aria-label={label} className="pr-toggle" disabled={busy} onClick={flip} />
      {label}
    </label>
  );
}
