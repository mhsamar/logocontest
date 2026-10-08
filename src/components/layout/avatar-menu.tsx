"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Logged-in replacement for "Log In" (UI-JOURNEY §2.1). Items are passed in by
 * the header; the log-out form is passed as `footer`.
 */
export function AvatarMenu({
  name,
  avatarUrl,
  label,
  items,
  footer,
}: {
  name: string;
  avatarUrl: string | null;
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="flex size-11 items-center justify-center rounded-full transition-transform duration-200 hover:scale-105 active:scale-95"
      >
        <Avatar name={name} url={avatarUrl} className="size-9 text-sm" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-56 origin-top-right animate-pop-in overflow-hidden rounded-2xl bg-surface py-1 shadow-raised ring-1 ring-line"
        >
          <p className="truncate border-b border-line px-4 py-2.5 text-sm font-medium text-ink">{name}</p>
          {items.map((item, i) => (
            <Link
              key={item.href}
              role="menuitem"
              href={item.href}
              className="flex min-h-11 animate-item-in items-center px-4 text-sm text-ink transition-[background-color,padding] duration-200 hover:bg-canvas hover:pl-5"
              style={{ animationDelay: `${60 + i * 40}ms` }}
            >
              {item.label}
            </Link>
          ))}
          <div className="border-t border-line pt-1">{footer}</div>
        </div>
      )}
    </div>
  );
}
