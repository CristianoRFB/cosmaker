import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const requireFromFunctions = createRequire(resolve(process.cwd(), 'functions/package.json'));
const { initializeApp, deleteApp } = requireFromFunctions('firebase-admin/app');
const { getAuth } = requireFromFunctions('firebase-admin/auth');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');

test('cliente consulta e pagina propostas/respostas em quatro larguras; e-mail reutilizado não recupera histórico', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  for (const name of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env[name] ?? '')) throw new Error('Teste exclusivo dos emuladores locais.');
  const nonce = randomUUID().slice(0, 8); const projectId = 'demo-cosmaker';
  const app = initializeApp({ projectId }, `client-projection-ui-${nonce}`); const db = getFirestore(app); const auth = getAuth(app);
  const root = db.doc(`ateliers/quote-ui-${nonce}`); const email = `quotes-ui-${nonce}@cosmaker.test`; const password = `Local!${nonce}aA1`;
  const customer = await auth.createUser({ email, password, emailVerified: true }); const uids = [customer.uid];
  const quoteId = 'visible-proposal'; const detailPath = `/cliente/orcamentos/${quoteId}?atelierId=${root.id}`;
  const signIn = async (page: Page) => {
    await page.goto('/login?next=%2Fcliente%2Forcamentos');
    await expect(page.locator('meta[name="cosmaker-firebase-mode"]')).toHaveAttribute('content', 'emulator');
    await page.locator('#email').fill(email); await page.locator('#password').fill(password); await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/\/cliente\/orcamentos$/);
  };
  try {
    await root.set({ active: true, name: 'Ateliê sintético' });
    await db.doc(`users/${customer.uid}`).set({ active: true, accountType: 'client', role: 'client', permissions: [], email, name: 'Cliente sintético' });
    await Promise.all(Array.from({ length: 51 }, (_, i) => root.collection('quotes').doc(i === 0 ? quoteId : `older-${i}`).set({ atelierId: root.id, requestId: `request-${i}`, clientId: null, clientUserId: customer.uid, email, status: 'sent', materialsCost: 100, laborCost: 200, otherCost: 0, urgencyFee: 0, shipping: 0, discount: 0, subtotal: 300, total: 300, depositAmount: 90, depositPercentage: 30, validUntil: '2027-12-31', createdAt: new Date(Date.now() - i * 1000), updatedAt: new Date(), internalNotes: 'PRIVATE' })));
    await root.collection('quoteRequests').doc('request-0').set({ name: 'Cliente sintético', email, status: 'quoted', activeQuoteId: quoteId });
    await root.collection('quotes').doc(quoteId).collection('items').doc('item').set({ description: 'Confecção do projeto', category: 'labor', quantity: 1, unitPrice: 300, total: 300, createdAt: new Date() });
    await Promise.all(Array.from({ length: 51 }, (_, i) => root.collection('quotes').doc(quoteId).collection('responses').doc(`response-${i}`).set({ decision: 'request_changes', comment: `Registro anterior ${i}`, createdAt: new Date(Date.now() - i * 1000), actorId: customer.uid, email, internalNotes: 'PRIVATE' })));
    await signIn(page);
    await expect(page.getByRole('link', { name: /Ver proposta/ })).toHaveCount(50);
    await page.getByRole('button', { name: 'Carregar mais propostas' }).click();
    await expect(page.getByRole('link', { name: /Ver proposta/ })).toHaveCount(51);
    await expect(page.getByRole('button', { name: 'Carregar mais propostas' })).toHaveCount(0);
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await page.goto(detailPath);
      await expect(page.getByRole('heading', { name: 'Proposta de cosplay' })).toBeVisible();
      await expect(page.getByText('Confecção do projeto')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`client-quote-${width}.png`), fullPage: true });
    }
    await page.getByRole('button', { name: 'Carregar respostas anteriores' }).click();
    await expect(page.getByText('Registro anterior 50', { exact: true })).toBeVisible();
    await page.locator('#clientComment').fill('Ajustar a manga do projeto sintético');
    await page.getByRole('button', { name: 'Enviar pedido de ajuste' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Seu pedido de ajuste foi registrado' })).toBeVisible();
    await expect(page.getByText('Ajustar a manga do projeto sintético', { exact: true })).toBeVisible();
    await expect(page.getByText('Data indisponível')).toHaveCount(0);
    expect((await root.collection('quotes').doc(quoteId).get()).get('clientUserId')).toBe(customer.uid);
    await page.goto('/logout'); await expect(page).toHaveURL(/\/login$/);
    await auth.updateUser(customer.uid, { email: `moved-${nonce}@cosmaker.test`, emailVerified: true });
    const replacement = await auth.createUser({ email, password, emailVerified: true }); uids.push(replacement.uid);
    await db.doc(`users/${replacement.uid}`).set({ active: true, accountType: 'client', role: 'client', permissions: [], email, name: 'Outra conta sintética' });
    await signIn(page);
    await expect(page.getByRole('heading', { name: 'Nenhum orçamento disponível' })).toBeVisible();
    await page.goto(detailPath); await expect(page.getByRole('heading', { name: 'Orçamento não encontrado' })).toBeVisible();
    await expect(page.getByText('Confecção do projeto')).toHaveCount(0);
  } finally {
    await db.recursiveDelete(root);
    const audits = await db.collection('auditLogs').where('atelierId', '==', root.id).get(); await Promise.all(audits.docs.map((row: { ref: { delete(): Promise<unknown> } }) => row.ref.delete()));
    for (const uid of uids) { await auth.deleteUser(uid); await db.doc(`users/${uid}`).delete(); }
    await deleteApp(app);
  }
});
