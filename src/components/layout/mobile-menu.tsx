"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cx } from "@/lib/cx";

/** Hamburger button + drop-down panel for phones. Content is rendered by the server header. */
export function MobileMenu({
  openLabel,
  closeLabel,
  links,
  children,
}: {
  openLabel: string;
  closeLabel: string;
  links: { href: string; label: string }[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close whenever the route changes.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? closeLabel : openLabel}
        className="flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-white/70"
      >
        {/* Three lines that turn into an X (UI-JOURNEY §1.5) */}
        <span className="relative block h-4 w-5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cx(
                "absolute left-0 h-0.5 w-5 rounded-full bg-current transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                i === 0 ? "top-0" : i === 1 ? "top-[7px]" : "top-[14px]",
                open && i === 0 && "translate-y-[7px] rotate-45",
                open && i === 1 && "scale-x-0 opacity-0",
                open && i === 2 && "-translate-y-[7px] -rotate-45",
              )}
            />
          ))}
        </span>
      </button>

      <div
        id="mobile-menu"
        hidden={!open}
        className="absolute inset-x-0 top-full mt-2 origin-top animate-pop-in overflow-hidden rounded-2xl bg-surface shadow-panel ring-1 ring-line"
      >
        <nav className="px-4 py-2">
          <ul>
            {links.map((link, i) => (
              <li key={link.href} className="animate-item-in border-b border-line last:border-0" style={{ animationDelay: `${60 + i * 45}ms` }}>
                <Link href={link.href} className={cx("flex min-h-12 items-center text-base font-medium", pathname === link.href ? "text-primary-dark" : "text-ink")}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="animate-item-in space-y-2 px-4 pb-5 pt-2" style={{ animationDelay: `${60 + links.length * 45}ms` }}>
          {children}
        </div>
      </div>
    </div>
  );
}
