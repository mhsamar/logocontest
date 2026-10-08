/* eslint-disable @next/next/no-img-element */
/**
 * Nine example tiles for the home "designers you can trust" section while there
 * are no real winners yet (owner, 2026-10-08): our "lc" logo pack and the
 * lettermark examples the owner chose. Always shown with an "Example" label.
 */
function Photo({ src }: { src: string }) {
  return <img src={src} alt="" className="block aspect-square w-full object-cover" loading="lazy" aria-hidden />;
}

/** A logo file that needs a background and some padding (transparent PNGs). */
function Panel({ src, bg, wide = false }: { src: string; bg: string; wide?: boolean }) {
  return (
    <div className="flex aspect-square w-full items-center justify-center" style={{ background: bg }} aria-hidden>
      <img src={src} alt="" className={wide ? "w-[86%]" : "w-[62%]"} loading="lazy" />
    </div>
  );
}

export const EXAMPLE_WORK: React.ReactNode[][] = [
  [
    <Photo key="tile" src="/brand/logo-icon-tile.png" />,
    <Photo key="wreath" src="/examples/hero/entry-3.jpg" />,
    <Photo key="white-lc" src="/examples/hero/entry-5.jpg" />,
  ],
  [
    <Photo key="tag" src="/examples/hero/entry-2.jpg" />,
    <Panel key="icon" src="/brand/logo-icon.png" bg="#ffffff" />,
    <Photo key="needle" src="/examples/hero/entry-4.jpg" />,
  ],
  [
    <Panel key="full" src="/brand/logo-full.png" bg="#f6efd9" wide />,
    <Panel key="icon-white" src="/brand/logo-icon-white.png" bg="#200e01" />,
    <Panel key="full-white" src="/brand/logo-full-white.png" bg="#5c0b0f" wide />,
  ],
];
