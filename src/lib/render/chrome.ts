import "server-only";

/**
 * Headless Chrome for pictures made on the server (the copyright certificate, win cards and monthly cards): the
 * serverless build on Vercel, the installed Chrome on a computer. Each route that uses it lists the Chromium files
 * in next.config.ts (outputFileTracingIncludes).
 */
export async function launchChrome() {
  const puppeteer = await import("puppeteer-core");
  if (process.env.VERCEL || process.platform === "linux") {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
  }
  const executablePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  return puppeteer.launch({ executablePath, headless: true });
}

/** A PNG of an HTML page at an exact size, once its web fonts and pictures have loaded. */
export async function renderPng(html: string, size: { width: number; height: number }): Promise<Uint8Array> {
  const browser = await launchChrome();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: size.width, height: size.height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => ((i.onload = r), (i.onerror = r))))));
    });
    const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, ...size } });
    return new Uint8Array(png);
  } finally {
    await browser.close();
  }
}
