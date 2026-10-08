import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const outputDirectory = fileURLToPath(new URL('../docs/versions/v0.2.0/screenshots/', import.meta.url));
const baseUrl = process.env.SCREENSHOT_BASE_URL || process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const fixturePassword = process.env.E2E_FIXTURE_PASSWORD || 'CosmakerLocal!2026';
const adminEmail = process.env.E2E_ADMIN_EMAIL || 'plataforma@cosmaker.test';

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function capture({ filename, route, email, viewport, waitFor }) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  try {
    await page.goto(new URL('/login', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
    await expect(page.locator('meta[name="cosmaker-firebase-mode"]')).toHaveAttribute('content', 'emulator');
    await page.goto(new URL(`/login?next=${encodeURIComponent(route)}`, baseUrl).toString(), { waitUntil: 'domcontentloaded' });
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(fixturePassword);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL((url) => url.pathname === route, { timeout: 30_000 });
    await page.goto(new URL(route, baseUrl).toString(), { waitUntil: 'domcontentloaded' });
    await waitFor(page);
    await page.screenshot({ path: `${outputDirectory}/${filename}`, fullPage: true });
    console.log(`${route} -> docs/versions/v0.2.0/screenshots/${filename}`);
  } finally {
    await page.close();
  }
}

try {
  await capture({
    filename: 'commercial-plans-desktop.png', route: '/admin/planos', email: adminEmail,
    viewport: { width: 1440, height: 1000 },
    waitFor: (page) => expect(page.getByRole('region', { name: 'Planos aprovados' })).toBeVisible({ timeout: 30_000 }),
  });
  await capture({
    filename: 'commercial-plans-mobile.png', route: '/admin/planos', email: adminEmail,
    viewport: { width: 390, height: 844 },
    waitFor: (page) => expect(page.getByRole('region', { name: 'Planos aprovados' })).toBeVisible({ timeout: 30_000 }),
  });
  await capture({
    filename: 'commercial-state-assignment.png', route: '/admin/ateliers/atelier-premium', email: adminEmail,
    viewport: { width: 1440, height: 1000 },
    waitFor: (page) => expect(page.getByLabel('Plano comercial')).toBeVisible({ timeout: 30_000 }),
  });
  await capture({
    filename: 'commercial-trial-banner.png', route: '/atelier', email: 'trial@cosmaker.test',
    viewport: { width: 1440, height: 1000 },
    waitFor: async (page) => {
      await expect(page.getByText(/Experiência Premium válida até/)).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole('button', { name: 'Executar operação de prova' })).toBeVisible({ timeout: 30_000 });
    },
  });
  await capture({
    filename: 'commercial-demo-banner-and-probe.png', route: '/atelier', email: 'demo@cosmaker.test',
    viewport: { width: 1440, height: 1000 },
    waitFor: async (page) => {
      await expect(page.getByText('DEMONSTRAÇÃO — PLANO PREMIUM', { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole('button', { name: 'Executar operação de prova' })).toBeVisible({ timeout: 30_000 });
    },
  });
  await capture({
    filename: 'commercial-policy-denied.png', route: '/atelier', email: 'past-due@cosmaker.test',
    viewport: { width: 390, height: 844 },
    waitFor: (page) => expect(page.getByText('O estado comercial atual não libera esta operação protegida.')).toBeVisible({ timeout: 30_000 }),
  });
} finally {
  await browser.close();
}
