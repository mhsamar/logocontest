"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { sendBroadcast } from "@/lib/support/actions";
import { AUDIENCES, MESSAGE_MAX, type Audience } from "@/lib/support/rules";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { PersonPicker, type PickedPerson } from "./person-picker";
import { useReadOnly } from "./read-only";

/** A-25: write one message to a group or one person. */
export function BroadcastForm({ toPerson }: { toPerson: PickedPerson | null }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const router = useRouter();
  const toast = useToast();
  const [audience, setAudience] = useState<Audience>(toPerson ? "one" : "designers");
  const [person, setPerson] = useState<PickedPerson | null>(toPerson);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, run] = useTransition();
  if (readOnly) return null;

  const who = audience === "one" ? (person?.name ?? "") : t(`admin.messages.audiences.${audience}`);
  const send = () => {
    if (!window.confirm(t("admin.messages.confirm", { who }))) return;
    run(async () => {
      setError(null);
      const res = await sendBroadcast({ audience, person: person?.id ?? "", body });
      if (!res.ok) return setError(t(res.error));
      setBody("");
      toast(t("admin.messages.sent", { n: res.recipients }));
      router.refresh();
    });
  };

  return (
    <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line">
      <p className="text-sm font-semibold text-ink">{t("admin.messages.audience")}</p>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={t("admin.messages.audience")}>
        {AUDIENCES.map((a) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={audience === a}
            onClick={() => setAudience(a)}
            className={cx("min-h-10 rounded-full px-4 text-sm font-semibold ring-1", audience === a ? "bg-ink text-white ring-ink" : "bg-surface text-ink ring-line hover:ring-primary")}
          >
            {t(`admin.messages.audiences.${a}`)}
          </button>
        ))}
      </div>
      {audience === "one" && (
        <div className="mt-4 block text-sm">
          <span className="font-medium text-ink">{t("admin.messages.person")}</span>
          <PersonPicker value={person} onChange={setPerson} />
        </div>
      )}
      <label className="mt-4 block text-sm">
        <span className="font-medium text-ink">{t("admin.messages.body")}</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={MESSAGE_MAX}
          className="mt-1 block w-full rounded-xl bg-canvas px-3 py-2 text-sm leading-relaxed text-ink ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <span className="mt-1 block text-right text-xs text-muted">
          {body.length} / {MESSAGE_MAX}
        </span>
      </label>
      {error && (
        <div className="mt-3">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
      <div className="mt-3">
        <Button onClick={send} loading={busy} disabled={!body.trim() || (audience === "one" && !person)}>
          {t("admin.messages.send")}
        </Button>
      </div>
    </section>
  );
}
