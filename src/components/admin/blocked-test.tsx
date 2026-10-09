"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { testBlockedText } from "@/lib/admin/site-actions";
import { useI18n } from "@/lib/i18n/client";
import type { ContactKind } from "@/lib/moderation/contact-filter";

/** A-10 test box: shows whether sample text would be blocked by the no-contact filter. */
export function BlockedTest() {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ kind: ContactKind | null } | null>(null);
  const [busy, start] = useTransition();
  return (
    <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line">
      <h2 className="font-semibold text-ink">{t("admin.terms.test")}</h2>
      <textarea
        value={text}
        onChange={(e) => (setText(e.target.value), setResult(null))}
        rows={3}
        maxLength={2000}
        placeholder={t("admin.terms.testPlaceholder")}
        className="mt-3 block w-full rounded-lg bg-canvas p-3 text-sm text-ink ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={() => start(async () => setResult(await testBlockedText(text)))} loading={busy} disabled={!text.trim()}>
          {t("admin.terms.check")}
        </Button>
        {result &&
          (result.kind ? (
            <p role="status" className="rounded-full bg-danger/10 px-3 py-1 text-sm font-semibold text-danger">
              {t("admin.terms.blocked", { kind: t(`admin.terms.kinds.${result.kind}`) })}
            </p>
          ) : (
            <p role="status" className="rounded-full bg-success/10 px-3 py-1 text-sm font-semibold text-success">
              {t("admin.terms.allowed")}
            </p>
          ))}
      </div>
    </section>
  );
}
