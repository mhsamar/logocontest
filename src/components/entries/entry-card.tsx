/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { WinnerBadge, WinnerTrophy } from "@/components/ui/trophy";
import { cx } from "@/lib/cx";
import type { EntryCard as Entry } from "@/lib/entries/queries";
import type { Translate } from "@/lib/i18n/translate";

function Stars({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 20 20" className={cx("size-3", i <= value ? "text-accent" : "text-line")} fill="currentColor">
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.8l-5.2 2.8 1-5.8L1.5 7.7l5.9-.9Z" />
        </svg>
      ))}
    </span>
  );
}

/**
 * The mockups of one design in a square, like the reference (owner, 2026-10-08):
 * 1 fills it, 2 side by side, 3 as one large and two small, 4+ as a 2×2 grid with "+N".
 */
export function Collage({ previews, total }: { previews: string[]; total: number }) {
  const shown = previews.slice(0, 4);
  const img = (src: string, i: number, className?: string) => <img key={i} src={src} alt="" className={cx("h-full w-full object-cover", className)} loading="lazy" />;
  if (shown.length <= 1) return <div className="aspect-square bg-canvas">{shown[0] && img(shown[0], 0)}</div>;
  if (shown.length === 2) return <div className="grid aspect-square grid-cols-2 gap-0.5 bg-white">{shown.map((s, i) => img(s, i))}</div>;
  if (shown.length === 3)
    return (
      <div className="grid aspect-square grid-cols-2 grid-rows-2 gap-0.5 bg-white">
        {img(shown[0], 0, "row-span-2")}
        {img(shown[1], 1)}
        {img(shown[2], 2)}
      </div>
    );
  return (
    <div className="grid aspect-square grid-cols-2 grid-rows-2 gap-0.5 bg-white">
      {shown.map((s, i) => (
        <div key={i} className="relative min-h-0">
          {img(s, i)}
          {i === 3 && total > 4 && <span className="absolute inset-0 flex items-center justify-center bg-ink/55 text-xl font-bold text-white">+{total - 4}</span>}
        </div>
      ))}
    </div>
  );
}

/** One card in the Entries tab grid (UI-JOURNEY §1.3 entry card). Opens P-04. */
export function EntryCard({ entry, href, t, fmt }: { entry: Entry; href: string; t: Translate; fmt: (n: number) => string }) {
  const winner = entry.status === "winner";
  return (
    <Link
      href={href}
      scroll={false}
      aria-label={t("entry.open", { n: fmt(entry.number) })}
      className={cx(
        "group relative block overflow-hidden rounded-xl bg-surface shadow-card ring-1 transition-shadow hover:shadow-raised",
        winner ? "ring-2 ring-primary" : "ring-line hover:ring-primary",
      )}
    >
      <div className="relative">
        <Collage previews={entry.previews} total={entry.imageCount} />
        {winner && (
          <>
            <WinnerBadge label={t("entry.winner")} className="absolute left-2.5 top-2.5" />
            <WinnerTrophy className="absolute right-2.5 top-2.5" />
          </>
        )}
        {!winner && entry.mine && <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-white">{t("entry.yours")}</span>}
        {entry.status === "rejected" && <span className="absolute right-2 top-2 rounded-full bg-danger px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-white">{t("entry.rejected")}</span>}
      </div>
      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-ink">#{fmt(entry.number)}</span>
          <span className="flex items-center gap-2">
            {entry.rating ? <Stars value={entry.rating} /> : null}
            {winner && entry.likes > 0 && (
              <span className="flex items-center gap-0.5 text-xs font-semibold text-primary" aria-label={t("likes.count", { n: fmt(entry.likes) })}>
                <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden>
                  <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.6 1.2 5 3 1.4-1.8 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2Z" />
                </svg>
                {fmt(entry.likes)}
              </span>
            )}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted">
          {entry.designer ? (entry.designer.username ? `@${entry.designer.username}` : entry.designer.name) : t("entry.hiddenName")}
        </p>
        <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
          <span>{entry.imageCount === 1 ? t("entry.oneMockup") : t("entry.mockups", { n: fmt(entry.imageCount) })}</span>
          <span className="flex items-center gap-1" aria-label={`${t("entry.comments.title")}: ${fmt(entry.commentCount)}`}>
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.7A8 8 0 1 1 21 12Z" strokeLinejoin="round" />
            </svg>
            {fmt(entry.commentCount)}
          </span>
        </div>
      </div>
    </Link>
  );
}
