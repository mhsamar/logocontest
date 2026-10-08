"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { scanEntry } from "@/lib/entries/review-actions";
import { useI18n } from "@/lib/i18n/client";

type Scan = {
  driver: string;
  createdAt: string;
  full: { url: string }[];
  partial: { url: string }[];
  similar: { url: string }[];
  pages: { url: string; title: string | null }[];
};

/** C-15 Logo Scan (owner, 2026-10-08): web matches for this design, or an offer to unlock it. */
export function ScanPanel({ entryId, unlocked, scan, unlockHref, price }: { entryId: string; unlocked: boolean; scan: Scan | null; unlockHref: string; price: string }) {
  const { t, locale } = useI18n();
  const [result, setResult] = useState<Scan | null>(scan);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const date = (iso: string) => new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

  const run = () =>
    start(async () => {
      setError(null);
      const res = await scanEntry(entryId);
      if (!res.ok) return setError(t(res.error));
      setResult({ ...res.result, createdAt: new Date().toISOString() });
    });

  const thumbs = (title: string, list: { url: string }[]) =>
    list.length > 0 && (
      <div>
        <p className="text-xs font-semibold text-ink">{title}</p>
        <ul className="mt-1.5 grid grid-cols-4 gap-1.5">
          {list.map((img) => (
            <li key={img.url}>
              <a href={img.url} target="_blank" rel="noopener noreferrer nofollow" className="block aspect-square overflow-hidden rounded-md bg-canvas ring-1 ring-line hover:ring-primary">
                <img src={img.url} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <section className="rounded-xl bg-gradient-to-br from-[#f2fbf6] to-white p-3.5 ring-1 ring-[#c9efdc]">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-ink">
          <svg viewBox="0 0 24 24" className="size-4 text-[#0f6b45]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="6" />
            <path d="M20 20l-4.3-4.3" />
          </svg>
          {t("manage.scan.title")}
        </h3>
        {result && <span className="text-[0.6875rem] text-muted">{t("manage.scan.checked", { date: date(result.createdAt) })}</span>}
      </div>

      {!unlocked ? (
        <div className="mt-2">
          <p className="text-sm text-muted">{t("manage.scan.locked")}</p>
          <Link href={unlockHref} className="mt-2 inline-flex min-h-10 items-center rounded-full bg-[#0f6b45] px-4 text-sm font-semibold text-white hover:bg-[#0b5536]">
            {t("manage.scan.unlock", { amount: price })}
          </Link>
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          {result &&
            (result.driver === "log" ? (
              <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-ink">{t("manage.scan.devNote")}</p>
            ) : result.full.length + result.partial.length + result.similar.length + result.pages.length === 0 ? (
              <p className="flex items-center gap-2 text-sm font-medium text-success">
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                  <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t("manage.scan.none")}
              </p>
            ) : (
              <>
                {thumbs(t("manage.scan.full"), result.full)}
                {thumbs(t("manage.scan.partial"), result.partial)}
                {thumbs(t("manage.scan.similar"), result.similar)}
                {result.pages.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-ink">{t("manage.scan.pages")}</p>
                    <ul className="mt-1 space-y-1">
                      {result.pages.map((p) => (
                        <li key={p.url}>
                          <a href={p.url} target="_blank" rel="noopener noreferrer nofollow" className="block truncate text-xs text-primary hover:underline">
                            {p.title || p.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ))}
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button variant="secondary" onClick={run} loading={busy}>
            {busy ? t("manage.scan.running") : result ? t("manage.scan.again") : t("manage.scan.run")}
          </Button>
        </div>
      )}
    </section>
  );
}
