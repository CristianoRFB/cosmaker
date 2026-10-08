import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const browser = await chromium.launch({ headless: true });
try {
  for (const name of ['manual-plan-assignment', 'entitlement-resolution', 'commercial-enforcement']) {
    const svgUrl = new URL(`${name}.svg`, import.meta.url);
    const contents = await readFile(svgUrl, 'utf8');
    const width = Number(contents.match(/<svg[^>]+width="(\d+)"/)[1]);
    const height = Number(contents.match(/<svg[^>]+height="(\d+)"/)[1]);
    const page = await browser.newPage({ viewport: { width, height: Math.min(height, 1000) }, deviceScaleFactor: 1 });
    await page.goto(svgUrl.href);
    await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, import.meta.url)), fullPage: true });
    console.log(`${name}: ${width} × ${height}`);
    await page.close();
  }
} finally {
  await browser.close();
}
