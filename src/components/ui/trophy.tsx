import { useId } from "react";
import { cx } from "@/lib/cx";

/**
 * Gold trophy (UI-JOURNEY §1.3, owner 2026-10-08): our own drawing — a gold
 * cup with a shine, a red ribbon and a white star on a dark base, with tiny
 * sparkles. Decorative; pair it with a text label such as "Winner".
 */
export function TrophyIcon({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const gold = `trophy-gold-${id}`;
  const goldDark = `trophy-gold-dark-${id}`;
  const base = `trophy-base-${id}`;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={gold} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#B07206" />
          <stop offset="0.3" stopColor="#FFE9A6" />
          <stop offset="0.55" stopColor="#F5C23E" />
          <stop offset="1" stopColor="#A2640A" />
        </linearGradient>
        <linearGradient id={goldDark} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#F2B930" />
          <stop offset="1" stopColor="#9C5E08" />
        </linearGradient>
        <linearGradient id={base} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#4A2508" />
          <stop offset="1" stopColor="#200E01" />
        </linearGradient>
      </defs>

      {/* sparkles */}
      <path d="M9 9l1 2.5L12.5 12.5 10 13.5 9 16 8 13.5 5.5 12.5 8 11.5Z" fill="#FFE9A6" />
      <path d="M55 5l.8 2 2 .8-2 .8L55 10.6l-.8-2-2-.8 2-.8Z" fill="#FFE9A6" />
      <path d="M57.5 27l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6Z" fill="#F5C23E" />

      {/* handles */}
      <path d="M18 15h-6.5a2 2 0 0 0-2 2.2C10.3 25 14.3 30 20 31.3" fill="none" stroke={`url(#${gold})`} strokeWidth="3.6" strokeLinecap="round" />
      <path d="M46 15h6.5a2 2 0 0 1 2 2.2C53.7 25 49.7 30 44 31.3" fill="none" stroke={`url(#${gold})`} strokeWidth="3.6" strokeLinecap="round" />

      {/* cup */}
      <path d="M16.5 10h31v10.5C47.5 30 40.6 37 32 37S16.5 30 16.5 20.5Z" fill={`url(#${gold})`} />
      <ellipse cx="32" cy="10" rx="15.5" ry="2.6" fill="#FFF2C2" />
      <path d="M21.5 13.5c0 9 1.8 15.2 5 19.5" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="2.4" strokeLinecap="round" />

      {/* red ribbon with tails */}
      <path d="M15.8 17.5h32.4l-1.4 5H17.2Z" fill="#C0141E" />
      <path d="M15.8 17.5h32.4l-.4 1.4H16.2Z" fill="#E8343E" />
      <path d="M46.2 20.6l6.6 2.2-2.4 2.6 2.9 3-7.4-2.1Z" fill="#8B0000" />

      {/* star */}
      <path d="M32 24.6l1.7 3.4 3.7.5-2.7 2.6.7 3.7L32 33l-3.4 1.8.7-3.7-2.7-2.6 3.7-.5Z" fill="#fff" />

      {/* stem and knob */}
      <path d="M29 36.5h6l-.9 6h-4.2Z" fill={`url(#${goldDark})`} />
      <ellipse cx="32" cy="43.3" rx="5.4" ry="2" fill={`url(#${gold})`} />

      {/* base */}
      <path d="M22.5 46h19l2 9h-23Z" fill={`url(#${base})`} />
      <rect x="22" y="45" width="20" height="2.4" rx="1.2" fill={`url(#${gold})`} />
      <rect x="27" y="49.5" width="10" height="3" rx="1" fill={`url(#${gold})`} opacity="0.9" />
    </svg>
  );
}

/** Small floating trophy for the corner of a winning logo. */
export function WinnerTrophy({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      className={cx(
        "pointer-events-none flex animate-float-soft items-center justify-center rounded-full bg-gradient-to-b from-white to-cream shadow-raised ring-2 ring-white",
        size === "sm" ? "size-8" : size === "lg" ? "size-14" : "size-11",
        className,
      )}
      aria-hidden
    >
      <TrophyIcon className={size === "sm" ? "size-6" : size === "lg" ? "size-11" : "size-8"} />
    </span>
  );
}

/** The "Winner" label on a winning design (owner, 2026-10-10: bigger, with the trophy), for cards and the viewer. */
export function WinnerBadge({ label, size = "md", className }: { label: string; size?: "md" | "lg"; className?: string }) {
  return (
    <span
      className={cx(
        "pointer-events-none inline-flex items-center gap-1.5 rounded-full bg-[image:var(--gradient-red)] font-bold uppercase tracking-wide text-white shadow-[0_6px_16px_rgb(139_0_0/0.35)] ring-2 ring-white",
        size === "lg" ? "py-1.5 pl-2 pr-4 text-[15px]" : "py-1 pl-1.5 pr-3 text-[12.5px]",
        className,
      )}
    >
      <TrophyIcon className={size === "lg" ? "size-6" : "size-5"} />
      {label}
    </span>
  );
}
