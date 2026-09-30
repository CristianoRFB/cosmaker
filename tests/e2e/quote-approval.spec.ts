import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const email = process.env.E2E_CLIENT_EMAIL;
const password = process.env.E2E_CLIENT_PASSWORD;
const atelierId = process.env.E2E_ATELIER_ID || 'atelier-aurora';
const quoteId = process.env.E2E_QUOTE_ID || 'quote-2026-001';
const projectId = process.env.FIREBASE_PROJECT_ID || 'demo-cosmaker';
const requireFromFunctions = createRequire(resolve(process.cwd(), 'functions/package.json'));
const { initializeApp } = requireFromFunctions('firebase-admin/app');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');

async function signInAsClient(page: Page) {
  if (!email || !password) throw new Error('Defina E2E_CLIENT_EMAIL e E2E_CLIENT_PASSWORD para o fluxo do cliente no Emulator.');
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || projectId !== 'demo-cosmaker') {
    throw new Error('O fluxo de aprovação só pode gravar dados no projeto e nos endpoints Firebase Emulator locais.');
  }
  await page.goto('/login');
  await expect(page.locator('meta[name="cosmaker-firebase-mode"]')).toHaveAttribute('content', 'emulator');
  await page.addInitScript(() => document.addEventListener('submit', (event) => event.preventDefault(), true));
  await page.goto('/login?next=%2Fcliente%2Forcamentos', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/cliente\/orcamentos$/);
}

async function signInAsAtelier(page: Page) {
  await page.goto('/login?next=%2Fatelier%2Fpedidos', { waitUntil: 'networkidle' });
  await expect(page.locator('meta[name="cosmaker-firebase-mode"]')).toHaveAttribute('content', 'emulator');
  await page.addInitScript(() => document.addEventListener('submit', (event) => event.preventDefault(), true));
  await page.waitForTimeout(400);
  await page.locator('#email').fill('atelie@cosmaker.test');
  await page.locator('#password').fill(password!);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/atelier\/pedidos$/);
}

test('cliente aprova orçamento e o backend cria pedido com valores imutáveis', async ({ page }) => {
  await signInAsClient(page);
  await page.goto(`/cliente/orcamentos/${encodeURIComponent(quoteId)}?atelierId=${encodeURIComponent(atelierId)}`);
  await expect(page.getByRole('heading', { name: 'Proposta de cosplay' })).toBeVisible();
  await page.getByRole('button', { name: 'Aprovar proposta' }).click();
  await page.getByRole('button', { name: 'Aprovar orçamento' }).click();
  await expect(page.getByText('Aprovação registrada')).toBeVisible({ timeout: 10_000 });

  const appName = `quote-e2e-${Date.now()}`;
  const app = initializeApp({ projectId }, appName);
  const db = getFirestore(app);
  const orderRef = db.doc(`ateliers/${atelierId}/orders/${quoteId}`);
  let order = await orderRef.get();
  for (let attempt = 0; !order.exists && attempt < 30; attempt += 1) {
    await page.waitForTimeout(500);
    order = await orderRef.get();
  }

  expect(order.exists).toBe(true);
  expect(order.data()?.status).toBe('waiting_deposit');
  expect(order.data()?.approvedQuoteSnapshot?.total).toBe(2000);
  const items = await orderRef.collection('items').get();
  expect(items.size).toBe(3);
  const measurementSnapshot = await orderRef.collection('measurementSnapshot').get();
  expect(measurementSnapshot.size).toBe(2);
  expect(measurementSnapshot.docs.find((entry: { id: string }) => entry.id === 'chest')?.data().value).toBe(88);

  await page.goto('/cliente/pedidos');
  await expect(page.getByRole('heading', { name: 'Mikasa Ackerman' })).toBeVisible();
  await page.getByRole('link', { name: 'Abrir pedido' }).click();
  await expect(page.getByRole('heading', { name: 'Medidas congeladas neste pedido' })).toBeVisible();
  await expect(page.getByText('88 cm')).toBeVisible();

  await page.goto('/cliente/medidas');
  await expect(page.getByRole('link', { name: /Ficha principal/ })).toBeVisible();
  await page.getByRole('link', { name: /Ficha principal/ }).click();
  await expect(page.getByRole('heading', { name: 'Ficha principal' })).toBeVisible();
  await page.getByLabel('Valor').first().fill('101');
  await page.getByRole('button', { name: 'Atualizar medida' }).first().click();
  await expect(page.getByLabel('Valor').first()).toHaveValue('101');
  await page.goto(`/cliente/pedidos/${encodeURIComponent(quoteId)}?atelierId=${encodeURIComponent(atelierId)}`);
  await expect(page.getByText('88 cm')).toBeVisible();

  await page.goto('/logout');
  await expect(page).toHaveURL(/\/login$/);
  await signInAsAtelier(page);
  await expect(page.getByRole('link', { name: /Mikasa Ackerman/ })).toBeVisible();
  await page.getByRole('link', { name: 'Abrir pedido' }).click();
  await expect(page.getByRole('heading', { name: 'Mikasa Ackerman' })).toBeVisible();
  await expect(page.getByText('88 cm')).toBeVisible();
  await app.delete();
});
