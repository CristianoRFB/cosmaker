import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const outputDirectory = fileURLToPath(new URL('../docs/versions/v0.1.0/screenshots/', import.meta.url));
const baseUrl = process.env.SCREENSHOT_BASE_URL || process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const tenants = [
  { slug: 'aurora-cosplay', key: 'tenant-a', name: 'Ateliê Aurora Cosplay' },
  { slug: 'luna-cosplay', key: 'tenant-b', name: 'Ateliê Luna Cosplay' },
];
const screens = [
  { key: 'landing', route: (slug) => `/${slug}`, heading: (name) => name },
  { key: 'quote-request', route: (slug) => `/${slug}/orcamento`, heading: () => 'Solicite um orçamento' },
];

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  for (const tenant of tenants) {
    for (const screen of screens) {
      for (const viewport of [
        { key: 'desktop', width: 1440, height: 1000, isMobile: false },
        { key: 'mobile', width: 390, height: 844, isMobile: true },
      ]) {
        const page = await browser.newPage({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
          isMobile: viewport.isMobile,
          hasTouch: viewport.isMobile,
        });
        const route = screen.route(tenant.slug);
        const response = await page.goto(new URL(route, baseUrl).toString(), { waitUntil: 'networkidle' });
        if (!response?.ok()) throw new Error(`Falha ao abrir ${route}: HTTP ${response?.status() ?? 'sem resposta'}`);
        await page.getByRole('heading', { name: screen.heading(tenant.name), exact: false }).first().waitFor({ timeout: 20_000 });
        const filename = `${tenant.key}-${screen.key}-${viewport.key}.png`;
        await writeFile(`${outputDirectory}/${filename}`, await page.screenshot({ fullPage: true }));
        console.log(`${route} (${viewport.key}) -> docs/versions/v0.1.0/screenshots/${filename}`);
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}
