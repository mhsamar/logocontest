import Link from "@/components/ui/link";

/**
 * The account part of the phone menu (owner, 2026-10-20: "Saved contests, wallet, profile settings missing on mobile"):
 * every page of the designer's or client's own area, with names, two to a row.
 */
export function DrawerAccount({ title, items }: { title: string; items: { href: string; label: string; badge?: string | null }[] }) {
  if (items.length === 0) return null;
  return (
    <div data-drawer-account>
      <p className="m-0 px-1 pb-2 text-[12.5px] font-bold uppercase tracking-[.08em] text-muted">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        {items.map((i) => (
          <Link key={`${i.href}:${i.label}`} href={i.href} className="flex min-h-11 items-center justify-between gap-1.5 rounded-[14px] border border-line px-3 py-1.5 text-[14.5px] font-semibold leading-tight text-ink hover:border-primary/40 hover:bg-tint hover:text-primary">
            <span className="min-w-0 break-words">{i.label}</span>
            {i.badge && <span className="shrink-0 rounded-full bg-tint px-1.5 text-[11.5px] font-bold text-primary">{i.badge}</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
