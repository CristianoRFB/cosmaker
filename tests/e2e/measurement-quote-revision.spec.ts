import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const requireFunctions = createRequire(resolve('functions/package.json'));
const { initializeApp, deleteApp } = requireFunctions('firebase-admin/app');
const { getAuth } = requireFunctions('firebase-admin/auth');
const { getFirestore } = requireFunctions('firebase-admin/firestore');

test('equipe e cliente mantêm medidas pelo CRM e revisam orçamento preservando a versão anterior', async ({ page }, info) => {
  test.setTimeout(240_000);
  for (const name of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env[name] || '')) throw new Error('Teste exclusivo de demo-cosmaker nos emuladores.');
  const nonce = randomUUID().slice(0, 8); const app = initializeApp({ projectId: 'demo-cosmaker' }, `measure-revision-${nonce}`);
  const auth = getAuth(app); const db = getFirestore(app); const root = db.doc(`ateliers/measure-ui-${nonce}`); const now = new Date();
  const password = `Local!${nonce}aA1`; const uids: string[] = [];
  async function account(label: string, staff: boolean) {
    const email = `${label}-${nonce}@cosmaker.test`; const identity = await auth.createUser({ email, password, emailVerified: true }); uids.push(identity.uid);
    await db.doc(`users/${identity.uid}`).set({ name: label, email, accountType: staff ? 'atelier_member' : 'client', ...(staff ? { atelierId: root.id, role: 'owner' } : { role: 'client' }), permissions: [], active: true, createdAt: now, updatedAt: now });
    if (staff) await root.collection('members').doc(identity.uid).set({ active: true, role: 'owner', permissions: [] });
    return { uid: identity.uid, email };
  }
  async function signIn(email: string, route: string) {
    await page.goto(`/login?next=${encodeURIComponent(route)}`); await page.locator('#email').fill(email); await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click(); await expect(page).toHaveURL(new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
  }
  try {
    await root.set({ active: true, name: 'Ateliê de medidas sintético' });
    const owner = await account('owner', true); const customer = await account('customer', false);
    const client = root.collection('clients').doc('crm-independent-id');
    await client.set({ name: 'Cliente de medidas', email: customer.email, phone: '', userId: customer.uid, createdAt: now, updatedAt: now });
    const staffRoute = `/atelier/clientes/${client.id}/medidas`;
    await signIn(owner.email, staffRoute);
    await page.getByLabel('Nome da nova ficha').fill('Ficha de produção'); await page.getByRole('button', { name: 'Criar ficha', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Ficha de produção', exact: true })).toBeVisible();
    await page.getByLabel('Nome da medida', { exact: true }).fill('Tórax'); await page.getByLabel('Valor', { exact: true }).fill('88.5');
    await page.getByRole('button', { name: 'Adicionar medida', exact: true }).click(); await expect(page.getByText('Tórax', { exact: true })).toBeVisible();
    const profiles = await root.collection('measurementProfiles').get(); expect(profiles.size).toBe(1); const profile = profiles.docs[0].ref;
    expect(profiles.docs[0].get('clientId')).toBe(client.id); expect(profiles.docs[0].get('clientId')).not.toBe(customer.uid);
    const measurement = (await profile.collection('measurements').get()).docs[0].ref;
    expect((await measurement.get()).get('value')).toBe(88.5);
    await page.getByLabel('Nome da ficha', { exact: true }).fill('Ficha homologada');
    await page.getByLabel('Ficha ativa para novos pedidos').uncheck(); await page.getByRole('button', { name: 'Salvar ficha', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Ficha homologada', exact: true })).toBeVisible(); expect((await profile.get()).get('active')).toBe(false);
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await page.goto(staffRoute);
      await expect(page.getByText('Tórax', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`staff-measures-${width}.png`), fullPage: true });
    }
    await page.goto('/logout'); await expect(page).toHaveURL(/\/login$/);
    await signIn(customer.email, '/cliente/medidas');
    await expect(page.getByRole('heading', { name: 'Ficha homologada', exact: true })).toBeVisible();
    const clientRoute = `/cliente/medidas/${profile.id}?atelierId=${root.id}`;
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await page.goto(clientRoute);
      await expect(page.getByText('Tórax', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.getByLabel('Valor', { exact: true }).first().fill('90.5'); await page.getByRole('button', { name: 'Atualizar medida', exact: true }).click();
    await expect.poll(async () => (await measurement.get()).get('value'), { timeout: 15_000 }).toBe(90.5);
    await page.reload(); await expect(page.getByLabel('Valor', { exact: true }).first()).toHaveValue('90.5');
    await page.goto(`/cliente/medidas/nova?atelierId=${root.id}`); await page.getByLabel('Nome da ficha', { exact: true }).fill('Ficha criada pelo cliente');
    await page.getByRole('button', { name: 'Criar ficha', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Ficha criada pelo cliente', exact: true })).toBeVisible();
    const after = await root.collection('measurementProfiles').get(); expect(after.size).toBe(2); for (const row of after.docs) expect(row.get('clientId')).toBe(client.id);
    await page.goto('/logout'); await expect(page).toHaveURL(/\/login$/);
    const request = root.collection('quoteRequests').doc('request-ui'); const quote = root.collection('quotes').doc('quote-original');
    await request.set({ clientId: client.id, email: customer.email, name: 'Cliente de medidas', character: 'Armadura sintética', franchise: 'Obra sintética', category: 'armor', description: 'Projeto sintético para revisão.', desiredDeliveryDate: '2027-12-31', status: 'under_review', activeQuoteId: quote.id, createdAt: now, updatedAt: now });
    await quote.set({ atelierId: root.id, requestId: request.id, clientId: client.id, email: customer.email, status: 'draft', materialsCost: 0, laborCost: 300, otherCost: 0, urgencyFee: 0, shipping: 0, discount: 0, subtotal: 300, total: 300, depositAmount: 90, depositPercentage: 30, validUntil: '2027-12-31', createdAt: now, updatedAt: now });
    await quote.collection('items').doc('original-item').set({ description: 'Peça original', category: 'labor', quantity: 1, unitPrice: 300, total: 300, createdAt: now });
    const editRoute = `/atelier/orcamentos/${quote.id}/editar`; await signIn(owner.email, editRoute);
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await page.goto(editRoute);
      await expect(page.getByLabel('Descrição do item 1', { exact: true })).toHaveValue('Peça original');
      await expect(page.getByLabel('Preço unitário do item 1', { exact: true })).toHaveValue('300');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.getByLabel('Descrição do item 1', { exact: true }).fill('Peça revisada'); await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
    await expect(page).not.toHaveURL(/quote-original\/editar/); const revisedId = (await request.get()).get('activeQuoteId'); expect(revisedId).not.toBe(quote.id);
    expect((await quote.get()).get('status')).toBe('superseded'); expect((await quote.collection('items').doc('original-item').get()).get('description')).toBe('Peça original');
    expect((await root.collection('quotes').doc(revisedId).collection('items').get()).docs[0].get('description')).toBe('Peça revisada');
  } finally {
    await db.recursiveDelete(root); const audits = await db.collection('auditLogs').where('atelierId', '==', root.id).get(); await Promise.all(audits.docs.map((row: { ref: { delete(): Promise<unknown> } }) => row.ref.delete()));
    for (const uid of uids) { await db.doc(`users/${uid}`).delete(); await auth.deleteUser(uid); } await deleteApp(app);
  }
});
