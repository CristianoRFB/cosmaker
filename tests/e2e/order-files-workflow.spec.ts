import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { workflowContextOptions } from './workflow-context-options';

const host = process.env.FIREBASE_EMULATOR_HOST || '127.0.0.1';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= `${host}:${process.env.COSMAKER_AUTH_EMULATOR_PORT || '19099'}`;
process.env.FIRESTORE_EMULATOR_HOST ||= `${host}:${process.env.COSMAKER_FIRESTORE_EMULATOR_PORT || '18080'}`;
process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= `${host}:${process.env.COSMAKER_STORAGE_EMULATOR_PORT || '19199'}`;
const requireFromFunctions = createRequire(resolve(process.cwd(), 'functions/package.json'));
const { initializeApp: initializeAdminApp } = requireFromFunctions('firebase-admin/app');
const { getAuth: getAdminAuth } = requireFromFunctions('firebase-admin/auth');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');
const { getStorage } = requireFromFunctions('firebase-admin/storage');
const projectId = 'demo-cosmaker';
const adminApp = initializeAdminApp({ projectId, storageBucket: `${projectId}.appspot.com` }, `order-files-e2e-${randomUUID()}`);
const adminAuth = getAdminAuth(adminApp);
const adminDb = getFirestore(adminApp);
const bucket = getStorage(adminApp).bucket();

type Identity = { uid: string; email: string; password: string };
async function login(page: Page, user: Identity, target: string) {
  await page.goto(`/login?next=${encodeURIComponent(target)}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('meta[name="cosmaker-firebase-mode"]')).toHaveAttribute('content', 'emulator');
  if (process.env.COSMAKER_E2E_MOBILE === 'true') {
    expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
    expect(await page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);
  }
  await page.locator('#email').fill(user.email);
  await page.locator('#password').fill(user.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(target.split('?')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test('envia bytes reais, compartilha anexos e revoga acesso do cliente mantendo isolamento entre ateliês', async ({ browser }) => {
  test.setTimeout(240_000);
  const nonce = randomUUID().slice(0, 8);
  const atelierA = `order-files-e2e-${nonce}-a`;
  const atelierB = `order-files-e2e-${nonce}-b`;
  const orderId = `order-files-${nonce}`;
  const identities: Identity[] = [];
  const contexts = await Promise.all([browser.newContext(workflowContextOptions()), browser.newContext(workflowContextOptions()), browser.newContext(workflowContextOptions())]);
  const [ownerPage, clientPage, otherPage] = await Promise.all(contexts.map((context) => context.newPage()));
  const pngBytes = await readFile(resolve(process.cwd(), 'tests/fixtures/production-progress.png'));

  async function createIdentity(label: string, accountType: 'atelier_member' | 'client', atelierId?: string) {
    const email = `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${nonce}@cosmaker.test`;
    const password = `Local!${randomUUID().slice(0, 14)}aA1`;
    const user = await adminAuth.createUser({ email, password, emailVerified: true, displayName: label });
    const identity = { uid: user.uid, email, password };
    identities.push(identity);
    await adminDb.doc(`users/${user.uid}`).set({ id: user.uid, email, name: label, accountType, active: true, permissions: [], ...(atelierId ? { atelierId, role: 'owner' } : {}) });
    return identity;
  }

  try {
    const owner = await createIdentity('Titular anexos A', 'atelier_member', atelierA);
    const ownerB = await createIdentity('Titular anexos B', 'atelier_member', atelierB);
    const client = await createIdentity('Cliente anexos A', 'client');
    const commonOrder = { quoteId: 'synthetic-quote', requestId: 'synthetic-request', clientId: null, clientName: 'Cliente sintético', franchise: 'Fictício', category: 'Costura', description: 'Pedido sintético para validar anexos.', status: 'confirmed', priority: 'normal', progress: 0, amountPaid: 0, amountRemaining: 100, expectedDeliveryDate: '2027-01-15', approvedQuoteSnapshot: { total: 100, depositAmount: 30, depositPercentage: 30 }, createdAt: new Date(), updatedAt: new Date() };
    await Promise.all([
      adminDb.doc(`ateliers/${atelierA}`).set({ id: atelierA, name: `Ateliê anexos A ${nonce}`, active: true, ownerId: owner.uid }),
      adminDb.doc(`ateliers/${atelierB}`).set({ id: atelierB, name: `Ateliê anexos B ${nonce}`, active: true, ownerId: ownerB.uid }),
      adminDb.doc(`ateliers/${atelierA}/members/${owner.uid}`).set({ userId: owner.uid, role: 'owner', permissions: [], active: true }),
      adminDb.doc(`ateliers/${atelierB}/members/${ownerB.uid}`).set({ userId: ownerB.uid, role: 'owner', permissions: [], active: true }),
      adminDb.doc(`ateliers/${atelierA}/orders/${orderId}`).set({ ...commonOrder, atelierId: atelierA, email: client.email, clientUserId: client.uid, character: `Projeto A ${nonce}` }),
      adminDb.doc(`ateliers/${atelierB}/orders/${orderId}`).set({ ...commonOrder, atelierId: atelierB, email: 'outro@example.test', character: `Projeto B ${nonce}` }),
    ]);
    const workspacePath = `/atelier/pedidos/${orderId}/arquivos`;
    const clientPath = `/cliente/pedidos/${orderId}?atelierId=${atelierA}`;
    await login(ownerPage, owner, workspacePath);
    await expect(ownerPage.getByRole('heading', { name: 'Arquivos do pedido', exact: true })).toBeVisible();
    await ownerPage.locator('input[type="file"]').setInputFiles({ name: 'imagem-interna.png', mimeType: 'image/png', buffer: pngBytes });
    await ownerPage.getByRole('combobox', { name: 'Categoria', exact: true }).selectOption('document');
    await ownerPage.getByRole('button', { name: 'Enviar e validar', exact: true }).click();
    await expect(ownerPage.getByText('Arquivo validado e anexado ao pedido.', { exact: true })).toBeVisible();
    await expect(ownerPage.getByText('Interno da equipe', { exact: false })).toBeVisible();
    const files = await adminDb.collection(`ateliers/${atelierA}/orders/${orderId}/files`).get();
    expect(files.size).toBe(1);
    const fileRef = files.docs[0].ref;
    const storagePath = files.docs[0].data().storagePath;
    expect(files.docs[0].data()).toMatchObject({ originalName: 'imagem-interna.png', contentType: 'image/png', size: pngBytes.length, category: 'document', uploadStatus: 'ready', visibleToClient: false, revision: 0 });
    const [storedBytes] = await bucket.file(storagePath).download();
    expect(storedBytes.equals(pngBytes)).toBe(true);

    await login(clientPage, client, clientPath);
    await expect(clientPage.getByRole('heading', { name: `Projeto A ${nonce}`, exact: true })).toBeVisible();
    await expect(clientPage.getByText('imagem-interna.png', { exact: true })).toHaveCount(0);
    await expect(clientPage.getByText('Nenhum arquivo de referência anexado.', { exact: true })).toBeVisible();
    const ownerFile = ownerPage.locator('li').filter({ hasText: 'imagem-interna.png' });
    await ownerFile.getByRole('button', { name: 'Compartilhar', exact: true }).click();
    await expect(ownerPage.getByText('Acesso ao arquivo atualizado.', { exact: true })).toBeVisible();
    expect((await fileRef.get()).data()).toMatchObject({ visibleToClient: true, revision: 1 });
    await clientPage.reload({ waitUntil: 'domcontentloaded' });
    await expect(clientPage.getByText('imagem-interna.png', { exact: true })).toBeVisible();
    const downloadEvent = clientPage.waitForEvent('download');
    await clientPage.getByRole('button', { name: 'Baixar arquivo', exact: true }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe('imagem-interna.png');
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    expect((await readFile(downloadPath!)).equals(pngBytes)).toBe(true);
    await clientPage.setViewportSize({ width: 390, height: 844 });
    await expect(clientPage.getByRole('button', { name: 'Baixar arquivo', exact: true })).toBeVisible();

    await ownerFile.getByRole('button', { name: 'Tornar interno', exact: true }).click();
    await expect(ownerPage.getByText('Interno da equipe', { exact: false })).toBeVisible();
    expect((await fileRef.get()).data()).toMatchObject({ visibleToClient: false, revision: 2 });
    await clientPage.reload({ waitUntil: 'domcontentloaded' });
    await expect(clientPage.getByText('imagem-interna.png', { exact: true })).toHaveCount(0);
    await expect(clientPage.getByText('Nenhum arquivo de referência anexado.', { exact: true })).toBeVisible();

    await ownerFile.getByRole('button', { name: 'Compartilhar', exact: true }).click();
    await expect(ownerFile.getByRole('button', { name: 'Tornar interno', exact: true })).toBeVisible();
    await ownerFile.getByRole('button', { name: 'Arquivar', exact: true }).click();
    await expect(ownerFile.getByRole('button', { name: 'Restaurar interno', exact: true })).toBeVisible();
    expect((await fileRef.get()).data()).toMatchObject({ archived: true, visibleToClient: false, revision: 4 });
    await clientPage.reload({ waitUntil: 'domcontentloaded' });
    await expect(clientPage.getByText('Nenhum arquivo de referência anexado.', { exact: true })).toBeVisible();
    await ownerFile.getByRole('button', { name: 'Restaurar interno', exact: true }).click();
    await expect(ownerFile.getByRole('button', { name: 'Compartilhar', exact: true })).toBeEnabled();
    expect((await fileRef.get()).data()).toMatchObject({ archived: false, visibleToClient: false, revision: 5 });

    await login(otherPage, ownerB, workspacePath);
    await expect(otherPage.getByText('Este pedido ainda não tem arquivos registrados.', { exact: true })).toBeVisible();
    await expect(otherPage.getByText('imagem-interna.png', { exact: true })).toHaveCount(0);
    expect((await adminDb.collection(`ateliers/${atelierB}/orders/${orderId}/files`).get()).size).toBe(0);
    expect((await adminDb.collection(`ateliers/${atelierA}/orders/${orderId}/files`).get()).size).toBe(1);
    const audits = await adminDb.collection('auditLogs').where('atelierId', '==', atelierA).get();
    expect(audits.docs.filter((document: { data(): { action: string } }) => document.data().action === 'order.file_uploaded')).toHaveLength(1);
    expect(audits.docs.filter((document: { data(): { action: string } }) => document.data().action === 'order.file_access_updated')).toHaveLength(5);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    for (const atelierId of [atelierA, atelierB]) {
      await adminDb.recursiveDelete(adminDb.doc(`ateliers/${atelierId}`)).catch(() => undefined);
      await bucket.deleteFiles({ prefix: `ateliers/${atelierId}/` }).catch(() => undefined);
      const audits = await adminDb.collection('auditLogs').where('atelierId', '==', atelierId).get().catch(() => null);
      await Promise.all(audits?.docs.map((document: { ref: { delete(): Promise<unknown> } }) => document.ref.delete()) ?? []);
    }
    await Promise.all(identities.map(async (identity) => {
      await adminDb.doc(`users/${identity.uid}`).delete().catch(() => undefined);
      await adminAuth.deleteUser(identity.uid).catch(() => undefined);
    }));
    await adminApp.delete().catch(() => undefined);
  }
});
