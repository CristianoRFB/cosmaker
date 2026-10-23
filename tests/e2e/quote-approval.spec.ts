import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
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
  await page.goto('/login?next=%2Fcliente%2Forcamentos', { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/cliente\/orcamentos$/);
}

async function signInAsAtelier(page: Page) {
  await page.goto('/login?next=%2Fatelier%2Fpedidos', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('meta[name="cosmaker-firebase-mode"]')).toHaveAttribute('content', 'emulator');
  await page.locator('#email').fill('atelie@cosmaker.test');
  await page.locator('#password').fill(password!);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/atelier\/pedidos$/);
}

test('cliente aprova orçamento e o backend cria pedido com valores imutáveis', async ({ page }, testInfo) => {
  // This journey crosses client/staff sessions and many cold Next development routes.
  // Per-action and assertion timeouts still bound individual failures.
  test.setTimeout(600_000);
  await signInAsClient(page);
  await page.goto(`/cliente/orcamentos/${encodeURIComponent(quoteId)}?atelierId=${encodeURIComponent(atelierId)}`);
  await expect(page.getByRole('heading', { name: 'Proposta de cosplay' })).toBeVisible();
  await page.getByRole('button', { name: 'Aprovar proposta' }).click();
  await page.getByRole('button', { name: 'Aprovar orçamento' }).click();
  await expect(page.getByText('Aprovação registrada')).toBeVisible();

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
  const chestEditor = page.locator('form').filter({ has: page.getByText('Tórax', { exact: true }) });
  await chestEditor.getByRole('spinbutton', { name: 'Valor', exact: true }).fill('101');
  await chestEditor.getByRole('button', { name: 'Atualizar medida' }).click();
  await expect(chestEditor.getByRole('spinbutton', { name: 'Valor', exact: true })).toHaveValue('101');
  const editedProfileId = new URL(page.url()).pathname.split('/').at(-1);
  await expect.poll(async () => (await db.doc(`ateliers/${atelierId}/measurementProfiles/${editedProfileId}/measurements/chest`).get()).get('value')).toBe(101);
  await page.goto(`/cliente/pedidos/${encodeURIComponent(quoteId)}?atelierId=${encodeURIComponent(atelierId)}`);
  await expect(page.getByText('88 cm')).toBeVisible();

  await page.goto('/logout');
  await expect(page).toHaveURL(/\/login$/);
  await signInAsAtelier(page);
  await expect(page.getByRole('link', { name: /Mikasa Ackerman/ })).toBeVisible();
  await page.getByRole('link', { name: 'Abrir pedido' }).click();
  await expect(page.getByRole('heading', { name: 'Mikasa Ackerman' })).toBeVisible();
  await expect(page.getByText('88 cm')).toBeVisible();

  const depositResponses: number[] = [];
  const depositFailures: string[] = [];
  page.on('response', (response) => { if (response.url().includes('/confirmOrderDeposit')) depositResponses.push(response.status()); });
  page.on('requestfailed', (request) => { if (request.url().includes('/confirmOrderDeposit')) depositFailures.push(request.failure()?.errorText ?? 'request failed'); });
  await page.getByRole('button', { name: 'Registrar recebimento' }).click();
  await page.getByRole('button', { name: 'Confirmar entrada' }).click();
  try {
    await expect(page.getByText('Entrada registrada', { exact: false })).toBeVisible();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'A confirmação não apareceu.';
    throw new Error(`${message}\nResposta HTTP do callable: ${JSON.stringify(depositResponses)}; falhas de rede: ${JSON.stringify(depositFailures)}`);
  }
  await page.getByRole('link', { name: 'Gerenciar produção' }).click();
  await expect(page.getByRole('heading', { name: 'Atualizar etapa' })).toBeVisible();

  for (const stageName of ['A iniciar', 'Modelagem', 'Em produção']) {
    await expect(page.locator('section').getByRole('heading', { name: stageName, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Iniciar etapa' }).first().click();
    await page.getByRole('button', { name: 'Concluir etapa' }).click();
  }
  await expect(page.locator('section').getByRole('heading', { name: 'Prova e ajustes' })).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar etapa' }).click();
  await page.setViewportSize({ width: 375, height: 900 });
  await page.locator('#production-photo-stage-fitting').setInputFiles({
    name: 'prova.png', mimeType: 'image/png',
    buffer: await readFile(resolve(process.cwd(), 'tests/fixtures/production-progress.png')),
  });
  await page.getByLabel('Descrição para o histórico').fill('Prova do ajuste da manga');
  await page.getByLabel('Visível ao cliente').check();
  const photoRequests: string[] = [];
  const describePhotoRequest = (request: import('@playwright/test').Request) => {
    const url = new URL(request.url());
    return `${request.method()} ${url.host}${url.pathname}`;
  };
  page.on('request', (request) => {
    if (request.url().includes('19199') || request.url().includes('firebasestorage.googleapis.com')) {
      photoRequests.push(`started ${describePhotoRequest(request)}`);
    }
  });
  page.on('response', (response) => {
    if (response.url().includes('19199') || response.url().includes('firebasestorage.googleapis.com')) {
      const url = new URL(response.url());
      photoRequests.push(`response ${response.status()} ${url.host}${url.pathname}`);
    }
  });
  page.on('requestfailed', (request) => {
    if (request.url().includes('19199') || request.url().includes('firebasestorage.googleapis.com')) {
      photoRequests.push(`failed ${describePhotoRequest(request)}: ${request.failure()?.errorText ?? 'request failed'}`);
    }
  });
  const uploadedBytes = page.waitForResponse((response) => response.url().includes('/uploadProductionPhotoBytes') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Enviar foto' }).click();
  expect((await uploadedBytes).status()).toBe(200);
  try {
    await expect(page.getByText('Foto de progresso enviada.')).toBeVisible();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'O envio da foto não foi confirmado.';
    throw new Error(`${message}\nChamadas do Storage Emulator: ${JSON.stringify(photoRequests)}`);
  }
  expect(photoRequests).toEqual([]);
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`production-upload-${width}.png`) });
  }
  await page.getByRole('button', { name: 'Solicitar aprovação do cliente' }).click();
  await expect(page.getByText('Etapa enviada para aprovação do cliente.')).toBeVisible();

  await page.goto('/logout');
  await expect(page).toHaveURL(/\/login$/);
  await signInAsClient(page);
  await page.goto(`/cliente/pedidos/${encodeURIComponent(quoteId)}?atelierId=${encodeURIComponent(atelierId)}`);
  await expect(page.getByRole('heading', { name: 'Sua aprovação é necessária' })).toBeVisible();
  const approvalPhoto = page.locator('section').filter({ hasText: 'A equipe enviou esta etapa para sua revisão.' }).getByRole('img', { name: 'Prova do ajuste da manga' });
  await expect(approvalPhoto).toBeVisible();
  await expect(approvalPhoto).toHaveAttribute('src', /^blob:/);
  await expect.poll(() => approvalPhoto.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await approvalPhoto.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`production-client-${width}.png`) });
  }
  await page.getByRole('button', { name: 'Aprovar etapa' }).click();
  await expect(page.getByText('Etapa aprovada. A equipe já pode continuar.')).toBeVisible();

  order = await orderRef.get();
  expect(order.data()?.status).toBe('fitting');
  expect(order.data()?.progress).toBe(75);
  expect(order.data()?.amountPaid).toBe(600);
  const depositPayment = await orderRef.collection('payments').doc('deposit').get();
  expect(depositPayment.data()?.status).toBe('paid');
  const approvals = await orderRef.collection('approvals').get();
  expect(approvals.size).toBe(1);
  expect(approvals.docs[0].data().status).toBe('approved');
  const approvalEvents = await approvals.docs[0].ref.collection('events').get();
  expect(approvalEvents.size).toBe(2);
  const clientId = order.data()?.clientId;
  expect(typeof clientId).toBe('string');
  await page.goto('/logout');
  await expect(page).toHaveURL(/\/login$/);
  await signInAsAtelier(page);
  await page.goto(`/atelier/clientes/${encodeURIComponent(String(clientId))}`);
  await expect(page.getByRole('heading', { name: 'Marina Almeida' })).toBeVisible();
  await expect(page.getByText('Mikasa Ackerman').first()).toBeVisible();
  await expect(page.getByText(/approved.*2\.000,00/)).toBeVisible();
  await expect(page.getByText('Ficha principal')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pagamentos internos' })).toBeVisible();
  await expect(page.getByText(/600,00/).first()).toBeVisible();
  await app.delete();
});
