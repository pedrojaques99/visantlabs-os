/**
 * Headless preset render — HTML → PNG via Puppeteer/Chromium. Reuses the launch
 * pattern from brandBookRenderer (same `PUPPETEER_EXECUTABLE_PATH` / args). Chromium
 * renders deterministically, so the PNG equals what the same HTML shows in a browser.
 */
import puppeteer from 'puppeteer-core';

export async function renderHtmlToPng(
  html: string,
  opts: { width: number; height: number }
): Promise<Buffer> {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: opts.width, height: opts.height, deviceScaleFactor: 1 });
    // `networkidle0` is valid at runtime; this puppeteer-core's types narrow it.
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 45_000 } as any);
    // Wait for web fonts (@fontsource/Google) before snapping, else fallback glyphs.
    await page.evaluate(async () => {
      try {
        await (document as any).fonts.ready;
      } catch {
        /* fonts API absent — proceed */
      }
    });
    const frame = await page.$('.frame');
    const buf = frame
      ? await frame.screenshot({ type: 'png' })
      : await page.screenshot({ type: 'png' });
    return Buffer.from(buf as Uint8Array);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
