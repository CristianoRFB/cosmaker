import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
const requireFromFunctions = createRequire(resolve(process.cwd(), 'functions/package.json'));
const { initializeApp } = requireFromFunctions('firebase-admin/app');
const { getAuth } = requireFromFunctions('firebase-admin/auth');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18080' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:19099') throw new Error('Use somente os emuladores locais de demo-cosmaker.');
const app = initializeApp({ projectId: 'demo-cosmaker' }, `delivery-e2e-${randomUUID()}`);
const auth = getAuth(app); const db = getFirestore(app);

async function login(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`); await page.locator('#email').fill(email); await page.locator('#password').fill(password); await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}
test('registra entrega e conclusão, preserva financeiro e histórico e notifica somente o cliente do pedido', async ({ page, browser }, info) => {
  test.setTimeout(150_000);
  const nonce = randomUUID().slice(0, 8); const atelierId = `delivery-${nonce}`; const orderId = `order-${nonce}`; const password = `Local!${nonce}aA1`;
  const [owner, client] = await Promise.all(['owner', 'client'].map((label) => auth.createUser({ email: `${label}-${nonce}@cosmaker.test`, password, emailVerified: true })));
  const clientContext = await browser.newContext({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
  try {
    await Promise.all([
      db.doc(`users/${owner.uid}`).set({ active: true, id: owner.uid, email: owner.email, name: 'Equipe sintética', accountType: 'atelier_member', atelierId, role: 'owner' }),
      db.doc(`users/${client.uid}`).set({ active: true, id: client.uid, email: client.email, name: 'Cliente sintético', accountType: 'client' }),
      db.doc(`ateliers/${atelierId}`).set({ active: true, ownerId: owner.uid, name: 'Ateliê de entrega' }),
      db.doc(`ateliers/${atelierId}/members/${owner.uid}`).set({ active: true, role: 'owner', permissions: [] }),
      db.doc(`ateliers/${atelierId}/orders/${orderId}`).set({ atelierId, quoteId: 'quote-synthetic', requestId: 'request-synthetic', clientUserId: client.uid, clientId: null, clientName: 'Cliente sintético', email: client.email, character: 'Armadura de entrega', franchise: 'Obra sintética', category: 'full_cosplay', description: 'Projeto concluído e pronto para entrega', status: 'shipped', progress: 100, expectedDeliveryDate: '2027-01-10', createdAt: new Date(), updatedAt: new Date(), approvedQuoteSnapshot: { total: 1000, depositAmount: 300, depositPercentage: 30 }, amountPaid: 1000, amountPaidCents: 100000, amountRemaining: 0, amountRemainingCents: 0 }),
      db.doc(`ateliers/${atelierId}/orders/${orderId}/productionStages/stage-shipping`).set({ name: 'Expedição / retirada', order: 1, semanticKey: 'shipping', status: 'completed', progress: 100, progressWeight: 1 }),
    ]);
    await page.setViewportSize({ width: 320, height: 900 });
    await login(page, owner.email, password, `/atelier/pedidos/${orderId}`);
    await expect(page.getByRole('heading', { name: 'Entrega e conclusão', exact: true })).toBeVisible();
    await page.getByLabel('Registro visível ao cliente').fill('Retirada conferida pela equipe');
    await page.getByRole('button', { name: 'Registrar entrega', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar entrega', exact: true }).click();
    await expect(page.getByText(/Entrega registrada em/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Concluir pedido', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('delivery-320.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByLabel('Registro visível ao cliente').fill('Conferência final do histórico e entrega');
    await page.getByRole('button', { name: 'Concluir pedido', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar conclusão', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Pedido concluído em' })).toBeVisible();
    await page.reload(); await expect(page.getByRole('status').filter({ hasText: 'Pedido concluído em' })).toBeVisible();
    const orderRef = db.doc(`ateliers/${atelierId}/orders/${orderId}`);
    expect((await orderRef.get()).data()).toMatchObject({ status: 'completed', lifecycleVersion: 2, amountPaidCents: 100000, amountRemainingCents: 0 });
    expect((await orderRef.collection('statusHistory').get()).size).toBe(2);
    await page.screenshot({ path: info.outputPath('completed-1440.png'), fullPage: true });
    const portal = await clientContext.newPage(); await login(portal, client.email, password, `/cliente/pedidos/${orderId}?atelierId=${atelierId}`);
    await expect(portal.getByRole('status').filter({ hasText: 'Pedido concluído em' })).toBeVisible();
    await expect(portal.getByRole('button', { name: 'Registrar entrega', exact: true })).toHaveCount(0);
    await expect(portal.getByText('Concluído', { exact: true }).first()).toBeVisible();
    await expect(portal.getByText('Conferência final do histórico e entrega', { exact: true })).toBeVisible();
    await portal.goto('/cliente/notificacoes'); await expect(portal.getByRole('heading', { name: 'Entrega registrada', exact: true })).toBeVisible();
    await expect(portal.getByRole('heading', { name: 'Pedido concluído', exact: true })).toBeVisible();
    expect(await portal.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    await clientContext.close(); await db.recursiveDelete(db.doc(`ateliers/${atelierId}`));
    const logs = await db.collection('auditLogs').where('atelierId', '==', atelierId).get(); await Promise.all(logs.docs.map((doc: { ref: { delete(): Promise<unknown> } }) => doc.ref.delete()));
    for (const user of [owner, client]) { await db.doc(`users/${user.uid}`).delete(); await auth.deleteUser(user.uid); }
    await app.delete();
  }
});
