"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Logged-in replacement for "Log In" (UI-JOURNEY §2.1). Items are passed in by
 * the header; the log-out form is passed as `footer`.
 */
export function AvatarMenu({
  name,
  label,
  items,
  footer,
}: {
  name: string;
  label: string;
  items: { href: string; label: string }[];
  footer: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="flex size-11 items-center justify-center rounded-full"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary-dark">
          {initials || "?"}
        </span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg bg-surface py-1 shadow-raised ring-1 ring-line animate-fade-in">
          <p className="truncate border-b border-line px-4 py-2.5 text-sm font-medium text-ink">{name}</p>
          {items.map((item) => (
            <Link key={item.href} role="menuitem" href={item.href} className="flex min-h-11 items-center px-4 text-sm text-ink hover:bg-canvas">
              {item.label}
            </Link>
          ))}
          <div className="border-t border-line pt-1">{footer}</div>
        </div>
      )}
    </div>
  );
}
