import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const requireFunctions = createRequire(resolve('functions/package.json'));
const { initializeApp, deleteApp } = requireFunctions('firebase-admin/app');
const { getAuth } = requireFunctions('firebase-admin/auth');
const { getFirestore } = requireFunctions('firebase-admin/firestore');

test('portal persiste perfil e consulta home/pagamentos reais em quatro larguras, sem dados de outro cliente', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  for (const name of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env[name] || '')) throw new Error('Teste exclusivo do Emulator local.');
  const nonce = randomUUID().slice(0, 8); const app = initializeApp({ projectId: 'demo-cosmaker' }, `portal-ui-${nonce}`);
  const auth = getAuth(app); const db = getFirestore(app); const root = db.doc(`ateliers/portal-${nonce}`);
  const email = `portal-${nonce}@cosmaker.test`; const password = `Local!${nonce}aA1`;
  const customer = await auth.createUser({ email, password, emailVerified: true });
  const profile = db.doc(`users/${customer.uid}`); const now = new Date();
  const order = root.collection('orders').doc('visible-order'); const quote = root.collection('quotes').doc('pending-proposal');
  const query = `atelierId=${root.id}&orderId=${order.id}`;
  const signIn = async () => { await page.goto('/login?next=%2Fcliente'); await page.locator('#email').fill(email); await page.locator('#password').fill(password); await page.getByRole('button', { name: 'Entrar', exact: true }).click(); await expect(page).toHaveURL(/\/cliente$/); };
  try {
    await root.set({ active: true, name: 'Ateliê sintético' });
    await profile.set({ name: 'Cliente portal', email, phone: '', accountType: 'client', role: 'client', permissions: [], active: true, createdAt: now, updatedAt: now });
    const value = { quoteId: 'original', requestId: 'request', clientUserId: customer.uid, clientId: null, email, clientName: 'Cliente portal', character: 'Armadura do portal', franchise: 'Obra sintética', category: 'armor', description: 'Projeto fictício', expectedDeliveryDate: '2027-12-31', status: 'in_production', progress: 41, approvedQuoteSnapshot: { total: 100, depositAmount: 30, depositPercentage: 30 }, amountPaid: 30, amountPaidCents: 3000, amountRemaining: 70, amountRemainingCents: 7000, createdAt: now, updatedAt: now };
    await order.set({ ...value, internalNotes: 'PRIVATE ORDER NOTE', approvedQuoteSnapshot: { ...value.approvedQuoteSnapshot, laborCost: 18, materialsCost: 22 } });
    await root.collection('orders').doc('foreign-order').set({ ...value, clientUserId: 'ANOTHER-CLIENT-UID', character: 'PRIVATE FOREIGN PROJECT' });
    await order.collection('payments').doc('deposit').set({ type: 'deposit', status: 'paid', amount: 30, amountCents: 3000, method: 'cash', reference: 'PRIVATE REFERENCE', confirmedBy: 'PRIVATE STAFF UID', createdAt: now, paidAt: now });
    await quote.set({ clientUserId: customer.uid, requestId: 'pending-request', email, clientId: null, status: 'sent', materialsCost: 0, laborCost: 200, otherCost: 0, urgencyFee: 0, shipping: 0, discount: 0, subtotal: 200, total: 200, depositAmount: 60, depositPercentage: 30, validUntil: '2027-12-31', createdAt: now });
    await signIn();
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/cliente');
      await expect(page.getByRole('heading', { name: 'Olá, Cliente portal' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Armadura do portal' })).toBeVisible();
      await expect(page.getByText('Em produção · 41% de produção')).toBeVisible();
      await expect(page.getByRole('link', { name: /Analisar proposta pending-proposal/ })).toBeVisible();
      await expect(page.getByText('PRIVATE FOREIGN PROJECT')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`home-${width}.png`), fullPage: true });
      await page.goto('/cliente/perfil');
      await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('Cliente portal');
      await expect(page.getByLabel('E-mail da conta')).toHaveAttribute('readonly', '');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const projection = page.waitForResponse(response => response.url().includes('/getClientOrder'));
      await page.goto(`/cliente/pedidos/${order.id}?atelierId=${root.id}`);
      await expect(page.getByRole('heading', { name: 'Armadura do portal', exact: true })).toBeVisible();
      expect(JSON.stringify(await (await projection).json())).not.toMatch(/PRIVATE ORDER NOTE|laborCost|materialsCost|clientUserId/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`order-${width}.png`), fullPage: true });
      await page.goto(`/cliente/pagamentos?${query}`);
      await expect(page.getByRole('heading', { name: 'Entrada', exact: true })).toBeVisible();
      await expect(page.getByText('Recebimento confirmado', { exact: true })).toBeVisible();
      await expect(page.getByText('PRIVATE REFERENCE')).toHaveCount(0); await expect(page.getByText('PRIVATE STAFF UID')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`payments-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 375, height: 900 });
    await page.getByRole('link', { name: 'Detalhes do registro', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Detalhe do pagamento' })).toBeVisible();
    await expect(page.getByText('Recebimento confirmado', { exact: true })).toBeVisible();
    await page.goto('/cliente/perfil'); await page.getByLabel('Nome', { exact: true }).fill('Nome atualizado'); await page.getByLabel('Telefone', { exact: true }).fill('11900000000');
    await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click(); await expect(page.getByText('Perfil salvo.', { exact: true }).first()).toBeVisible();
    await page.reload(); await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('Nome atualizado'); await expect(page.getByLabel('Telefone', { exact: true })).toHaveValue('11900000000');
    const saved = (await profile.get()).data(); expect(saved).toMatchObject({ email, accountType: 'client', role: 'client', permissions: [], active: true }); expect(saved.createdAt.toMillis()).toBe(now.getTime()); expect(saved.atelierId).toBeUndefined();
    await page.goto('/cliente'); await expect(page.getByRole('heading', { name: 'Olá, Nome atualizado' })).toBeVisible();
    await page.route('**/listClientOrderPayments', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { status: 'UNAVAILABLE', message: 'Falha temporária sintética.' } }) }));
    await page.goto(`/cliente/pagamentos?${query}`); await expect(page.locator('section [role="alert"]')).toContainText('Falha temporária sintética.');
    await page.unroute('**/listClientOrderPayments'); await page.getByRole('button', { name: 'Tentar novamente' }).click(); await expect(page.getByRole('heading', { name: 'Entrada', exact: true })).toBeVisible();
    await page.goto(`/cliente/pagamentos?atelierId=${root.id}&orderId=foreign-order`); await expect(page.locator('section [role="alert"]')).toBeVisible(); await expect(page.getByText('Recebimento confirmado', { exact: true })).toHaveCount(0);
    await order.collection('payments').doc('deposit').delete();
    await page.goto(`/cliente/pagamentos?${query}`); await expect(page.getByRole('heading', { name: 'Nenhum registro de pagamento' })).toBeVisible();
    const more = db.batch();
    for (let index = 0; index < 51; index++) more.set(root.collection('orders').doc(`older-${String(index).padStart(2, '0')}`), { ...value, character: `Projeto anterior ${index}`, createdAt: new Date(now.getTime() - 1000 - index) });
    await more.commit();
    await page.goto('/cliente/pedidos'); await expect(page.getByRole('link', { name: /Abrir pedido/ })).toHaveCount(50);
    await page.getByRole('button', { name: 'Carregar mais pedidos', exact: true }).click(); await expect(page.getByRole('link', { name: /Abrir pedido/ })).toHaveCount(52);
    await page.goto('/cliente/pagamentos'); await page.getByRole('button', { name: 'Carregar mais pedidos', exact: true }).click();
    await expect(page.locator('#payment-order option')).toHaveCount(53);
    await page.locator('#payment-order').selectOption(`${root.id}/older-50`); await expect(page.getByRole('heading', { name: 'Projeto anterior 50', exact: true })).toBeVisible();
    await page.goto('/logout'); await expect(page).toHaveURL(/\/login$/);
    await auth.updateUser(customer.uid, { email: `moved-${nonce}@cosmaker.test`, emailVerified: true });
    const replacement = await auth.createUser({ email, password, emailVerified: true });
    try {
      await db.doc(`users/${replacement.uid}`).set({ name: 'Outra conta', email, accountType: 'client', role: 'client', permissions: [], active: true });
      await signIn(); await expect(page.getByText('Seus pedidos aparecerão após a aprovação de uma proposta.')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Armadura do portal' })).toHaveCount(0);
      await page.goto(`/cliente/pagamentos?${query}`); await expect(page.locator('section [role="alert"]')).toBeVisible();
    } finally { await db.doc(`users/${replacement.uid}`).delete(); await auth.deleteUser(replacement.uid); }
  } finally { await db.recursiveDelete(root); await profile.delete(); await auth.deleteUser(customer.uid); await deleteApp(app); }
});
