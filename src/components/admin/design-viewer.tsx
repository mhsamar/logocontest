"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { loadAdminDesign, type AdminDesign } from "@/lib/admin/design-view";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { AdminIcon } from "./icons";
import { IdChip, Pill, type PillTone } from "./ui";

const STATUS_TONE: Record<string, PillTone> = { active: "good", winner: "gold", rejected: "neutral", withdrawn: "neutral", removed: "bad", forfeited: "warn" };

/**
 * A design link inside the admin panel (owner, 2026-10-10): opens the design on top of the page instead of
 * going to the public contest page; closing it leaves the admin exactly where they were. Ctrl/⌘-click or
 * middle-click opens the same design as its own admin page.
 */
export function DesignLink({ entryId, className, label, children }: { entryId: string; className?: string; label?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <a
        href={`/admin/designs/${entryId}`}
        aria-label={label}
        className={className}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          setOpen(true);
        }}
      >
        {children}
      </a>
      {open && <DesignViewer entryId={entryId} onClose={() => setOpen(false)} />}
    </>
  );
}

function DesignViewer({ entryId, onClose }: { entryId: string; onClose: () => void }) {
  const { t } = useI18n();
  const [id, setId] = useState(entryId);
  const [design, setDesign] = useState<AdminDesign | null | "loading">("loading");

  useEffect(() => {
    let stale = false;
    loadAdminDesign(id).then((d) => !stale && setDesign(d));
    return () => {
      stale = true;
    };
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = before;
    };
  }, [onClose]);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={design && design !== "loading" ? t("admin.entries.designNo", { n: String(design.number) }) : t("admin.design.loading")} className="fixed inset-0 z-[90] flex bg-ink/55 sm:p-4 lg:p-6" onClick={onClose}>
      <div className="relative mx-auto flex w-full max-w-[1280px] overflow-hidden bg-surface shadow-[0_30px_80px_rgb(17_18_22/0.35)] sm:rounded-[20px]" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("admin.design.close")}
          className="absolute right-3 top-3 z-20 flex size-11 items-center justify-center rounded-full bg-surface/95 text-ink shadow-[0_4px_14px_rgb(17_18_22/0.15)] ring-1 ring-adm-line hover:text-primary"
        >
          <AdminIcon name="close" size={20} />
        </button>
        {design === "loading" ? (
          <p className="m-auto p-10 text-muted">{t("admin.design.loading")}</p>
        ) : design === null ? (
          <p className="m-auto p-10 text-muted">{t("admin.design.notFound")}</p>
        ) : (
          <DesignBody key={design.id} design={design} onOpen={(next) => (setDesign("loading"), setId(next))} />
        )}
      </div>
    </div>,
    document.body,
  );
}

/** The viewer's content; also used by the full admin page for one design. */
export function DesignBody({ design, onOpen }: { design: AdminDesign; onOpen?: (entryId: string) => void }) {
  const { t, locale } = useI18n();
  const [i, setI] = useState(0);
  const total = design.images.length;
  const go = (d: number) => setI((x) => (total ? (x + d + total) % total : 0));
  const when = (iso: string) => new Date(iso).toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });
  const designer = design.designer.username ? `@${design.designer.username}` : design.designer.name;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const image = design.images[i];
  return (
    <div className="flex w-full flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      {/* Images */}
      <div className="relative flex shrink-0 flex-col bg-adm-bg lg:min-w-0 lg:flex-1">
        <div className="relative flex aspect-square items-center justify-center p-4 sm:p-8 lg:aspect-auto lg:flex-1">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image.url} alt={t("admin.entries.designNo", { n: String(design.number) })} className="max-h-full max-w-full rounded-[18px] object-contain shadow-[0_18px_40px_rgb(17_18_22/0.12)] lg:max-h-[calc(100dvh-12rem)]" />
          ) : (
            <span className="text-muted">{t("admin.entries.noImage")}</span>
          )}
          {total > 1 && (
            <>
              <button type="button" onClick={() => go(-1)} aria-label={t("admin.design.prev")} className="absolute left-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-ink shadow-[0_4px_14px_rgb(17_18_22/0.15)] hover:text-primary">
                <AdminIcon name="chevron" size={20} className="rotate-180" />
              </button>
              <button type="button" onClick={() => go(1)} aria-label={t("admin.design.next")} className="absolute right-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-ink shadow-[0_4px_14px_rgb(17_18_22/0.15)] hover:text-primary">
                <AdminIcon name="chevron" size={20} />
              </button>
            </>
          )}
        </div>
        {total > 1 && (
          <div className="flex justify-center gap-2 overflow-x-auto px-4 pb-4">
            {design.images.map((img, n) => (
              <button
                key={img.url}
                type="button"
                onClick={() => setI(n)}
                aria-label={t("admin.design.image", { n: String(n + 1), total: String(total) })}
                aria-current={n === i}
                className={cx("relative size-14 shrink-0 overflow-hidden rounded-[10px] ring-2", n === i ? "ring-primary" : "ring-transparent hover:ring-adm-line")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="size-full object-cover" />
                {img.flagged && <span className="absolute right-1 top-1 size-2.5 rounded-full bg-adm-warn ring-2 ring-surface" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Details */}
      <aside className="flex w-full shrink-0 flex-col border-adm-line lg:w-[400px] lg:overflow-y-auto lg:border-l">
        <div className="border-b border-adm-line-soft p-5 pr-16">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="m-0 text-[24px] font-semibold tracking-[-0.03em]">{t("admin.entries.designNo", { n: String(design.number) })}</h2>
            <Pill tone={STATUS_TONE[design.status] ?? "neutral"}>{t(`admin.entries.statuses.${design.status}` as MessageKey)}</Pill>
          </div>
          <p className="m-0 mt-1 text-[15px] text-muted">
            {t("admin.design.by")}{" "}
            <Link href={`/admin/users/${design.designer.id}`} className="font-bold text-ink hover:text-primary">
              {designer}
            </Link>
            {" · "}
            {when(design.createdAt)}
          </p>
        </div>

        <div className="flex flex-col gap-5 p-5">
          <div>
            <p className="m-0 text-[13px] font-bold uppercase tracking-wide text-adm-soft">{t("admin.design.contest")}</p>
            <Link href={`/admin/contests/${design.contest.slug}`} className="mt-1.5 flex flex-wrap items-center gap-2 text-[17px] font-bold hover:text-primary">
              {design.contest.brand}
              <IdChip prefix="LC" n={design.contest.number} />
            </Link>
          </div>

          {design.duplicateOf && (
            <div className="rounded-[12px] bg-adm-warn-bg p-3.5 text-[14.5px] text-adm-warn">
              <p className="m-0 font-bold">{t("admin.design.flagged")}</p>
              <p className="m-0 mt-1">
                {t("admin.design.flaggedOf", { brand: design.duplicateOf.brand, n: String(design.duplicateOf.number) })}{" "}
                {onOpen ? (
                  <button type="button" onClick={() => onOpen(design.duplicateOf!.id)} className="font-bold underline">
                    {t("admin.design.seeOriginal")}
                  </button>
                ) : (
                  <Link href={`/admin/designs/${design.duplicateOf.id}`} className="font-bold underline">
                    {t("admin.design.seeOriginal")}
                  </Link>
                )}
              </p>
            </div>
          )}

          {design.story && (
            <div>
              <p className="m-0 text-[13px] font-bold uppercase tracking-wide text-adm-soft">{t("admin.design.story")}</p>
              <p className="m-0 mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-adm-strong">{design.story}</p>
            </div>
          )}

          <div>
            <p className="m-0 text-[13px] font-bold uppercase tracking-wide text-adm-soft">{t("admin.design.comments", { n: String(design.comments.length) })}</p>
            {design.comments.length === 0 ? (
              <p className="m-0 mt-1.5 text-[15px] text-muted">{t("admin.design.noComments")}</p>
            ) : (
              <ul className="m-0 mt-2 flex list-none flex-col gap-2.5 p-0">
                {design.comments.map((c) => (
                  <li key={c.id} className={cx("rounded-[12px] bg-adm-bg p-3", c.hidden && "opacity-60")}>
                    <p className="m-0 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
                      <strong className="text-ink">{c.name}</strong>
                      {c.role && <span>{t(`admin.users.roles.${c.role}` as MessageKey)}</span>}
                      {c.hidden && <Pill tone="neutral">{t("admin.design.hidden")}</Pill>}
                      <span className="ml-auto">{when(c.at)}</span>
                    </p>
                    <p className="m-0 mt-1 whitespace-pre-wrap text-[14.5px] text-ink">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-2 border-t border-adm-line-soft p-5">
          <Link href={`/admin/contests/${design.contest.slug}`} className="inline-flex h-[46px] items-center justify-center gap-2 rounded-[12px] bg-primary px-4 text-[15px] font-bold text-white hover:bg-adm-deep">
            <AdminIcon name="contests" size={17} />
            {t("admin.design.openContest")}
          </Link>
          <div className="flex gap-2">
            <Link href={`/admin/users/${design.designer.id}`} className="inline-flex h-[46px] flex-1 items-center justify-center gap-2 rounded-[12px] border border-adm-line px-3 text-[15px] font-bold text-adm-strong hover:border-primary hover:text-primary">
              <AdminIcon name="users" size={17} />
              {t("admin.design.openDesigner")}
            </Link>
            <a
              href={`/contest/${design.contest.slug}?tab=entries&entry=${design.number}`}
              target="_blank"
              rel="noopener"
              className="inline-flex h-[46px] flex-1 items-center justify-center gap-2 rounded-[12px] border border-adm-line px-3 text-[15px] font-bold text-adm-strong hover:border-primary hover:text-primary"
            >
              {t("admin.design.onSite")}
              <AdminIcon name="external" size={16} />
            </a>
          </div>
        </div>
      </aside>
    </div>
  );
}
