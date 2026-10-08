import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const projectId = process.env.FIREBASE_PROJECT_ID || 'demo-cosmaker';
const functionsHost = process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST || '127.0.0.1:5001';
const requireFromFunctions = createRequire(resolve(process.cwd(), 'functions/package.json'));
const { initializeApp } = requireFromFunctions('firebase-admin/app');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');
const { getStorage } = requireFromFunctions('firebase-admin/storage');

function assertLocalEmulators() {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || projectId !== 'demo-cosmaker') {
    throw new Error('O fluxo público multi-tenant só pode gravar dados nos emuladores locais do projeto demo-cosmaker.');
  }
}

test('resolve slugs de A e B e diferencia slug ausente, suspenso e não publicado', async ({ page, request }) => {
  assertLocalEmulators();
  test.setTimeout(90_000);
  for (const [slug, displayName] of [['aurora-cosplay', 'Ateliê Aurora Cosplay'], ['luna-cosplay', 'Ateliê Luna Cosplay']]) {
    const response = await request.post(`http://${functionsHost}/${projectId}/us-central1/resolvePublicTenant`, {
      data: { data: { tenantSlug: slug } },
    });
    expect(response.ok()).toBe(true);
    const payload = await response.json();
    const resolution = payload.result;
    expect(resolution.status).toBe('available');
    expect(resolution.tenant.name).toBe(displayName);
    expect(resolution).not.toHaveProperty('atelierId');
    expect(resolution.tenant).not.toHaveProperty('atelierId');
  }
  const unpublished = await request.post(`http://${functionsHost}/${projectId}/us-central1/resolvePublicTenant`, {
    data: { data: { tenantSlug: 'atelier-nao-publicado-teste' } },
  });
  expect((await unpublished.json()).result).toEqual({ status: 'unpublished' });
  const unpublishedIntake = await request.post(`http://${functionsHost}/${projectId}/us-central1/createPublicQuoteRequest`, {
    data: { data: {
      tenantSlug: 'atelier-nao-publicado-teste', references: [],
      input: {
        name: 'Cliente de teste', email: 'unpublished@example.com', character: 'Personagem de teste', franchise: 'Obra de teste',
        category: 'full_cosplay', description: 'Uma solicitação detalhada suficiente para validar que o intake permanece fechado.',
        desiredDeliveryDate: '2027-12-01', urgency: 'normal',
      },
    } },
  });
  expect(unpublishedIntake.ok()).toBe(false);
  await page.goto('/aurora-cosplay', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1')).toContainText('Ateliê Aurora Cosplay', { timeout: 20_000 });
  await page.goto('/luna-cosplay', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1')).toContainText('Ateliê Luna Cosplay', { timeout: 20_000 });
  await page.goto('/slug-inexistente-teste', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Ateliê não encontrado' })).toBeVisible();
  await page.goto('/atelier-suspenso-teste', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Ateliê temporariamente indisponível' })).toBeVisible();
  await page.goto('/atelier-nao-publicado-teste', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Página ainda não publicada' })).toBeVisible();
});

test('intake e upload A × B permanecem no tenant resolvido e rejeitam atelierId adulterado', async ({ page, request }) => {
  test.setTimeout(90_000);
  assertLocalEmulators();
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= '127.0.0.1:9199';
  const app = initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` }, `public-tenant-e2e-${Date.now()}`);
  const db = getFirestore(app);
  const bucket = getStorage(app).bucket();
  const fixture = await readFile(resolve(process.cwd(), 'tests/fixtures/production-progress.png'));

  async function submitRequest(slug: string, label: string, upload: boolean) {
    const unique = `${Date.now()}-${label}`;
    await page.goto(`/${slug}/orcamento`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Solicite um orçamento' })).toBeVisible();
    const submit = page.getByRole('button', { name: 'Enviar solicitação' });
    await expect(submit).toBeEnabled({ timeout: 20_000 });
    await page.getByRole('textbox', { name: 'Personagem', exact: true }).fill(`Personagem ${label}`);
    await page.getByLabel('Obra ou franquia').fill(`Obra ${label}`);
    await page.getByLabel('Categoria do projeto').selectOption('full_cosplay');
    await page.locator('#description').fill('Solicitação de teste detalhada para validar o isolamento multi-tenant público.');
    await page.getByLabel('Data de entrega desejada').fill('2027-12-01');
    await page.getByLabel('Seu nome').fill(`Cliente ${label}`);
    await page.getByLabel('E-mail').fill(`cliente-${unique}@example.com`);
    if (upload) {
      await page.locator('input[type="file"]').setInputFiles({ name: 'referencia.png', mimeType: 'image/png', buffer: fixture });
      await expect(page.getByText('referencia.png')).toBeVisible();
    }
    await submit.click();
    await expect(page.getByText('Solicitação registrada', { exact: true })).toBeVisible({ timeout: 20_000 });
    const protocol = new URL(page.url()).searchParams.get('protocolo');
    expect(protocol).toBeTruthy();
    return { requestId: protocol!, email: `cliente-${unique}@example.com`.toLowerCase() };
  }

  try {
    const requestA = await submitRequest('aurora-cosplay', 'A', true);
    const requestARef = db.doc(`ateliers/atelier-aurora/quoteRequests/${requestA.requestId}`);
    const savedA = await requestARef.get();
    expect(savedA.exists).toBe(true);
    expect(savedA.data()?.email).toBe(requestA.email);
    expect(savedA.data()).not.toHaveProperty('atelierId');
    expect((await db.doc(`ateliers/atelier-luna/quoteRequests/${requestA.requestId}`).get()).exists).toBe(false);
    const refsA = await requestARef.collection('references').get();
    expect(refsA.size).toBe(1);
    const referenceA = refsA.docs[0].data();
    expect(referenceA.uploadStatus).toBe('ready');
    expect(referenceA.storagePath).toMatch(/^ateliers\/atelier-aurora\/quoteRequests\//);
    expect(referenceA.storagePath).not.toContain('atelier-luna');
    expect((await bucket.file(referenceA.storagePath).exists())[0]).toBe(true);
    expect((await bucket.file(referenceA.storagePath.replace('atelier-aurora', 'atelier-luna')).exists())[0]).toBe(false);

    const requestB = await submitRequest('luna-cosplay', 'B', true);
    const requestBRef = db.doc(`ateliers/atelier-luna/quoteRequests/${requestB.requestId}`);
    expect((await requestBRef.get()).data()?.email).toBe(requestB.email);
    expect((await db.doc(`ateliers/atelier-aurora/quoteRequests/${requestB.requestId}`).get()).exists).toBe(false);
    const referenceB = (await requestBRef.collection('references').get()).docs[0].data();
    expect(referenceB.uploadStatus).toBe('ready');
    expect(referenceB.storagePath).toMatch(/^ateliers\/atelier-luna\/quoteRequests\//);

    const forged = await request.post(`http://${functionsHost}/${projectId}/us-central1/createPublicQuoteRequest`, {
      data: { data: { tenantSlug: 'aurora-cosplay', atelierId: 'atelier-luna', input: {}, references: [] } },
    });
    expect(forged.ok()).toBe(false);
    expect((await db.collection('ateliers/atelier-luna/quoteRequests').get()).docs.some((entry: { id: string }) => entry.id === requestA.requestId)).toBe(false);
  } finally {
    await app.delete();
  }
});
