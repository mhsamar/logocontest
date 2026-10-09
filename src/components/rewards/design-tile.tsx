import Link from "next/link";
import { cx } from "@/lib/cx";
import type { Translate } from "@/lib/i18n/translate";
import type { WinningDesign } from "@/lib/rewards/queries";
import { LikeButton } from "./like-button";

const MEDAL = ["from-[#f6d98b] to-[#f4bd2f] text-[#5b3a00]", "from-[#eef1f5] to-[#cfd6e0] text-ink", "from-[#f3d2b3] to-[#d89a66] text-[#5b2c06]"];

/** A winning design with its likes (leaderboard, winners gallery). `rank` shows a medal number on the corner. */
export function DesignTile({ d, t, canLike, rank, tall = false }: { d: WinningDesign; t: Translate; canLike: boolean; rank?: number; tall?: boolean }) {
  return (
    <div className="group relative overflow-clip rounded-2xl bg-surface shadow-card ring-1 ring-line transition-[box-shadow,translate] duration-300 hover:-translate-y-1 hover:shadow-raised">
      <Link href={`/contest/${d.contestSlug}?tab=entries&entry=${d.number}`} className="block">
        <span className={cx("block overflow-clip bg-canvas", tall ? "aspect-[4/5]" : "aspect-square")}>
          {d.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.coverUrl} alt={t("winners.alt", { brand: d.brandName })} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]" />
          ) : (
            <span className="flex h-full items-center justify-center text-sm text-muted">{d.brandName}</span>
          )}
        </span>
      </Link>
      {rank !== undefined && (
        <span className={cx("absolute left-2 top-2 flex size-8 items-center justify-center rounded-full bg-gradient-to-br text-sm font-extrabold shadow-card", rank < 3 ? MEDAL[rank] : "from-white to-white text-ink")}>
          {rank + 1}
        </span>
      )}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <Link href={`/contest/${d.contestSlug}?tab=entries&entry=${d.number}`} className="block truncate text-sm font-semibold text-ink hover:text-primary">
            {d.brandName}
          </Link>
          <p className="truncate text-xs text-muted">
            {d.designer ? (
              d.designer.username ? (
                <Link href={`/d/${d.designer.username}`} className="hover:text-primary">
                  @{d.designer.username}
                </Link>
              ) : (
                d.designer.name
              )
            ) : (
              t(`wizard.businessTypes.${d.businessType}`)
            )}
          </p>
        </div>
        <LikeButton entryId={d.entryId} likes={d.likes} liked={d.liked} canLike={canLike} size="sm" />
      </div>
    </div>
  );
}
