import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const host = process.env.FIREBASE_EMULATOR_HOST || '127.0.0.1';
const authPort = process.env.COSMAKER_AUTH_EMULATOR_PORT || '19099';
const firestorePort = process.env.COSMAKER_FIRESTORE_EMULATOR_PORT || '18080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= `${host}:${authPort}`;
process.env.FIRESTORE_EMULATOR_HOST ||= `${host}:${firestorePort}`;

const requireFromFunctions = createRequire(resolve(process.cwd(), 'functions/package.json'));
const { initializeApp: initializeAdminApp } = requireFromFunctions('firebase-admin/app');
const { getAuth: getAdminAuth } = requireFromFunctions('firebase-admin/auth');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');
const projectId = 'demo-cosmaker';
const adminApp = initializeAdminApp({ projectId }, `finance-e2e-${randomUUID()}`);
const adminAuth = getAdminAuth(adminApp);
const adminDb = getFirestore(adminApp);

test('registra custo, compara margem, corrige histórico e declara recebimento em desktop/mobile', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const nonce = randomUUID().slice(0, 8);
  const atelierId = `finance-e2e-${nonce}`;
  const email = `finance-${nonce}@cosmaker.test`;
  const password = `Local!${randomUUID().slice(0, 14)}aA1`;
  let uid: string | null = null;
  try {
    const user = await adminAuth.createUser({ email, password, emailVerified: true }); uid = user.uid;
    await Promise.all([
      adminDb.doc(`users/${uid}`).set({ id: uid, email, name: 'Financeiro sintético', accountType: 'atelier_member', atelierId, role: 'owner', permissions: [], active: true }),
      adminDb.doc(`ateliers/${atelierId}`).set({ name: 'Ateliê financeiro sintético', ownerId: uid, active: true }),
      adminDb.doc(`ateliers/${atelierId}/members/${uid}`).set({ userId: uid, role: 'owner', permissions: [], active: true }),
      adminDb.doc(`ateliers/${atelierId}/orders/finance-order`).set({ atelierId, status: 'confirmed', character: 'Armadura violeta', quoteId: 'synthetic-quote', description: 'Armadura', expectedDeliveryDate: '2027-01-10', approvedQuoteSnapshot: { total: 1000, depositAmount: 300 }, amountPaid: 300, amountPaidCents: 30000, amountRemaining: 700, amountRemainingCents: 70000, updatedAt: new Date() }),
    ]);
    await page.goto('/login?next=%2Fatelier%2Ffinanceiro');
    await expect(page.locator('meta[name="cosmaker-firebase-mode"]')).toHaveAttribute('content', 'emulator');
    await page.locator('#email').fill(email); await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Financeiro operacional', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Novo lançamento', exact: true }).click();
    let dialog = page.getByRole('dialog');
    await dialog.getByLabel('Categoria', { exact: true }).selectOption('labor');
    await dialog.getByLabel('Valor (R$)', { exact: true }).fill('125,50');
    await dialog.getByLabel('Descrição', { exact: true }).fill('Costura da armadura');
    await dialog.getByLabel('Pedido', { exact: true }).selectOption('finance-order');
    await dialog.getByRole('button', { name: 'Salvar lançamento', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Registro salvo.' })).toBeVisible();
    await expect(page.getByText('Margem sobre o acordo: 87,45%', { exact: true })).toBeVisible();
    let ledger = await adminDb.collection(`ateliers/${atelierId}/financeEntries`).get();
    expect(ledger.size).toBe(1); expect(ledger.docs[0].data()).toMatchObject({ category: 'labor', amountCents: 12550, orderId: 'finance-order' });
    await page.getByRole('button', { name: 'Corrigir lançamento', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByLabel('Motivo da correção', { exact: true }).fill('Valor informado em duplicidade pela equipe');
    await dialog.getByRole('button', { name: 'Registrar compensação', exact: true }).click();
    await expect(page.getByText('Compensado · original preservado', { exact: true })).toBeVisible();
    ledger = await adminDb.collection(`ateliers/${atelierId}/financeEntries`).get();
    expect(ledger.size).toBe(2);
    expect(ledger.docs.map((doc: { data(): { amountCents: number } }) => doc.data().amountCents).sort((a: number, b: number) => a - b)).toEqual([-12550, 12550]);
    await page.getByRole('link', { name: 'Recebimentos', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Recebimentos manuais', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Novo lançamento', exact: true }).click(); dialog = page.getByRole('dialog');
    await dialog.getByLabel('Valor (R$)', { exact: true }).fill('100');
    await dialog.getByLabel('Descrição', { exact: true }).fill('Parcela declarada pela equipe');
    await dialog.getByLabel('Pedido', { exact: true }).selectOption('finance-order');
    await dialog.getByLabel('Referência interna', { exact: true }).fill('Recibo sintético 001');
    await dialog.getByRole('button', { name: 'Salvar lançamento', exact: true }).click();
    await expect(page.getByText('Parcela declarada pela equipe', { exact: true })).toBeVisible();
    expect((await adminDb.doc(`ateliers/${atelierId}/orders/finance-order`).get()).data()).toMatchObject({ amountPaidCents: 40000, amountRemainingCents: 60000 });
    await page.getByRole('link', { name: 'Armadura violeta', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Financeiro do pedido', exact: true })).toBeVisible();
    await expect(page.getByText('Costura da armadura', { exact: true })).toBeVisible();
    for (const [title, heading] of [['Despesas', 'Custos e despesas'], ['Receitas', 'Receitas'], ['Resultados', 'Resultados financeiros']]) {
      await page.getByRole('navigation', { name: 'Áreas do financeiro' }).getByRole('link', { name: title, exact: true }).click();
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    }
    await expect(page.getByText('Margem sobre o acordo: 100%', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('finance-workflow.png'), fullPage: true });
    await page.reload(); await expect(page.getByText('Parcela declarada pela equipe', { exact: true })).toBeVisible();
    await adminDb.doc(`ateliers/${atelierId}/orders/finance-order/payments/deposit`).set({ type: 'deposit', amount: 300, status: 'paid', method: 'cash', confirmedBy: uid, paidAt: new Date(), createdAt: new Date() });
    await page.getByRole('link', { name: 'Armadura violeta', exact: true }).click();
    await page.getByRole('button', { name: 'Preparar correção deste recebimento', exact: true }).click();
    await expect(page.getByText('Recebimento manual anterior conciliado', { exact: true })).toBeVisible();
    expect((await adminDb.doc(`ateliers/${atelierId}/orders/finance-order`).get()).data()?.amountPaidCents).toBe(40000);
    await page.locator('article').filter({ has: page.getByText('Recebimento manual anterior conciliado', { exact: true }) }).getByRole('button', { name: 'Corrigir lançamento', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByLabel('Motivo da correção', { exact: true }).fill('Entrada anterior declarada por engano');
    await dialog.getByRole('button', { name: 'Registrar compensação', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect((await adminDb.doc(`ateliers/${atelierId}/orders/finance-order`).get()).data()).toMatchObject({ amountPaidCents: 10000, amountRemainingCents: 90000, status: 'confirmed' });
  } finally {
    await adminDb.recursiveDelete(adminDb.doc(`ateliers/${atelierId}`));
    const audits = await adminDb.collection('auditLogs').where('atelierId', '==', atelierId).get();
    await Promise.all(audits.docs.map((doc: { ref: { delete(): Promise<unknown> } }) => doc.ref.delete()));
    if (uid) { await adminDb.doc(`users/${uid}`).delete(); await adminAuth.deleteUser(uid); }
    await adminApp.delete();
  }
});
