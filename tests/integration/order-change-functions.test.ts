import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

const requireFromFunctions = createRequire(new URL('../../functions/package.json', import.meta.url));
const { initializeApp: initializeAdminApp, deleteApp: deleteAdminApp } = requireFromFunctions('firebase-admin/app');
const { getAuth: getAdminAuth } = requireFromFunctions('firebase-admin/auth');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');
const projectId = 'demo-cosmaker';
const nonce = randomUUID().slice(0, 8);
const adminApp = initializeAdminApp({ projectId }, `order-change-tests-${nonce}`);
const adminAuth = getAdminAuth(adminApp);
const adminDb = getFirestore(adminApp);
const clientApp = initializeApp({ apiKey: 'emulator-only-key', authDomain: `${projectId}.firebaseapp.com`, projectId, appId: 'emulator-only-app' }, `order-change-client-${nonce}`);
const auth = getAuth(clientApp);
const functions = getFunctions(clientApp, 'us-central1');
const emulatorHost = process.env.FIREBASE_EMULATOR_HOST || '127.0.0.1';
connectAuthEmulator(auth, `http://${emulatorHost}:${process.env.COSMAKER_AUTH_EMULATOR_PORT || '19099'}`, { disableWarnings: true });
connectFunctionsEmulator(functions, emulatorHost, Number(process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || 15001));

type Identity = { uid: string; email: string; password: string };
type Agreement = { version: number; scope: string; materials: string; expectedDeliveryDate: string; totalCents: number; depositAmountCents: number };
type Change = { id: string; version: number; status: string; baseAgreementSnapshot: Agreement; proposedAgreementSnapshot: Agreement; proposalFingerprint: string; supersededBy: string | null };
type Page = { requests: Change[]; currentAgreement: Agreement; currentAgreementFingerprint: string; nextCursor: string | null };
const createdUids: string[] = [];
const ateliers = [`order-change-${nonce}-a`, `order-change-${nonce}-b`];
let ownerA: Identity;
let ownerB: Identity;
let clientA: Identity;
let clientB: Identity;
let staff: Identity;
let unverified: Identity;
const ids = () => randomUUID();

async function identity(label: string, verified = true): Promise<Identity> {
  const email = `${label}-${nonce}@cosmaker.test`;
  const password = `Local!${ids().slice(0, 14)}aA1`;
  const user = await adminAuth.createUser({ email, password, displayName: label, emailVerified: verified });
  createdUids.push(user.uid);
  return { uid: user.uid, email, password };
}

async function seedMember(atelierId: string, user: Identity, role = 'owner', permissions: string[] = []) {
  await Promise.all([
    adminDb.doc(`users/${user.uid}`).set({ id: user.uid, email: user.email, accountType: 'atelier_member', atelierId, role, permissions, active: true }),
    adminDb.doc(`ateliers/${atelierId}/members/${user.uid}`).set({ userId: user.uid, role, permissions, active: true }),
  ]);
}

async function signIn(user: Identity) {
  await signOut(auth).catch(() => undefined);
  await signInWithEmailAndPassword(auth, user.email, user.password);
  await auth.currentUser?.getIdToken(true);
}

function call<T = Record<string, unknown>>(name: string, input: Record<string, unknown>) {
  return httpsCallable<Record<string, unknown>, T>(functions, name)(input).then((result) => result.data);
}

async function seedOrder(label: string, extra: Record<string, unknown> = {}) {
  const orderId = `order-${label}-${nonce}`;
  const approvedQuoteSnapshot = { total: 500.25, depositAmount: 100, depositPercentage: 20 };
  await adminDb.doc(`ateliers/${ateliers[0]}/orders/${orderId}`).set({ quoteId: `quote-${label}`, requestId: `request-${label}`, clientId: clientA.uid,
    clientUserId: clientA.uid, email: clientA.email, description: 'Traje completo com capa', expectedDeliveryDate: '2027-03-15',
    character: 'Projeto fictício', status: 'waiting_deposit', amountPaid: 0, amountRemaining: 500.25, progress: 0, approvedQuoteSnapshot,
    createdAt: new Date(), updatedAt: new Date(), ...extra });
  await adminDb.doc(`ateliers/${ateliers[0]}/orders/${orderId}/payments/deposit`).set({ type: 'deposit', amount: 100,
    status: extra.status && extra.status !== 'waiting_deposit' ? 'paid' : 'pending', method: null, createdAt: new Date(), updatedAt: new Date() });
  return { orderId, approvedQuoteSnapshot, ref: adminDb.doc(`ateliers/${ateliers[0]}/orders/${orderId}`) };
}

async function page(orderId: string, extra: Record<string, unknown> = {}) {
  return call<Page>('listOrderChangeRequests', { atelierId: ateliers[0], orderId, ...extra });
}

async function propose(orderId: string, changes: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const current = await page(orderId);
  return call<{ changeRequestId: string; version: number; status: string }>('proposeOrderChangeRequest', { atelierId: ateliers[0], orderId, requestId: ids(),
    baseAgreementVersion: current.currentAgreement.version, baseAgreementFingerprint: current.currentAgreementFingerprint,
    reason: 'Ajuste solicitado para o projeto fictício', changes, ...extra });
}

function respond(orderId: string, change: Change, decision = 'approved', extra: Record<string, unknown> = {}) {
  return call('respondToOrderChangeRequest', { atelierId: ateliers[0], orderId, changeRequestId: change.id, requestId: ids(),
    version: change.version, proposalFingerprint: change.proposalFingerprint, decision, comment: decision === 'approved' ? '' : 'Solicito outra opção de material', confirmed: decision === 'approved', ...extra });
}

function apply(orderId: string, change: Change, requestId = ids()) {
  return call('applyOrderChangeRequest', { atelierId: ateliers[0], orderId, changeRequestId: change.id, requestId, version: change.version, proposalFingerprint: change.proposalFingerprint });
}

beforeAll(async () => {
  [ownerA, ownerB, clientA, clientB, staff, unverified] = await Promise.all([
    identity('owner-change-a'), identity('owner-change-b'), identity('client-change-a'), identity('client-change-b'), identity('staff-change-a'), identity('unverified-change-a', false),
  ]);
  await Promise.all(ateliers.map((atelierId, index) => adminDb.doc(`ateliers/${atelierId}`).set({ active: true, ownerId: [ownerA, ownerB][index].uid, name: 'Ateliê sintético' })));
  await Promise.all([seedMember(ateliers[0], ownerA), seedMember(ateliers[1], ownerB), seedMember(ateliers[0], staff, 'cosmaker', ['orders:read', 'orders:manage']), seedMember(ateliers[0], unverified)]);
  for (const client of [clientA, clientB]) await adminDb.doc(`users/${client.uid}`).set({ id: client.uid, email: client.email, accountType: 'client', active: true });
  await adminDb.doc(`ateliers/${ateliers[0]}/clients/${clientA.uid}`).set({ userId: clientA.uid, email: clientA.email, name: 'Cliente sintético' });
}, 30_000);

afterAll(async () => {
  for (const atelierId of ateliers) {
    await adminDb.recursiveDelete(adminDb.doc(`ateliers/${atelierId}`));
    const audits = await adminDb.collection('auditLogs').where('atelierId', '==', atelierId).get();
    await Promise.all(audits.docs.map((audit: { ref: { delete: () => Promise<unknown> } }) => audit.ref.delete()));
  }
  for (const uid of createdUids) {
    await adminAuth.deleteUser(uid).catch(() => undefined);
    await adminDb.doc(`users/${uid}`).delete();
  }
  await deleteApp(clientApp);
  await deleteAdminApp(adminApp);
}, 30_000);

describe('Mudanças formais de pedido no Functions Emulator', () => {
  it('preserva a proposta original e a trava de entrada; aprova e aplica uma versão com retries seguros', async () => {
    const { orderId, approvedQuoteSnapshot, ref } = await seedOrder('happy');
    await signIn(ownerA);
    const current = await page(orderId);
    const input = { atelierId: ateliers[0], orderId, requestId: ids(), baseAgreementVersion: 0, baseAgreementFingerprint: current.currentAgreementFingerprint,
      reason: 'Alterar capa e material conforme pedido do cliente', changes: { scope: 'Traje com capa bordada', materials: 'Linho com acabamento bordado', expectedDeliveryDate: '2027-03-20', valueDeltaCents: 5025 } };
    const first = await call('proposeOrderChangeRequest', input);
    expect(first).toMatchObject({ changeRequestId: input.requestId, version: 1, status: 'pending', alreadyApplied: false });
    expect(await call('proposeOrderChangeRequest', input)).toMatchObject({ alreadyApplied: true });
    await expect(call('proposeOrderChangeRequest', { ...input, reason: 'Outro motivo usando mesmo identificador' })).rejects.toMatchObject({ code: 'functions/already-exists' });
    const change = (await page(orderId)).requests[0];
    await expect(apply(orderId, change)).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await signIn(clientA);
    await expect(respond(orderId, change, 'approved', { confirmed: false })).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    await expect(respond(orderId, change, 'approved', { proposalFingerprint: 'a'.repeat(64) })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    const responseId = ids();
    expect(await respond(orderId, change, 'approved', { requestId: responseId })).toMatchObject({ status: 'approved', alreadyApplied: false });
    expect(await respond(orderId, change, 'approved', { requestId: responseId })).toMatchObject({ alreadyApplied: true });
    expect((await ref.get()).data()).toMatchObject({ status: 'waiting_deposit', amountPaid: 0, amountRemaining: 500.25, description: 'Traje completo com capa' });
    await signIn(ownerA);
    const applyId = ids();
    expect(await apply(orderId, change, applyId)).toMatchObject({ status: 'applied', agreementVersion: 1, alreadyApplied: false });
    expect(await apply(orderId, change, applyId)).toMatchObject({ alreadyApplied: true });
    const order = (await ref.get()).data();
    expect(order).toMatchObject({ status: 'waiting_deposit', progress: 0, amountPaid: 0, amountRemaining: 550.5, amountRemainingCents: 55050,
      totalAmountCents: 55050, agreementVersion: 1, description: 'Traje com capa bordada', expectedDeliveryDate: '2027-03-20', planningNeedsReview: true });
    expect(order.approvedQuoteSnapshot).toEqual(approvedQuoteSnapshot);
    expect((await ref.collection('agreementVersions').get()).size).toBe(2);
    expect((await ref.collection('changeRequests').doc(change.id).get()).data()).toMatchObject({ approval: { clientUserId: clientA.uid, emailVerified: true, agreementSnapshot: { totalCents: 55050 } }, status: 'applied' });
    expect((await ref.collection('statusHistory').get()).size).toBe(3);
    expect((await ref.collection('productionStages').get()).empty).toBe(true);
    expect(await call('confirmOrderDeposit', { atelierId: ateliers[0], orderId, method: 'cash', reference: 'Confirmação fictícia no Emulator' })).toMatchObject({ status: 'confirmed' });
    expect((await ref.get()).data()).toMatchObject({ status: 'confirmed', amountPaid: 100, amountPaidCents: 10000,
      amountRemaining: 450.5, amountRemainingCents: 45050, approvedQuoteSnapshot });
  }, 45_000);

  it('nega outro tenant, outro cliente, sessão não verificada e alteração financeira sem permissão', async () => {
    const { orderId } = await seedOrder('access');
    await signIn(ownerA);
    await propose(orderId, { scope: 'Escopo revisado do traje' });
    const change = (await page(orderId)).requests[0];
    await signIn(ownerB);
    await expect(page(orderId)).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await expect(apply(orderId, change)).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await signIn(clientB);
    await expect(respond(orderId, change)).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await signIn(staff);
    await expect(propose(orderId, { valueDeltaCents: 100 })).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await signIn(unverified);
    await expect(page(orderId)).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await signIn(clientA);
    const current = await page(orderId);
    await expect(call('proposeOrderChangeRequest', { atelierId: ateliers[0], orderId, requestId: ids(), baseAgreementVersion: 0,
      baseAgreementFingerprint: current.currentAgreementFingerprint, reason: 'O cliente tenta aplicar sem equipe', changes: { scope: 'Escopo indevido' } })).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await adminDb.doc(`ateliers/${ateliers[0]}/clients/${clientA.uid}`).update({ userId: clientB.uid });
    await expect(respond(orderId, change)).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await adminDb.doc(`ateliers/${ateliers[0]}/clients/${clientA.uid}`).update({ userId: clientA.uid });
  }, 45_000);

  it('preserva recusa e pedido de ajuste, emite nova revisão e cancela pendência de forma auditada', async () => {
    const { orderId, ref } = await seedOrder('revision');
    await signIn(ownerA);
    await propose(orderId, { materials: 'Espuma de alta densidade' });
    const first = (await page(orderId)).requests[0];
    await signIn(clientA);
    expect(await respond(orderId, first, 'changes_requested')).toMatchObject({ status: 'changes_requested' });
    await signIn(ownerA);
    const revised = await propose(orderId, { materials: 'Espuma de média densidade' }, { supersedesId: first.id });
    expect(revised.version).toBe(2);
    const result = await page(orderId, { pageSize: 1 });
    expect(result.requests).toHaveLength(1);
    expect(result.nextCursor).toBeTruthy();
    const previous = await page(orderId, { pageSize: 1, cursor: result.nextCursor });
    expect(previous.requests[0]).toMatchObject({ id: first.id, status: 'changes_requested', supersededBy: revised.changeRequestId });
    const second = result.requests[0];
    await signIn(clientA);
    expect(await respond(orderId, second, 'rejected')).toMatchObject({ status: 'rejected' });
    await signIn(ownerA);
    await propose(orderId, { materials: 'Tecido reforçado' }, { supersedesId: second.id });
    const third = (await page(orderId)).requests[0];
    const cancellation = { atelierId: ateliers[0], orderId, changeRequestId: third.id, requestId: ids(), reason: 'Cliente manteve a proposta original' };
    expect(await call('cancelOrderChangeRequest', cancellation)).toMatchObject({ status: 'cancelled', alreadyApplied: false });
    expect(await call('cancelOrderChangeRequest', cancellation)).toMatchObject({ alreadyApplied: true });
    expect((await ref.get()).data()).toMatchObject({ description: 'Traje completo com capa', amountRemaining: 500.25 });
    expect((await ref.collection('changeRequests').get()).size).toBe(3);
  }, 45_000);

  it('serializa aplicações concorrentes e impede aprovação de base desatualizada', async () => {
    const { orderId, ref } = await seedOrder('race', { status: 'confirmed', amountPaid: 100, amountRemaining: 400.25 });
    await signIn(ownerA);
    await propose(orderId, { scope: 'Traje com capa e luvas' });
    await propose(orderId, { materials: 'Couro sintético' });
    await propose(orderId, { expectedDeliveryDate: '2027-04-01' });
    const changes = (await page(orderId)).requests;
    await signIn(clientA);
    await respond(orderId, changes[0]);
    await respond(orderId, changes[1]);
    await signIn(ownerA);
    const attempts = await Promise.allSettled([apply(orderId, changes[0]), apply(orderId, changes[1])]);
    expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const failed = attempts.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    expect(failed.reason.code).toBe('functions/aborted');
    expect((await ref.get()).data()).toMatchObject({ agreementVersion: 1, status: 'confirmed', amountPaid: 100, amountRemaining: 400.25 });
    await signIn(clientA);
    await expect(respond(orderId, changes[2])).rejects.toMatchObject({ code: 'functions/aborted' });
    const requestDocs = await ref.collection('changeRequests').get();
    expect(requestDocs.docs.filter((snapshot: { data: () => { status: string } }) => snapshot.data().status === 'applied')).toHaveLength(1);
  }, 45_000);

  it('bloqueia desconto abaixo do já pago e depósito, tampering de payload e aplicação com perfil revogado', async () => {
    const { orderId, ref } = await seedOrder('integrity', { status: 'confirmed', amountPaid: 400, amountRemaining: 100.25 });
    await signIn(ownerA);
    await expect(propose(orderId, { valueDeltaCents: -20000 })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await expect(propose(orderId, { valueDeltaCents: -45026 })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await expect(propose(orderId, { expectedDeliveryDate: '2027-02-30' })).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    const current = await page(orderId);
    await expect(call('proposeOrderChangeRequest', { atelierId: ateliers[0], orderId, requestId: ids(), baseAgreementVersion: 0,
      baseAgreementFingerprint: current.currentAgreementFingerprint, reason: 'Tentativa de contornar o status', changes: { scope: 'Outro escopo válido' }, status: 'confirmed' })).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    await propose(orderId, { valueDeltaCents: 25 });
    const change = (await page(orderId)).requests[0];
    await signIn(clientA);
    await respond(orderId, change);
    await signIn(ownerA);
    await adminDb.doc(`ateliers/${ateliers[0]}/members/${ownerA.uid}`).update({ active: false });
    await expect(apply(orderId, change)).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await adminDb.doc(`ateliers/${ateliers[0]}/members/${ownerA.uid}`).update({ active: true });
    expect((await ref.get()).data()).toMatchObject({ amountRemaining: 100.25 });
    await ref.update({ amountPaid: 500.75 });
    await expect(apply(orderId, change)).rejects.toMatchObject({ code: 'functions/failed-precondition' });
  }, 45_000);

  it('retorna pedido pronto para envio à espera financeira após acréscimo e impede envio com saldo divergente', async () => {
    const { orderId, ref } = await seedOrder('shipping', { status: 'ready_to_ship', amountPaid: 500.25, amountPaidCents: 50025, amountRemaining: 0, amountRemainingCents: 0 });
    const stageIds = ['stage-start', 'stage-modeling', 'stage-production', 'stage-fitting', 'stage-finishing', 'stage-shipping'];
    for (const [index, stageId] of stageIds.entries()) await ref.collection('productionStages').doc(stageId).set({
      id: stageId, atelierId: ateliers[0], orderId, name: stageId, order: index, progressWeight: 10,
      status: stageId === 'stage-shipping' ? 'pending' : 'completed', progress: stageId === 'stage-shipping' ? 0 : 100,
      requiresClientApproval: false, version: 0, createdAt: new Date(), updatedAt: new Date(),
    });
    await signIn(ownerA);
    await propose(orderId, { valueDeltaCents: 100 });
    const change = (await page(orderId)).requests[0];
    await signIn(clientA);
    await respond(orderId, change);
    await signIn(ownerA);
    await apply(orderId, change);
    expect((await ref.get()).data()).toMatchObject({ status: 'waiting_final_payment', amountRemaining: 1, amountRemainingCents: 100 });
    await expect(call('updateProductionStage', { atelierId: ateliers[0], orderId, stageId: 'stage-shipping', action: 'start', requestId: ids(), expectedVersion: 0 })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await ref.update({ amountRemaining: 0 });
    await expect(call('updateProductionStage', { atelierId: ateliers[0], orderId, stageId: 'stage-shipping', action: 'start', requestId: ids(), expectedVersion: 0 })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    expect((await ref.collection('productionStages').doc('stage-shipping').get()).data()?.status).toBe('pending');
  }, 45_000);

  it('libera estado pronto para envio após desconto que zera saldo somente quando trabalho canônico e próprio terminou', async () => {
    for (const hasPendingCustomStage of [false, true]) {
      const { orderId, ref } = await seedOrder(hasPendingCustomStage ? 'discount-custom' : 'discount-ready', { status: 'waiting_final_payment', amountPaid: 100, amountPaidCents: 10000, amountRemaining: 400.25, amountRemainingCents: 40025 });
      const stageIds = ['stage-start', 'stage-modeling', 'stage-production', 'stage-fitting', 'stage-finishing', ...(hasPendingCustomStage ? ['custom-final-detail'] : []), 'stage-shipping'];
      for (const [index, stageId] of stageIds.entries()) await ref.collection('productionStages').doc(stageId).set({
        id: stageId, atelierId: ateliers[0], orderId, name: stageId, order: index, progressWeight: 10,
        status: stageId === 'stage-shipping' || stageId.startsWith('custom-') ? 'pending' : 'completed',
        progress: stageId === 'stage-shipping' || stageId.startsWith('custom-') ? 0 : 100,
        ...(stageId.startsWith('custom-') ? { semanticKey: 'finishing' } : {}),
        requiresClientApproval: false, version: 0, createdAt: new Date(), updatedAt: new Date(),
      });
      await signIn(ownerA);
      await propose(orderId, { valueDeltaCents: -40025 });
      const change = (await page(orderId)).requests[0];
      await signIn(clientA);
      await respond(orderId, change);
      await signIn(ownerA);
      await apply(orderId, change);
      expect((await ref.get()).data()).toMatchObject({ status: hasPendingCustomStage ? 'finishing' : 'ready_to_ship', amountPaid: 100,
        amountRemaining: 0, amountRemainingCents: 0, totalAmountCents: 10000, approvedQuoteSnapshot: { total: 500.25, depositAmount: 100 } });
      expect((await ref.collection('productionStages').doc('stage-shipping').get()).data()?.status).toBe('pending');
      if (hasPendingCustomStage) await expect(call('updateProductionStage', { atelierId: ateliers[0], orderId, stageId: 'stage-shipping', action: 'start', requestId: ids(), expectedVersion: 0 })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    }
  }, 60_000);
});
