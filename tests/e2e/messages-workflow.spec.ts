import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { workflowContextOptions } from './workflow-context-options';
import { expect, test } from '@playwright/test';

const host = process.env.FIREBASE_EMULATOR_HOST || '127.0.0.1';
const authPort = process.env.COSMAKER_AUTH_EMULATOR_PORT || '19099';
const firestorePort = process.env.COSMAKER_FIRESTORE_EMULATOR_PORT || '18080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= `${host}:${authPort}`;
process.env.FIRESTORE_EMULATOR_HOST ||= `${host}:${firestorePort}`;
process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= `${host}:${process.env.COSMAKER_STORAGE_EMULATOR_PORT || '19199'}`;

const requireFromFunctions = createRequire(resolve(process.cwd(), 'functions/package.json'));
const { initializeApp: initializeAdminApp } = requireFromFunctions('firebase-admin/app');
const { getAuth: getAdminAuth } = requireFromFunctions('firebase-admin/auth');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');
const projectId = 'demo-cosmaker';
const adminApp = initializeAdminApp({ projectId }, `messages-e2e-${randomUUID()}`);
const adminAuth = getAdminAuth(adminApp);
const adminDb = getFirestore(adminApp);
const { getStorage } = requireFromFunctions('firebase-admin/storage');
const bucket = getStorage(adminApp).bucket('demo-cosmaker.appspot.com');

test('conversa entre equipe e cliente, leitura, notificações, anexo protegido e isolamento em desktop/mobile', async ({ page, browser }, testInfo) => {
  test.setTimeout(240_000);
  const nonce = randomUUID().slice(0, 8); const atelierIds = [`messages-e2e-${nonce}-a`, `messages-e2e-${nonce}-b`]; const orderId = `order-${nonce}`;
  const clientContext = await browser.newContext(workflowContextOptions()); const clientPage = await clientContext.newPage();
  const otherContext = await browser.newContext(workflowContextOptions()); const otherPage = await otherContext.newPage();
  const password = `Local!${randomUUID().slice(0, 14)}aA1`; const created: Array<{ uid: string; email: string }> = [];
  const firstText = `Olá, seu projeto está em produção ${nonce}.`; const replyText = `Recebi a atualização, obrigada ${nonce}.`;
  const pdf = Buffer.from('%PDF-1.7\nCosmaker synthetic attachment only\n%%EOF');
  async function login(target: typeof page, email: string, next: string) {
    await target.goto(`/login?next=${encodeURIComponent(next)}`); await expect(target.locator('meta[name="cosmaker-firebase-mode"]')).toHaveAttribute('content', 'emulator');
    await target.locator('#email').fill(email); await target.locator('#password').fill(password); await target.getByRole('button', { name: 'Entrar', exact: true }).click();
  }
  try {
    for (const label of ['owner-a', 'client', 'owner-b']) { const email = `${label}-${nonce}@cosmaker.test`; const user = await adminAuth.createUser({ email, password, emailVerified: true }); created.push({ uid: user.uid, email }); }
    const [owner, client, other] = created;
    await Promise.all([
      adminDb.doc(`users/${owner.uid}`).set({ id: owner.uid, email: owner.email, name: 'Equipe sintética', accountType: 'atelier_member', atelierId: atelierIds[0], active: true, role: 'owner', permissions: [] }),
      adminDb.doc(`users/${client.uid}`).set({ id: client.uid, email: client.email, name: 'Cliente sintético', accountType: 'client', active: true, role: 'client', permissions: [] }),
      adminDb.doc(`users/${other.uid}`).set({ id: other.uid, email: other.email, name: 'Outro ateliê sintético', accountType: 'atelier_member', atelierId: atelierIds[1], active: true, role: 'owner', permissions: [] }),
      adminDb.doc(`ateliers/${atelierIds[0]}`).set({ active: true, ownerId: owner.uid, name: 'Ateliê sintético A' }),
      adminDb.doc(`ateliers/${atelierIds[1]}`).set({ active: true, ownerId: other.uid, name: 'Ateliê sintético B' }),
      adminDb.doc(`ateliers/${atelierIds[0]}/members/${owner.uid}`).set({ active: true, role: 'owner', permissions: [] }),
      adminDb.doc(`ateliers/${atelierIds[1]}/members/${other.uid}`).set({ active: true, role: 'owner', permissions: [] }),
      adminDb.doc(`ateliers/${atelierIds[0]}/clients/client-linked`).set({ name: 'Cliente sintético', userId: client.uid, email: client.email }),
      adminDb.doc(`ateliers/${atelierIds[0]}/orders/${orderId}`).set({ atelierId: atelierIds[0], quoteId: 'quote-synthetic', requestId: 'request-synthetic', character: 'Armadura sintética', franchise: 'Universo sintético', category: 'armor', description: 'Projeto sintético de armadura.', status: 'confirmed', priority: 'normal', progress: 0, expectedDeliveryDate: '2027-10-22', approvedQuoteSnapshot: { total: 1000, depositAmount: 300, depositPercentage: 30 }, amountPaid: 300, amountPaidCents: 30000, amountRemaining: 700, amountRemainingCents: 70000, clientId: 'client-linked', clientUserId: client.uid, clientName: 'Cliente sintético', email: client.email, createdAt: new Date(), updatedAt: new Date() }),
    ]);
    const path = `ateliers/${atelierIds[0]}/orders/${orderId}/attachments/shared-file`;
    await bucket.file(path).save(pdf, { resumable: false, metadata: { contentType: 'application/pdf', cacheControl: 'private, no-store' } });
    const fileRef = adminDb.doc(`ateliers/${atelierIds[0]}/orders/${orderId}/files/shared-file`);
    await fileRef.set({ atelierId: atelierIds[0], orderId, storagePath: path, source: 'order_upload', originalName: 'Referência sintética.pdf', contentType: 'application/pdf', size: pdf.length, uploadStatus: 'ready', visibleToClient: true, archived: false, createdAt: new Date() });
    await login(page, owner.email, `/atelier/pedidos/${orderId}`);
    await page.getByRole('link', { name: 'Conversar sobre este pedido →', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Mensagens de pedidos', exact: true })).toBeVisible();
    await page.getByLabel('Mensagem', { exact: true }).fill(firstText); await page.getByLabel('Referência sintética.pdf', { exact: true }).check();
    await page.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
    await expect(page.getByRole('list', { name: 'Histórico da conversa' }).getByText(firstText, { exact: true })).toBeVisible();
    await login(clientPage, client.email, `/cliente/mensagens/${orderId}?atelierId=${atelierIds[0]}`);
    await expect(clientPage.getByRole('list', { name: 'Histórico da conversa' }).getByText(firstText, { exact: true })).toBeVisible();
    const downloadEvent = clientPage.waitForEvent('download');
    await clientPage.getByRole('list', { name: 'Histórico da conversa' }).getByRole('button', { name: 'Baixar Referência sintética.pdf', exact: true }).click();
    const download = await downloadEvent; const downloaded = await download.path(); expect(downloaded).toBeTruthy(); expect(await readFile(downloaded!)).toEqual(pdf);
    await clientPage.getByLabel('Mensagem', { exact: true }).fill(replyText); await clientPage.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
    await expect(clientPage.getByRole('list', { name: 'Histórico da conversa' }).getByText(replyText, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Atualizar conversas', exact: true }).click();
    await expect(page.getByRole('list', { name: 'Histórico da conversa' }).getByText(replyText, { exact: true })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Histórico da conversa' }).getByText('Lida', { exact: true })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: testInfo.outputPath('messages-staff.png'), fullPage: true });
    await clientPage.goto('http://127.0.0.1:3000/cliente/notificacoes'); await expect(clientPage.getByRole('heading', { name: 'Notificações internas', exact: true })).toBeVisible();
    await expect(clientPage.getByText('Não lida', { exact: true })).toBeVisible();
    await clientPage.getByRole('button', { name: 'Marcar como lida', exact: true }).click(); await expect(clientPage.getByText('Lida', { exact: true })).toBeVisible();
    await clientPage.getByRole('link', { name: 'Abrir conversa →', exact: true }).click();
    await expect(clientPage.getByRole('list', { name: 'Histórico da conversa' }).getByText(replyText, { exact: true })).toBeVisible();
    await fileRef.update({ visibleToClient: false }); await clientPage.getByRole('button', { name: 'Atualizar conversas', exact: true }).click();
    await expect(clientPage.getByText('Anexo indisponível ou compartilhamento revogado', { exact: true })).toBeVisible();
    await expect(clientPage.getByRole('button', { name: 'Baixar Referência sintética.pdf', exact: true })).toHaveCount(0);
    await clientPage.reload(); await expect(clientPage.getByRole('list', { name: 'Histórico da conversa' }).getByText(replyText, { exact: true })).toBeVisible();
    expect(await clientPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await clientPage.evaluate(() => window.scrollTo(0, 0)); await clientPage.screenshot({ path: testInfo.outputPath('messages-client.png'), fullPage: true });
    await page.goto('/atelier/configuracoes/notificacoes'); await expect(page.getByText(replyText, { exact: true })).toBeVisible();
    await login(otherPage, other.email, `/atelier/mensagens?pedidoId=${orderId}&atelierId=${atelierIds[0]}`);
    await expect(otherPage.getByRole('alert').filter({ hasText: 'Este pedido não está disponível' })).toBeVisible(); await expect(otherPage.getByText(firstText, { exact: true })).toHaveCount(0);
    const ledger = await adminDb.collection(`ateliers/${atelierIds[0]}/conversations/${orderId}/messages`).get(); expect(ledger.size).toBe(2);
  } finally {
    await clientContext.close(); await otherContext.close();
    for (const id of atelierIds) {
      const [files] = await bucket.getFiles({ prefix: `ateliers/${id}/orders/` }); await Promise.all(files.map((file: { delete(): Promise<unknown> }) => file.delete()));
      await adminDb.recursiveDelete(adminDb.doc(`ateliers/${id}`));
      const logs = await adminDb.collection('auditLogs').where('atelierId', '==', id).get(); await Promise.all(logs.docs.map((doc: { ref: { delete(): Promise<unknown> } }) => doc.ref.delete()));
    }
    for (const user of created) { await adminAuth.deleteUser(user.uid); await adminDb.doc(`users/${user.uid}`).delete(); }
    await adminApp.delete();
  }
});
