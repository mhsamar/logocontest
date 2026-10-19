import "server-only";
import { launchChrome } from "@/lib/render/chrome";
import { CARD_SIZES, type CardSizeKey, type CardStyle } from "./rules";
import { cardPage, type CardData } from "./template";

/**
 * Contest card pictures (owner, 2026-10-19), drawn by headless Chromium from the card template so the Bangla line joins
 * its letters correctly (next/og's Satori doesn't shape Bangla). One browser for all four sizes.
 */
export async function renderCard(d: CardData, style: CardStyle): Promise<Record<CardSizeKey, Uint8Array>> {
  const browser = await launchChrome();
  try {
    const out = {} as Record<CardSizeKey, Uint8Array>;
    const page = await browser.newPage();
    for (const s of CARD_SIZES) {
      await page.setViewport({ width: s.width, height: s.height, deviceScaleFactor: 1 });
      await page.setContent(cardPage(d, style, s.key), { waitUntil: "load", timeout: 30_000 });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => ((i.onload = r), (i.onerror = r))))));
      });
      out[s.key] = new Uint8Array(await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: s.width, height: s.height } }));
    }
    return out;
  } finally {
    await browser.close();
  }
}
