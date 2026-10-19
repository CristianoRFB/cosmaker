import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { workflowContextOptions } from './workflow-context-options';

const host = process.env.FIREBASE_EMULATOR_HOST || '127.0.0.1';
if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('This workflow may only use a local Firebase Emulator.');
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= `${host}:${process.env.COSMAKER_AUTH_EMULATOR_PORT || '19099'}`;
process.env.FIRESTORE_EMULATOR_HOST ||= `${host}:${process.env.COSMAKER_FIRESTORE_EMULATOR_PORT || '18080'}`;
const requireFromFunctions = createRequire(resolve(process.cwd(), 'functions/package.json'));
const { initializeApp: initializeAdminApp } = requireFromFunctions('firebase-admin/app');
const { getAuth: getAdminAuth } = requireFromFunctions('firebase-admin/auth');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');
const adminApp = initializeAdminApp({ projectId: 'demo-cosmaker' }, `order-change-production-e2e-${randomUUID()}`);
const adminAuth = getAdminAuth(adminApp);
const adminDb = getFirestore(adminApp);

type Identity = { uid: string; email: string; password: string };
async function login(page: Page, identity: Identity, target: string) {
  await page.goto(`/login?next=${encodeURIComponent(target)}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('meta[name="cosmaker-firebase-mode"]')).toHaveAttribute('content', 'emulator');
  if (process.env.COSMAKER_E2E_MOBILE === 'true') {
    expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
    expect(await page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);
  }
  await page.locator('#email').fill(identity.email);
  await page.locator('#password').fill(identity.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(target.split('?')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

const canonicalStages = [
  { id: 'stage-start', name: 'A iniciar', order: 0, progressWeight: 5, requiresClientApproval: false },
  { id: 'stage-modeling', name: 'Modelagem', order: 1, progressWeight: 15, requiresClientApproval: false },
  { id: 'stage-production', name: 'Em produção', order: 2, progressWeight: 35, requiresClientApproval: false },
  { id: 'stage-fitting', name: 'Prova e ajustes', order: 3, progressWeight: 20, requiresClientApproval: true },
  { id: 'stage-finishing', name: 'Finalização', order: 4, progressWeight: 15, requiresClientApproval: false },
  { id: 'stage-shipping', name: 'Envio', order: 5, progressWeight: 10, requiresClientApproval: false },
];

test('equipe configura produção e aplica mudança somente após aprovação explícita do cliente', async ({ browser }) => {
  test.setTimeout(240_000);
  const nonce = randomUUID().slice(0, 8);
  const atelierA = `change-production-e2e-${nonce}-a`;
  const atelierB = `change-production-e2e-${nonce}-b`;
  const orderId = `order-change-${nonce}`;
  const quoteId = `quote-original-${nonce}`;
  const customName = `Pintura de acessórios ${nonce}`;
  const originalScope = 'Traje completo com capa e acabamento fosco';
  const revisedScope = 'Traje completo com capa, acabamento metálico e acessórios pintados';
  const reason = 'Cliente solicitou acabamento metálico e acessórios adicionais para o evento';
  const originalQuote = { total: 500.25, depositAmount: 100, depositPercentage: 20, expectedStartDate: '2027-02-01', expectedCompletionDate: '2027-03-10' };
  const identities: Identity[] = [];
  const contexts = await Promise.all([browser.newContext(workflowContextOptions()), browser.newContext(workflowContextOptions()), browser.newContext(workflowContextOptions())]);
  const [staffPage, clientPage, otherPage] = await Promise.all(contexts.map((context) => context.newPage()));

  async function createIdentity(label: string, accountType: 'atelier_member' | 'client', atelierId?: string, role = 'owner', permissions: string[] = []) {
    const email = `${label}-${nonce}@cosmaker.test`;
    const password = `Local!${randomUUID().slice(0, 14)}aA1`;
    const user = await adminAuth.createUser({ email, password, emailVerified: true, displayName: label });
    const identity = { uid: user.uid, email, password };
    identities.push(identity);
    await adminDb.doc(`users/${user.uid}`).set({ id: user.uid, email, name: label, accountType, active: true, permissions, ...(atelierId ? { atelierId, role } : { role: 'client' }) });
    if (atelierId) await adminDb.doc(`ateliers/${atelierId}/members/${user.uid}`).set({ userId: user.uid, role, permissions, active: true });
    return identity;
  }

  try {
    const owner = await createIdentity('owner-change-production-a', 'atelier_member', atelierA);
    const staff = await createIdentity('staff-change-production-a', 'atelier_member', atelierA, 'cosmaker', ['orders:read', 'orders:manage', 'finance:read', 'finance:write']);
    const ownerB = await createIdentity('owner-change-production-b', 'atelier_member', atelierB);
    const client = await createIdentity('client-change-production-a', 'client');
    const orderRef = adminDb.doc(`ateliers/${atelierA}/orders/${orderId}`);
    await Promise.all([
      adminDb.doc(`ateliers/${atelierA}`).set({ id: atelierA, name: 'Ateliê sintético de produção A', active: true, ownerId: owner.uid }),
      adminDb.doc(`ateliers/${atelierB}`).set({ id: atelierB, name: 'Ateliê sintético de produção B', active: true, ownerId: ownerB.uid }),
      adminDb.doc(`ateliers/${atelierA}/clients/${client.uid}`).set({ userId: client.uid, email: client.email, name: 'Cliente sintético do pedido', active: true }),
      orderRef.set({ atelierId: atelierA, quoteId, requestId: `request-${nonce}`, clientId: client.uid, clientUserId: client.uid, clientName: 'Cliente sintético', email: client.email, character: `Projeto de cosplay ${nonce}`, franchise: 'Universo fictício', category: 'Costura', description: originalScope, expectedDeliveryDate: '2027-03-15', status: 'confirmed', priority: 'normal', progress: 0, amountPaid: 100, amountPaidCents: 10000, amountRemaining: 400.25, amountRemainingCents: 40025, approvedQuoteSnapshot: originalQuote, createdAt: new Date(), updatedAt: new Date() }),
      orderRef.collection('payments').doc('deposit').set({ type: 'deposit', amount: 100, status: 'paid', method: 'cash', createdAt: new Date(), updatedAt: new Date() }),
      ...canonicalStages.map((stage) => orderRef.collection('productionStages').doc(stage.id).set({ ...stage, atelierId: atelierA, orderId, status: 'pending', progress: 0, version: 0, updatedAt: new Date() })),
    ]);

    const productionPath = `/atelier/pedidos/${orderId}/producao`;
    const orderPath = `/atelier/pedidos/${orderId}`;
    const clientPath = `/cliente/pedidos/${orderId}?atelierId=${atelierA}`;
    await login(staffPage, staff, productionPath);
    await staffPage.getByRole('button', { name: 'Configurar etapas, responsáveis e prazos', exact: true }).click();
    await expect(staffPage.getByRole('heading', { name: 'Configuração da produção', exact: true })).toBeVisible();
    await staffPage.getByLabel('Nome da etapa própria', { exact: true }).fill(customName);
    await staffPage.getByRole('combobox', { name: 'Fase', exact: true }).selectOption('in_production');
    await staffPage.getByRole('button', { name: 'Adicionar etapa', exact: true }).click();
    const customEditor = staffPage.locator('section').filter({ has: staffPage.getByRole('button', { name: `Remover ${customName}`, exact: true }) }).last();
    await customEditor.getByLabel('Nome', { exact: true }).fill(customName);
    await customEditor.getByRole('combobox', { name: 'Responsável', exact: true }).selectOption(staff.uid);
    await customEditor.getByLabel('Início planejado', { exact: true }).fill('2027-02-10');
    await customEditor.getByLabel('Prazo da etapa', { exact: true }).fill('2027-02-20');
    await customEditor.getByLabel('Peso no progresso', { exact: true }).fill('12');
    await customEditor.getByLabel('Exigir aprovação do cliente', { exact: true }).check();
    await staffPage.getByRole('button', { name: 'Salvar configuração', exact: true }).click();
    await expect(staffPage.getByText('Configuração da produção salva no pedido.', { exact: true })).toBeVisible();
    await expect(staffPage.getByRole('heading', { name: customName, exact: true }).first()).toBeVisible();
    const stages = await orderRef.collection('productionStages').orderBy('order', 'asc').get();
    expect(stages.size).toBe(7);
    expect(stages.docs.map((document: { id: string }) => document.id)).toEqual(expect.arrayContaining(canonicalStages.map((stage) => stage.id)));
    const custom = stages.docs.find((document: { id: string }) => document.id.startsWith('custom-'));
    expect(custom).toBeDefined();
    expect(custom.data()).toMatchObject({ name: customName, status: 'pending', progress: 0, semanticKey: 'in_production', assignedTo: staff.uid, plannedStartDate: '2027-02-10', deadline: '2027-02-20', progressWeight: 12, requiresClientApproval: true, version: 1 });
    expect((await orderRef.get()).get('productionConfigurationVersion')).toBe(1);
    expect((await orderRef.get()).get('approvedQuoteSnapshot')).toEqual(originalQuote);

    await staffPage.getByRole('link', { name: 'Voltar aos dados do pedido', exact: true }).click();
    await expect(staffPage).toHaveURL(new RegExp(`${orderPath}$`));
    await staffPage.getByRole('button', { name: 'Propor alteração do acordo', exact: true }).click();
    await staffPage.getByLabel('Motivo da alteração', { exact: true }).fill(reason);
    await staffPage.getByLabel('Alterar escopo', { exact: true }).check();
    await staffPage.getByRole('textbox', { name: 'Novo escopo', exact: true }).fill(revisedScope);
    await staffPage.getByLabel('Alterar prazo de entrega', { exact: true }).check();
    await staffPage.getByLabel('Nova data de entrega', { exact: true }).fill('2027-03-22');
    await staffPage.getByLabel('Alterar valor total', { exact: true }).check();
    await staffPage.getByLabel('Variação de valor (R$)', { exact: false }).fill('75,00');
    await staffPage.getByRole('button', { name: 'Enviar revisão para aprovação', exact: true }).click();
    await expect(staffPage.getByText('Revisão enviada para aprovação do cliente.', { exact: true })).toBeVisible();
    await expect(staffPage.getByRole('heading', { name: 'Proposta de alteração v1', exact: true })).toBeVisible();
    await expect(staffPage.getByRole('button', { name: 'Aplicar revisão aprovada', exact: true })).toHaveCount(0);
    const changes = await orderRef.collection('changeRequests').get();
    expect(changes.size).toBe(1);
    const changeRef = changes.docs[0].ref;
    expect(changes.docs[0].data()).toMatchObject({ status: 'pending', version: 1, requestedBy: staff.uid, baseAgreementVersion: 0, changes: { scope: revisedScope, expectedDeliveryDate: '2027-03-22', valueDeltaCents: 7500 }, baseAgreementSnapshot: { scope: originalScope, totalCents: 50025, depositAmountCents: 10000 }, proposedAgreementSnapshot: { scope: revisedScope, totalCents: 57525, depositAmountCents: 10000 } });
    expect((await orderRef.get()).data()).toMatchObject({ description: originalScope, expectedDeliveryDate: '2027-03-15', amountRemaining: 400.25, approvedQuoteSnapshot: originalQuote });
    expect((await orderRef.get()).get('currentAgreement')).toBeUndefined();

    await login(clientPage, client, clientPath);
    await expect(clientPage.getByRole('heading', { name: 'Proposta de alteração v1', exact: true })).toBeVisible();
    await expect(clientPage.getByRole('button', { name: 'Aprovar revisão v1', exact: true })).toBeDisabled();
    await expect(clientPage.getByRole('button', { name: 'Aplicar revisão aprovada', exact: true })).toHaveCount(0);
    await clientPage.getByLabel('Comentário sobre a revisão', { exact: true }).fill('Concordo com o acabamento, o novo prazo e o acréscimo de valor.');
    await clientPage.getByLabel('Li e concordo com o escopo, os materiais, o prazo e o valor apresentados na proposta de alteração v1.', { exact: true }).check();
    await clientPage.getByRole('button', { name: 'Aprovar revisão v1', exact: true }).click();
    await expect(clientPage.getByText('Acordo aprovado e registrado. O ateliê aplicará esta revisão.', { exact: true })).toBeVisible();
    const approval = (await changeRef.get()).data();
    expect(approval).toMatchObject({ status: 'approved', respondedBy: client.uid, approval: { clientUserId: client.uid, emailVerified: true, changeVersion: 1, baseAgreementVersion: 0, agreementSnapshot: { version: 1, scope: revisedScope, expectedDeliveryDate: '2027-03-22', totalCents: 57525, depositAmountCents: 10000 } } });
    expect(approval.approval.approvedAt).toBeDefined();
    expect((await orderRef.get()).get('currentAgreement')).toBeUndefined();
    expect((await orderRef.get()).get('approvedQuoteSnapshot')).toEqual(originalQuote);

    await staffPage.getByRole('button', { name: 'Atualizar revisões', exact: true }).click();
    await staffPage.getByRole('button', { name: 'Aplicar revisão aprovada', exact: true }).click();
    await expect(staffPage.getByText('Revisão aplicada ao pedido com snapshot e histórico preservados.', { exact: true })).toBeVisible();
    await expect(staffPage.getByText('Acordo vigente v1', { exact: false })).toBeVisible();
    const appliedOrder = (await orderRef.get()).data();
    expect(appliedOrder).toMatchObject({ agreementVersion: 1, description: revisedScope, expectedDeliveryDate: '2027-03-22', totalAmountCents: 57525, amountPaid: 100, amountPaidCents: 10000, amountRemaining: 475.25, amountRemainingCents: 47525, status: 'confirmed', planningNeedsReview: true, currentAgreement: { version: 1, sourceQuoteId: quoteId, scope: revisedScope, expectedDeliveryDate: '2027-03-22', totalCents: 57525, depositAmountCents: 10000 } });
    expect(appliedOrder.approvedQuoteSnapshot).toEqual(originalQuote);
    expect((await changeRef.get()).data()).toMatchObject({ status: 'applied', appliedBy: staff.uid, appliedAgreementVersion: 1 });
    const agreements = await orderRef.collection('agreementVersions').get();
    expect(agreements.size).toBe(2);
    expect(agreements.docs.find((document: { id: string }) => document.id === '0').data()).toMatchObject({ source: 'approved_quote', agreementSnapshot: { version: 0, scope: originalScope, totalCents: 50025, expectedDeliveryDate: '2027-03-15' } });
    expect(agreements.docs.find((document: { id: string }) => document.id === '1').data()).toMatchObject({ source: 'approved_change_request', approvedBy: client.uid, appliedBy: staff.uid, agreementSnapshot: { version: 1, totalCents: 57525, scope: revisedScope } });
    expect((await custom.ref.get()).data()).toMatchObject({ status: 'pending', name: customName, assignedTo: staff.uid, deadline: '2027-02-20', progress: 0 });
    const history = await orderRef.collection('statusHistory').get();
    expect(history.docs.map((document: { get(field: string): unknown }) => document.get('source'))).toEqual(expect.arrayContaining(['production_configuration_updated', 'order_change_proposed', 'order_change_approved', 'order_change_applied']));
    await clientPage.reload({ waitUntil: 'domcontentloaded' });
    await expect(clientPage.getByText('Acordo vigente v1', { exact: false })).toBeVisible();
    await expect(clientPage.getByText(revisedScope, { exact: true }).first()).toBeVisible();
    await expect(clientPage.getByRole('button', { name: 'Aprovar revisão v1', exact: true })).toHaveCount(0);

    await staffPage.getByRole('link', { name: 'Consultar registros financeiros do pedido', exact: true }).click();
    await expect(staffPage.getByRole('heading', { name: 'Registros financeiros do pedido', exact: true })).toBeVisible();
    await expect(staffPage.getByText('Saldo registrado', { exact: true })).toBeVisible();
    await expect(staffPage.getByText(/475,25/, { exact: false })).toBeVisible();
    await staffPage.getByRole('link', { name: 'Voltar ao pedido', exact: true }).click();
    await staffPage.getByRole('link', { name: 'Consultar histórico completo do pedido', exact: true }).click();
    await expect(staffPage.getByRole('heading', { name: 'Histórico do pedido', exact: true })).toBeVisible();
    await expect(staffPage.getByText('Acordo aprovado aplicado', { exact: true })).toBeVisible();

    // A tenant ID injected into the URL cannot change the staff workspace selected by membership.
    await login(otherPage, ownerB, `${productionPath}?atelierId=${atelierA}`);
    await expect(otherPage.getByText('O pedido não existe neste ateliê ou sua conta não pode acessá-lo.', { exact: true })).toBeVisible();
    await expect(otherPage.getByRole('button', { name: 'Configurar etapas, responsáveis e prazos', exact: true })).toHaveCount(0);
    await expect(otherPage.getByText(customName, { exact: true })).toHaveCount(0);
    expect((await adminDb.doc(`ateliers/${atelierB}/orders/${orderId}`).get()).exists).toBe(false);
    expect((await orderRef.get()).get('agreementVersion')).toBe(1);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    for (const atelierId of [atelierA, atelierB]) {
      await adminDb.recursiveDelete(adminDb.doc(`ateliers/${atelierId}`)).catch(() => undefined);
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
