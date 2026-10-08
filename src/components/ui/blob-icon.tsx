import { cx } from "@/lib/cx";

/**
 * Soft duotone "blob" icons for feature cards (UI-JOURNEY §1.1, ofsp_ce
 * reference): simple overlapping shapes in gold, sky, rose and red. Decorative.
 */
const SKY = "#8EC8F5";
const SKY_LIGHT = "#CFE6FF";
const GOLD = "#F5C23E";
const ROSE = "#FFB3C4";
const RED = "var(--color-primary)";

const SHAPES = {
  sun: (
    <>
      <path d="M10 34a22 22 0 0 0 44 0" fill="none" stroke={SKY_LIGHT} strokeWidth="6" strokeLinecap="round" />
      <circle cx="32" cy="28" r="14" fill={GOLD} />
    </>
  ),
  lens: (
    <>
      <circle cx="30" cy="28" r="16" fill={SKY} />
      <path d="M40 34l8 4-4 8-8-4Z" fill={GOLD} />
      <path d="M40 34l-4 8-3-6Z" fill={RED} opacity="0.85" />
    </>
  ),
  dome: (
    <>
      <path d="M14 30a18 18 0 0 1 36 0Z" fill={SKY_LIGHT} />
      <path d="M20 38a12 12 0 0 1 24 0Z" fill={GOLD} />
    </>
  ),
  petals: (
    <>
      <circle cx="26" cy="30" r="13" fill={ROSE} />
      <circle cx="38" cy="30" r="13" fill={GOLD} opacity="0.9" />
      <circle cx="32" cy="22" r="6" fill="#fff" opacity="0.85" />
    </>
  ),
} as const;

export type BlobShape = keyof typeof SHAPES;

export function BlobIcon({ shape, className }: { shape: BlobShape; className?: string }) {
  return (
    <svg viewBox="0 0 64 56" className={cx("h-14 w-16", className)} aria-hidden>
      {SHAPES[shape]}
    </svg>
  );
}
