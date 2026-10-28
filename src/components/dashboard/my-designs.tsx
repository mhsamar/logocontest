"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "@/components/ui/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { EntryViewer } from "@/components/entries/entry-viewer";
import { ShareButtons } from "@/components/share/share-buttons";
import { WithdrawButton } from "@/components/entries/withdraw-button";
import { buttonClasses } from "@/components/ui/button";
import type { MyDesign } from "@/lib/designers/profile";
import { WITHDRAWABLE } from "@/lib/entries/rules";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { designPath, designPinPath } from "@/lib/share/links";

type Peek = { url: string; caption: string; label: string | null; left: number; top: number };

const PEEK = 240;

/**
 * D-02 "My contests" (owner, 2026-10-16): every picture of the designer's designs in one contest, in a row. Hovering
 * one shows it large; clicking opens the design right here, and closing comes back to the dashboard. While the
 * contest is open the designer can remove a picture or the whole design from there.
 */
export function MyContestDesigns({ slug, brand, designs, open, className }: { slug: string; brand: string; designs: MyDesign[]; open: boolean; className?: string }) {
  const { t, locale } = useI18n();
  const fmt = (n: number) => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(n);
  const [view, setView] = useState<{ id: string; start: number } | null>(null);
  const [peek, setPeek] = useState<Peek | null>(null);
  const current = view ? designs.find((d) => d.id === view.id) : undefined;

  // A scrolled page leaves the quick view behind: hide it.
  useEffect(() => {
    if (!peek) return;
    const hide = () => setPeek(null);
    window.addEventListener("scroll", hide, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", hide, { capture: true });
  }, [peek]);

  if (designs.length === 0) return <div className={className} />;

  const show = (el: HTMLElement, d: MyDesign, j: number) => {
    if (!window.matchMedia("(hover: hover)").matches) return;
    const r = el.getBoundingClientRect();
    const height = PEEK + 52;
    setPeek({
      url: d.pictures[j].url,
      caption: t("designerDash.designs.quick", { n: fmt(d.number), i: fmt(j + 1), count: fmt(d.pictures.length) }),
      label: d.pictures[j].label,
      left: Math.min(Math.max(8, r.left + r.width / 2 - PEEK / 2), window.innerWidth - PEEK - 8),
      top: r.top > height + 16 ? r.top - height - 8 : r.bottom + 8,
    });
  };

  const statusText = (d: MyDesign) =>
    d.status === "held" ? t("entry.held") : d.status === "rejected" ? t("entry.rejected") : d.status === "winner" ? t("entry.winner") : t("designerDash.designs.live");

  return (
    <div className={className}>
      <ul className="m-0 flex list-none gap-2 overflow-x-auto p-0 pb-1 [scrollbar-width:thin]" data-my-designs>
        {designs.map((d) => (
          <li key={d.id} className={cx("flex shrink-0 items-center gap-1.5 rounded-[14px] p-1.5", d.status === "held" ? "bg-[#fff6d6] ring-1 ring-gold" : "bg-chip")}>
            <span className="px-1 text-xs font-bold tabular-nums text-muted" title={statusText(d)}>
              #{fmt(d.number)}
            </span>
            {d.pictures.map((p, j) => (
              <button
                key={p.id}
                type="button"
                onClick={() => (setPeek(null), setView({ id: d.id, start: j }))}
                onMouseEnter={(e) => show(e.currentTarget, d, j)}
                onMouseLeave={() => setPeek(null)}
                onFocus={(e) => show(e.currentTarget, d, j)}
                onBlur={() => setPeek(null)}
                aria-label={t("designerDash.designs.show", { n: fmt(d.number), i: fmt(j + 1) })}
                className={cx(
                  "block size-12 shrink-0 overflow-hidden rounded-[10px] bg-white ring-2 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-primary",
                  p.doubted ? "ring-danger" : "ring-line",
                )}
              >
                <img src={p.url} alt="" loading="lazy" className="h-full w-full object-contain" />
              </button>
            ))}
          </li>
        ))}
      </ul>

      {peek &&
        createPortal(
          <div className="pointer-events-none fixed z-50 rounded-[18px] bg-surface p-2 shadow-panel ring-1 ring-line" style={{ left: peek.left, top: peek.top, width: PEEK }} aria-hidden>
            <img src={peek.url} alt="" className="aspect-square w-full rounded-[12px] bg-white object-contain" />
            <p className="m-0 mt-1.5 truncate px-1 text-[13px] font-semibold text-ink">{peek.label ?? peek.caption}</p>
            {peek.label && <p className="m-0 truncate px-1 text-xs text-muted">{peek.caption}</p>}
          </div>,
          document.body,
        )}

      {current && view && (
        <EntryViewer
          number={current.number}
          images={current.pictures.map((p) => p.url)}
          labels={current.pictures.map((p) => p.label)}
          doubted={current.pictures.map((p) => p.doubted)}
          start={view.start}
          onClose={() => setView(null)}
          winner={current.status === "winner"}
          byline={brand}
          held={current.status === "held" ? (current.heldAll ? "mine_all" : "mine") : null}
          removable={open && WITHDRAWABLE.includes(current.status) ? { entryId: current.id, pictureIds: current.pictures.map((p) => p.id) } : null}
        >
          {current.status !== "held" && <p className="m-0 mb-4 text-[15px] font-semibold text-ink">{statusText(current)}</p>}
          <Link href={`/contest/${slug}?tab=entries&entry=${current.number}`} className={buttonClasses({ variant: "secondary" })}>
            {t("designerDash.designs.onContest")}
          </Link>
          {/* Share it (owner, 2026-10-18): only when visitors see it too. The viewer opens on a click, so window is there. */}
          {current.shareable && (
            <div className="mt-5" data-entry-share>
              <p className="m-0 mb-2 text-sm font-semibold text-ink">{t("share.design")}</p>
              <ShareButtons
                url={`${window.location.origin}${designPath(slug, current.number)}`}
                media={`${window.location.origin}${designPinPath(slug, current.number)}`}
                text={t(current.status === "winner" ? "share.winnerText" : "share.designText", { n: fmt(current.number), brand })}
              />
            </div>
          )}
          <p className="m-0 mt-5 border-t border-line pt-4 text-sm text-muted">{t(open ? "designerDash.designs.canRemove" : "designerDash.designs.finished")}</p>
          {open && WITHDRAWABLE.includes(current.status) && (
            <div className="mt-2">
              <WithdrawButton entryId={current.id} number={current.number} afterHref="/dashboard" />
            </div>
          )}
        </EntryViewer>
      )}
    </div>
  );
}
