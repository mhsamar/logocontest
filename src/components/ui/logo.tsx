/* eslint-disable @next/next/no-img-element */
import { cx } from "@/lib/cx";

/**
 * The owner's logo pack (owner, 2026-10-08), files in public/brand/:
 * logo-full(-white).png is the "lc LOGO CONTEST.bd" lockup, logo-icon(-white).png the
 * "lc" mark, and logo-icon-tile.png the white mark on a maroon square (app icon).
 * "inverted" picks the white files for dark backgrounds.
 */
export function LogoMark({ className = "size-8", inverted = false }: { className?: string; inverted?: boolean }) {
  return <img src={inverted ? "/brand/logo-icon-white.png" : "/brand/logo-icon.png"} alt="" className={cx("object-contain", className)} aria-hidden />;
}

export function Wordmark({ inverted = false, className }: { inverted?: boolean; className?: string }) {
  return (
    <img
      src={inverted ? "/brand/logo-full-white.png" : "/brand/logo-full.png"}
      alt="logocontest.bd"
      width={501}
      height={74}
      className={cx("h-7 w-auto sm:h-9", className)}
    />
  );
}
