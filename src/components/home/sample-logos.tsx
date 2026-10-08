/* eslint-disable @next/next/no-img-element */
/**
 * Example logos used in every product mock (hero contest, How it works, Why us,
 * profile and wallet mocks). Owner, 2026-10-08: our own "lc" logo pack plus the
 * lettermark examples the owner chose, for the example contest "LOGO CONTEST BD".
 * Index 0 is always the winner.
 */
export const SAMPLE_LOGO_SRC = [
  "/brand/logo-icon-tile.png",
  "/examples/hero/entry-2.jpg",
  "/examples/hero/entry-3.jpg",
  "/examples/hero/entry-4.jpg",
  "/examples/hero/entry-5.jpg",
  "/brand/logo-icon.png",
];

// Transparent PNGs are shown whole with some padding; photos fill the tile.
export const SAMPLE_LOGOS: React.ReactNode[] = SAMPLE_LOGO_SRC.map((src) => (
  <img
    key={src}
    src={src}
    alt=""
    className={src === "/brand/logo-icon.png" ? "h-full w-full bg-white object-contain p-[14%]" : "h-full w-full bg-white object-cover"}
    loading="lazy"
    aria-hidden
  />
));
