"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { publishLegal, resetLegal } from "@/lib/legal/admin-actions-legal";
import { textToAgreement, textToDoc } from "@/lib/legal/format";
import type { LegalBlock } from "@/lib/legal/types";
import { useI18n } from "@/lib/i18n/client";
import { useReadOnly } from "./read-only";

function Block({ b }: { b: LegalBlock }) {
  return typeof b === "string" ? (
    <p>{b}</p>
  ) : (
    <ul className="list-disc space-y-1 pl-5">
      {b.list.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}

/** A-16: one legal page in one language, as plain text with a live preview. */
export function LegalEditor({ slug, locale, initial, edited, placeholders }: { slug: string; locale: string; initial: string; edited: boolean; placeholders: string[] }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const router = useRouter();
  const toast = useToast();
  const [text, setText] = useState(initial);
  const [resign, setResign] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, run] = useTransition();
  const agreement = slug === "agreement";
  const parsed = useMemo(() => (agreement ? textToAgreement(text) : textToDoc(text)), [agreement, text]);
  const dirty = text !== initial;

  const publish = () =>
    run(async () => {
      setError(null);
      const res = await publishLegal(slug, locale, text, resign);
      if (!res.ok) return setError(`${t(res.error)}${res.names ? ` ${res.names}` : ""}`);
      setResign(false);
      toast(t("admin.legal.done"));
      router.refresh();
    });
  const reset = () =>
    run(async () => {
      setError(null);
      const res = await resetLegal(slug, locale);
      if (!res.ok) return setError(t(res.error));
      toast(t("admin.legal.resetDone"));
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-surface p-4 text-xs text-muted shadow-card ring-1 ring-line">
        <p className="font-mono text-ink">{t(agreement ? "admin.legal.howToAgreement" : "admin.legal.howTo")}</p>
        {placeholders.length > 0 && (
          <p className="mt-1">
            {t("admin.legal.placeholders")} <span className="font-mono text-ink">{placeholders.map((n) => `{${n}}`).join(" ")}</span>
          </p>
        )}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div>
          <label htmlFor="legal-text" className="text-sm font-semibold text-ink">
            {t("admin.legal.text")}
          </label>
          <textarea
            id="legal-text"
            lang={locale}
            value={text}
            readOnly={readOnly}
            onChange={(e) => setText(e.target.value)}
            spellCheck
            className="mt-1 block h-[60vh] min-h-80 w-full resize-y rounded-2xl bg-surface p-4 font-mono text-[0.8125rem] leading-relaxed text-ink shadow-card ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">{t("admin.legal.preview")}</p>
          <div lang={locale} className="mt-1 h-[60vh] min-h-80 overflow-y-auto rounded-2xl bg-surface p-5 text-sm leading-relaxed text-ink shadow-card ring-1 ring-line">
            {!parsed.ok ? (
              <Alert tone="danger">{t(`admin.legal.problems.${parsed.problem}`)}</Alert>
            ) : "agreement" in parsed ? (
              <div className="space-y-3">
                <h2 className="text-xl font-bold">{parsed.agreement.title}</h2>
                <p>{parsed.agreement.intro}</p>
                <ol className="list-decimal space-y-1.5 pl-5">
                  {parsed.agreement.clauses.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ol>
                <p className="text-muted">{parsed.agreement.closing}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold">{parsed.doc.title}</h2>
                  <p className="mt-1 text-muted">{parsed.doc.description}</p>
                </div>
                {parsed.doc.summary.length > 0 && (
                  <div className="rounded-xl bg-canvas p-3">
                    <p className="font-semibold">{t("admin.legal.inShort")}</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {parsed.doc.summary.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {parsed.doc.sections.map((s) => (
                  <section key={s.id} className="space-y-2">
                    <h3 className="font-semibold">
                      {s.heading} <span className="font-mono text-xs font-normal text-muted">#{s.id}</span>
                    </h3>
                    {s.blocks.map((b, i) => (
                      <Block key={i} b={b} />
                    ))}
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}
      {!readOnly && (
        <div className="sticky bottom-3 flex flex-wrap items-center gap-3 rounded-2xl bg-surface/95 p-3 shadow-raised ring-1 ring-line backdrop-blur">
          {agreement && (
            <label className="flex min-h-11 max-w-md items-start gap-2 text-sm text-ink">
              <input type="checkbox" checked={resign} onChange={(e) => setResign(e.target.checked)} className="mt-1 size-4 shrink-0 accent-[var(--color-primary)]" />
              <span>
                <span className="font-semibold">{t("admin.legal.resign")}</span>
                <span className="block text-xs text-muted">{t("admin.legal.resignHint")}</span>
              </span>
            </label>
          )}
          <Button onClick={publish} loading={busy} disabled={!parsed.ok || (!dirty && !resign)}>
            {t("admin.legal.publish")}
          </Button>
          {dirty && (
            <Button variant="ghost" onClick={() => (setText(initial), setError(null))} disabled={busy}>
              {t("common.cancel")}
            </Button>
          )}
          {edited && !dirty && (
            <Button variant="ghost" onClick={reset} disabled={busy}>
              {t("admin.legal.reset")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
