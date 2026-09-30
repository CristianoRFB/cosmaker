import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const outputDirectory = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));
const baseUrl = process.env.SCREENSHOT_BASE_URL || 'http://127.0.0.1:3000';
const screens = [
  { name: 'landing', route: '/' },
  { name: 'quote-request', route: '/orcamento' },
  { name: 'login', route: '/login' },
  { name: 'registration', route: '/cadastro' },
  { name: 'password-recovery', route: '/recuperar-senha' },
  { name: 'email-verification', route: '/verificar-email' },
  { name: 'quote-request-success-empty', route: '/orcamento/sucesso' },
  { name: 'protected-client-setup', route: '/cliente' },
  { name: 'protected-atelier-setup', route: '/atelier' },
  { name: 'protected-admin-setup', route: '/admin' },
];

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];

try {
  for (const screen of screens) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    page.on('pageerror', (error) => errors.push(`${screen.route}: ${error.message}`));
    const response = await page.goto(new URL(screen.route, baseUrl).toString(), { waitUntil: 'networkidle' });
    if (!response?.ok()) throw new Error(`Falha ao abrir ${screen.route}: HTTP ${response?.status() ?? 'sem resposta'}`);
    await page.screenshot({ path: `${outputDirectory}/${screen.name}.png`, fullPage: true });
    console.log(`${screen.route} -> docs/screenshots/${screen.name}.png`);
    await page.close();
  }

  for (const screen of [{ name: 'landing-mobile', route: '/' }, { name: 'quote-request-mobile', route: '/orcamento' }, { name: 'login-mobile', route: '/login' }]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    page.on('pageerror', (error) => errors.push(`${screen.route} mobile: ${error.message}`));
    const response = await page.goto(new URL(screen.route, baseUrl).toString(), { waitUntil: 'networkidle' });
    if (!response?.ok()) throw new Error(`Falha ao abrir ${screen.route} em mobile: HTTP ${response?.status() ?? 'sem resposta'}`);
    await page.screenshot({ path: `${outputDirectory}/${screen.name}.png`, fullPage: true });
    console.log(`${screen.route} mobile -> docs/screenshots/${screen.name}.png`);
    await page.close();
  }

  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await browser.close();
}
