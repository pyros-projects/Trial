import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

/**
 * Render HTML content and capture a PNG screenshot via Playwright Chromium.
 * Writes HTML to a temp file and navigates to it so that file:// image
 * references resolve correctly.
 */
export async function screenshotPage(htmlContent, opts = {}) {
  const {
    width = 1200,
    fullPage = true,
    cropHeight,
    deviceScaleFactor = 2,
  } = opts;

  const tmpPath = join(tmpdir(), `comparison-${randomBytes(6).toString('hex')}.html`);
  writeFileSync(tmpPath, htmlContent);

  try {
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width, height: cropHeight ?? 800 },
      deviceScaleFactor,
    });
    const page = await context.newPage();

    await page.goto(pathToFileURL(tmpPath).href, { waitUntil: 'networkidle' });

    const screenshotOpts = { type: 'png' };

    if (cropHeight) {
      screenshotOpts.clip = { x: 0, y: 0, width, height: cropHeight };
    } else {
      screenshotOpts.fullPage = fullPage;
    }

    const buffer = await page.screenshot(screenshotOpts);
    await browser.close();
    return buffer;
  } finally {
    try { unlinkSync(tmpPath); } catch {}
  }
}
