/* eslint-disable @next/next/no-img-element */
import { cx } from "@/lib/cx";

/**
 * The owner's logo pack (owner, 2026-10-08), files in public/brand/:
 * logo-full(-white).png is the "lc LOGO CONTEST.bd" lockup, logo-icon(-white).png the
 * "lc" mark, and logo-icon-tile.png the white mark on a maroon square (app icon).
 * logo-wordmark(-white).png is the lockup cropped to its edges, for the header and footer.
 * "inverted" picks the white files for dark backgrounds.
 */
export function LogoMark({ className = "size-8", inverted = false }: { className?: string; inverted?: boolean }) {
  return <img src={inverted ? "/brand/logo-icon-white.png" : "/brand/logo-icon.png"} alt="" className={cx("object-contain", className)} aria-hidden />;
}

/** `src`: the logo an admin uploaded (A-17); without it the built-in lockup shows. */
export function Wordmark({ inverted = false, className, src }: { inverted?: boolean; className?: string; src?: string | null }) {
  if (src) return <img src={src} alt="logocontest.bd" className={cx("h-[22px] w-auto max-w-[11rem] object-contain object-left sm:h-[28px] sm:max-w-[14rem]", className)} />;
  return (
    // Cropped copies of the lockup without the file's empty margins, so the logo lines up with the
    // edge of the header and footer (owner, 2026-10-08). Same size on screen as before.
    <img
      src={inverted ? "/brand/logo-wordmark-white.png" : "/brand/logo-wordmark.png"}
      alt="logocontest.bd"
      width={405}
      height={47}
      className={cx("h-[18px] w-auto sm:h-[23px]", className)}
    />
  );
}
