import Link from "@/components/ui/link";
import { DesignLink } from "@/components/admin/design-viewer";
import { AdminIcon, type AdminIconName } from "@/components/admin/icons";
import { Pill, type PillTone } from "@/components/admin/ui";
import type { AdminUserDetail } from "@/lib/admin/users";
import { cx } from "@/lib/cx";
import type { MessageKey, Translate } from "@/lib/i18n/translate";

const ENTRY_TONE: Record<string, PillTone> = { winner: "gold", active: "good", removed: "bad", held: "warn" };

/** One line of a person's Activity; design events carry the design's first picture (owner, 2026-10-25). */
export type TimelineItem = { at: Date; icon: AdminIconName; title: string; line?: string; href?: string; thumb?: { url: string | null; n: number } };

/** A person's Activity on their admin profile, newest first. */
export function UserTimeline({ items, when, num }: { items: TimelineItem[]; when: (d: Date) => string; num: (n: number) => string }) {
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {items.map((x, i) => {
        const body = (
          <>
            <span className="w-[86px] shrink-0 pt-1 text-sm font-semibold tabular-nums text-muted">{when(x.at)}</span>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#f0f1f4] text-adm-strong">
              <AdminIcon name={x.icon} size={16} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <strong className="text-[15.5px]">{x.title}</strong>
              {x.line && <span className="text-[14.5px] text-muted">{x.line}</span>}
            </span>
            {x.thumb && (
              <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-white ring-1 ring-adm-line sm:size-16" data-design-thumb>
                {x.thumb.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={x.thumb.url} alt="" loading="lazy" className="size-full object-contain" />
                ) : (
                  <span className="text-sm font-bold text-muted">#{num(x.thumb.n)}</span>
                )}
              </span>
            )}
          </>
        );
        return (
          <li key={i} className="border-t border-adm-line-soft first:border-t-0">
            {x.href ? (
              <Link href={x.href} className="flex gap-3 py-3.5 hover:bg-[#fafafb]">
                {body}
              </Link>
            ) : (
              <div className="flex gap-3 py-3.5">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** A designer's designs with their pictures (owner, 2026-10-25); a tap opens one, withdrawn and removed ones too (faded). */
export function DesignerDesigns({ entries, canOpen, t, num, when, day }: { entries: AdminUserDetail["entries"]; canOpen: boolean; t: Translate; num: (n: number) => string; when: (d: Date) => string; day: (d: Date) => string }) {
  return (
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4 p-0" data-designer-designs>
      {entries.map((e) => {
        const name = t("admin.activity.design", { brand: e.brand, n: num(e.number) });
        const gone = e.status === "withdrawn" || e.status === "removed";
        return (
          <li key={e.id} className="flex min-w-0 flex-col gap-1.5">
            {canOpen ? (
              <DesignLink entryId={e.id} label={name} className="block overflow-hidden rounded-[14px] bg-white ring-1 ring-adm-line hover:ring-primary">
                {e.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.coverUrl} alt="" loading="lazy" className={cx("aspect-square w-full object-contain", gone && "opacity-60")} />
                ) : (
                  <span className="flex aspect-square items-center justify-center text-sm font-bold text-muted">#{num(e.number)}</span>
                )}
              </DesignLink>
            ) : (
              // Staff who may not see designs get the number only.
              <span className="flex aspect-square items-center justify-center rounded-[14px] bg-white text-sm font-bold text-muted ring-1 ring-adm-line">#{num(e.number)}</span>
            )}
            <Link href={`/admin/contests/${e.slug}`} className="flex min-w-0 flex-col leading-snug hover:text-primary">
              <strong className="truncate text-[15px]">{e.brand}</strong>
              <span className="text-[13.5px] text-muted">{t("admin.entries.designNo", { n: num(e.number) })}</span>
            </Link>
            <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <Pill tone={ENTRY_TONE[e.status] ?? "neutral"}>{t(`admin.entries.statuses.${e.status}` as MessageKey)}</Pill>
              {day(e.createdAt)}
            </span>
            {e.withdrawnAt && <span className="text-[13.5px] text-muted">{t("admin.users.withdrawnOn", { when: when(e.withdrawnAt) })}</span>}
            {e.removedAt && <span className="text-[13.5px] text-muted">{t("admin.users.designRemovedOn", { when: when(e.removedAt) })}</span>}
          </li>
        );
      })}
    </ul>
  );
}
