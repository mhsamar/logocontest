/* eslint-disable @next/next/no-img-element */
import { cx } from "@/lib/cx";

/** A mark used in the design's placeholder tiles (the brand's "L" + "C"). */
export const LcMark = ({ width }: { width: number | string }) => (
  <svg aria-hidden width={width} viewBox="0 0 60 48">
    <path d="M8 4v38h18" fill="none" stroke="#fff" strokeWidth="9" />
    <path d="M54 16H38v16h16" fill="none" stroke="#fff" strokeWidth="9" />
  </svg>
);

/** The design's placeholder logos (owner, 2026-10-10): shown only where we have no real winning logo yet. */
export const PLACEHOLDERS: { bg: string; art: (size: "sm" | "lg") => React.ReactNode }[] = [
  {
    bg: "#10203A",
    art: (s) => (
      <span className="flex items-center justify-center rounded-full border-[1.5px] border-[#E9C766] text-[#E9C766]" style={{ width: s === "lg" ? 70 : 54, height: s === "lg" ? 70 : 54, font: `500 ${s === "lg" ? 28 : 22}px Georgia, serif` }}>
        LC
      </span>
    ),
  },
  { bg: "#8B0000", art: (s) => <LcMark width={s === "lg" ? 56 : 46} /> },
  {
    bg: "#F06A3C",
    art: () => (
      <svg aria-hidden width="50%" viewBox="0 0 48 48" fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 38L24 10l16 28" />
        <path d="M16 30h16" />
      </svg>
    ),
  },
  {
    bg: "#F6C23A",
    art: () => (
      <svg aria-hidden width="50%" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="19" fill="none" stroke="#111216" strokeWidth="6" strokeDasharray="90 30" transform="rotate(35 24 24)" />
        <circle cx="24" cy="24" r="6" fill="#111216" />
      </svg>
    ),
  },
  {
    bg: "#6B55E8",
    art: () => (
      <svg aria-hidden width="52%" viewBox="0 0 48 48" fill="none" stroke="#FFFFFF" strokeWidth="5.5" strokeLinecap="round">
        <path d="M24 6v36M8.4 15l31.2 18M39.6 15L8.4 33" />
      </svg>
    ),
  },
  { bg: "#111216", art: (s) => <span className="lc-d text-white" style={{ fontSize: s === "lg" ? 46 : 30, fontWeight: 600, letterSpacing: "-0.08em" }}>lc.</span> },
  {
    bg: "#DDF1E3",
    art: () => (
      <svg aria-hidden width="48%" viewBox="0 0 48 48" fill="none" stroke="#1D5B37" strokeWidth="5" strokeLinecap="round">
        <path d="M10 38c0-16 8-28 28-28" />
        <path d="M10 38c10 0 18-4 22-12" />
      </svg>
    ),
  },
  {
    bg: "#D9E6F7",
    art: () => (
      <svg aria-hidden width="48%" viewBox="0 0 48 48" fill="#24406B">
        <rect x="6" y="6" width="16" height="16" rx="4" />
        <rect x="26" y="6" width="16" height="16" rx="8" />
        <rect x="6" y="26" width="16" height="16" rx="8" />
        <rect x="26" y="26" width="16" height="16" rx="4" />
      </svg>
    ),
  },
  { bg: "#FFFFFF", art: (s) => <span className="text-[#111216] italic" style={{ font: `italic 500 ${s === "lg" ? 54 : 34}px Georgia, serif` }}>Lc</span> },
  {
    bg: "#10203A",
    art: () => (
      <svg aria-hidden width="54%" viewBox="0 0 48 48" fill="none" stroke="#7CCBFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 34l10-18 8 12 6-8 8 14" />
      </svg>
    ),
  },
  { bg: "#7A1E12", art: (s) => <LcMark width={s === "lg" ? 56 : 38} /> },
];

/**
 * One logo tile: the real winning logo when there is one, else placeholder `fallback`.
 * Size, shape and position come from `className` / `style`, as each spot in the design differs.
 */
export function LogoTile({ src, fallback, size = "sm", className, style }: { src?: string | null; fallback: number; size?: "sm" | "lg"; className?: string; style?: React.CSSProperties }) {
  const ph = PLACEHOLDERS[fallback % PLACEHOLDERS.length];
  return (
    <span className={cx("lc-ph flex items-center justify-center", className)} style={{ background: src ? "#FFFFFF" : ph.bg, ...style }}>
      {src ? <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" /> : ph.art(size)}
    </span>
  );
}
