import Link from "next/link";
import { DesignLink } from "@/components/admin/design-viewer";
import type { AdminEntry } from "@/lib/admin/moderation";

/** A design as admins see it: cover, contest, number and designer, each linking onward. */
export function EntryThumb({ entry, size = "md" }: { entry: AdminEntry; size?: "md" | "lg" }) {
  return (
    <div className="min-w-0">
      <DesignLink entryId={entry.id} className="block overflow-clip rounded-xl bg-canvas ring-1 ring-line">
        {entry.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.coverUrl} alt="" loading="lazy" className={size === "lg" ? "aspect-square w-full object-cover" : "aspect-square w-full object-cover"} />
        ) : (
          <span className="flex aspect-square items-center justify-center text-sm text-muted">#{entry.number}</span>
        )}
      </DesignLink>
      <p className="mt-1.5 truncate text-sm font-semibold text-ink">
        <Link href={`/admin/contests/${entry.contest.slug}`} className="hover:text-primary">
          {entry.contest.brand}
        </Link>{" "}
        <span className="text-muted">#{entry.number}</span>
      </p>
      <p className="truncate text-xs text-muted">
        <Link href={`/admin/users/${entry.designer.id}`} className="hover:text-primary">
          {entry.designer.username ? `@${entry.designer.username}` : entry.designer.name}
        </Link>
      </p>
    </div>
  );
}
