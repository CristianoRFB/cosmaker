import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

const requireFromFunctions = createRequire(new URL('../../functions/package.json', import.meta.url));
const { initializeApp: initializeAdminApp } = requireFromFunctions('firebase-admin/app');
const { getAuth: getAdminAuth } = requireFromFunctions('firebase-admin/auth');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');
const projectId = 'demo-cosmaker';
const nonce = randomUUID().slice(0, 8);
const adminApp = initializeAdminApp({ projectId }, `delivery-tests-${nonce}`);
const adminAuth = getAdminAuth(adminApp);
const adminDb = getFirestore(adminApp);
const clientApp = initializeApp({ apiKey: 'emulator-only-key', authDomain: `${projectId}.firebaseapp.com`, projectId, appId: 'emulator-only-app' }, `delivery-client-${nonce}`);
const auth = getAuth(clientApp);
const functions = getFunctions(clientApp, 'us-central1');
const emulatorHost = process.env.FIREBASE_EMULATOR_HOST || '127.0.0.1';
connectAuthEmulator(auth, `http://${emulatorHost}:${process.env.COSMAKER_AUTH_EMULATOR_PORT || '19099'}`, { disableWarnings: true });
connectFunctionsEmulator(functions, emulatorHost, Number(process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || 15001));

type Identity = { uid: string; email: string; password: string };
const createdUids: string[] = [];
const atelierIds = [`delivery-${nonce}-a`, `delivery-${nonce}-b`];
const newId = () => randomUUID();
let ownerA: Identity;
let ownerB: Identity;
let noReportAccess: Identity;

async function createIdentity(label: string): Promise<Identity> {
  const email = `${label}-${nonce}@cosmaker.test`;
  const password = `Local!${randomUUID().slice(0, 14)}aA1`;
  const user = await adminAuth.createUser({ email, password, displayName: label, emailVerified: true });
  createdUids.push(user.uid);
  return { uid: user.uid, email, password };
}

async function seedAtelier(atelierId: string, owner: Identity) {
  await Promise.all([
    adminDb.doc(`users/${owner.uid}`).set({ id: owner.uid, email: owner.email, name: owner.email, accountType: 'atelier_member', atelierId, role: 'owner', permissions: [], active: true }),
    adminDb.doc(`ateliers/${atelierId}`).set({ id: atelierId, name: 'Ateliê sintético', ownerId: owner.uid, active: true }),
    adminDb.doc(`ateliers/${atelierId}/members/${owner.uid}`).set({ userId: owner.uid, role: 'owner', permissions: [], active: true }),
  ]);
}

async function signIn(identity: Identity) {
  await signOut(auth).catch(() => undefined);
  await signInWithEmailAndPassword(auth, identity.email, identity.password);
  await auth.currentUser?.getIdToken(true);
}

function call<T>(name: string, data: Record<string, unknown> = {}) {
  return httpsCallable<Record<string, unknown>, T>(functions, name)(data).then((result) => result.data);
}

let customer: Identity; let reader: Identity;
const root = () => adminDb.doc(`ateliers/${atelierIds[0]}`);
async function readyOrder(id = newId()) {
  const ref = root().collection('orders').doc(id);
  await ref.set({ atelierId: atelierIds[0], quoteId: 'synthetic-approved', requestId: 'synthetic-intake', clientUserId: customer.uid, email: customer.email, clientId: null, character: 'Projeto sintético', description: 'Acordo sintético', status: 'shipped', progress: 100, expectedDeliveryDate: '2027-01-10', createdAt: new Date(), updatedAt: new Date(), approvedQuoteSnapshot: { total: 1000, depositAmount: 300 }, amountPaid: 1000, amountPaidCents: 100000, amountRemaining: 0, amountRemainingCents: 0 });
  await ref.collection('productionStages').doc('stage-shipping').set({ name: 'Expedição / retirada', order: 1, semanticKey: 'shipping', status: 'completed', progress: 100, progressWeight: 1 });
  return ref;
}
function deliver(orderId: string, extra: Record<string, unknown> = {}) {
  return call<{ status: string; version: number; alreadyApplied: boolean }>('finalizeOrder', { orderId, action: 'deliver', note: 'Retirada conferida pela equipe', method: 'pickup', expectedVersion: 0, requestId: newId(), ...extra });
}
beforeAll(async () => {
  [ownerA, ownerB, noReportAccess, reader, customer] = await Promise.all(['delivery-owner-a', 'delivery-owner-b', 'delivery-denied', 'delivery-reader', 'delivery-client'].map(createIdentity));
  await Promise.all([seedAtelier(atelierIds[0], ownerA), seedAtelier(atelierIds[1], ownerB)]);
  for (const [user, permissions] of [[noReportAccess, []], [reader, ['orders:read']]] as Array<[Identity, string[]]>) {
    await adminDb.doc(`users/${user.uid}`).set({ active: true, accountType: 'atelier_member', atelierId: atelierIds[0] });
    await root().collection('members').doc(user.uid).set({ active: true, role: 'assistant', permissions });
  }
  await adminDb.doc(`users/${customer.uid}`).set({ active: true, accountType: 'client' });
  await signIn(ownerA);
});
afterAll(async () => {
  for (const id of atelierIds) {
    await adminDb.recursiveDelete(adminDb.doc(`ateliers/${id}`));
    const logs = await adminDb.collection('auditLogs').where('atelierId', '==', id).get(); await Promise.all(logs.docs.map((doc: { ref: { delete(): Promise<unknown> } }) => doc.ref.delete()));
  }
  for (const uid of createdUids) { await adminAuth.deleteUser(uid); await adminDb.doc(`users/${uid}`).delete(); }
  await deleteApp(clientApp); await deleteApp(adminApp);
});
describe('Manual delivery and completion integration', () => {
  it('entrega e conclui com histórico, auditoria, retry, notificação por UID e métricas reais sem alterar recebimentos', async () => {
    await signIn(ownerA); const order = await readyOrder(); const requestId = newId();
    expect(await deliver(order.id, { requestId })).toMatchObject({ status: 'delivered', version: 1, alreadyApplied: false });
    expect(await deliver(order.id, { requestId })).toMatchObject({ version: 1, alreadyApplied: true });
    await expect(deliver(order.id, { requestId, note: 'Outra evidência' })).rejects.toMatchObject({ code: 'functions/already-exists' });
    expect(await call('finalizeOrder', { orderId: order.id, action: 'complete', note: 'Entrega e revisão final conferidas', requestId: newId(), expectedVersion: 1 })).toMatchObject({ status: 'completed', version: 2 });
    expect((await order.get()).data()).toMatchObject({ status: 'completed', lifecycleVersion: 2, amountPaidCents: 100000, amountRemainingCents: 0 });
    expect((await order.collection('statusHistory').get()).size).toBe(2);
    const logs = await adminDb.collection('auditLogs').where('entityId', '==', order.id).get(); expect(logs.size).toBe(2);
    const reports = await call<{ orders: { byStatus: Record<string, number> } }>('getAtelierOperationalReport'); expect(reports.orders.byStatus.completed).toBe(1);
    await signIn(customer); const orders = await call<{ orders: Array<{ id: string; status: string }> }>('listClientOrders'); expect(orders.orders).toContainEqual(expect.objectContaining({ id: order.id, status: 'completed' }));
    const notices = await call<{ notifications: Array<{ type: string; orderId: string }> }>('listInternalNotifications'); expect(notices.notifications.filter((item) => item.orderId === order.id)).toHaveLength(2); expect(notices.notifications.every((item) => item.type === 'order_updated')).toBe(true);
  }, 60_000);

  it('nega tenant B, cliente, leitor, perfil desativado e payload adulterado sem mutações', async () => {
    const order = await readyOrder();
    for (const actor of [reader, noReportAccess, customer]) { await signIn(actor); await expect(deliver(order.id)).rejects.toMatchObject({ code: 'functions/permission-denied' }); }
    await signIn(ownerB); await expect(deliver(order.id)).rejects.toMatchObject({ code: 'functions/not-found' });
    await signIn(ownerA);
    for (const extra of [{ atelierId: atelierIds[1] }, { amountRemainingCents: 0 }, { note: 'x' }, { method: 'gateway' }, { expectedVersion: -1 }, { status: 'completed' }]) await expect(deliver(order.id, extra)).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    for (const ref of [adminDb.doc(`users/${ownerA.uid}`), root().collection('members').doc(ownerA.uid), root()]) { await ref.update({ active: false }); try { await expect(deliver(order.id)).rejects.toMatchObject({ code: 'functions/permission-denied' }); } finally { await ref.update({ active: true }); } }
    await adminAuth.updateUser(ownerA.uid, { emailVerified: false }); await auth.currentUser!.getIdToken(true);
    try { await expect(deliver(order.id)).rejects.toMatchObject({ code: 'functions/failed-precondition' }); } finally { await adminAuth.updateUser(ownerA.uid, { emailVerified: true }); await signIn(ownerA); }
    await signOut(auth); await expect(deliver(order.id)).rejects.toMatchObject({ code: 'functions/unauthenticated' });
    expect((await order.get()).data()?.status).toBe('shipped'); expect((await order.collection('statusHistory').get()).empty).toBe(true);
  }, 60_000);

  it('impede entrega com saldo, etapa, aprovação, revisão, planejamento ou horas futuras pendentes', async () => {
    await signIn(ownerA); const order = await readyOrder();
    for (const patch of [{ status: 'ready_to_ship' }, { amountPaid: 900, amountPaidCents: 90000, amountRemaining: 100, amountRemainingCents: 10000 }, { amountPaidCents: 1 }, { planningNeedsReview: true }, { progress: 99 }]) {
      const before = (await order.get()).data(); await order.update(patch); await expect(deliver(order.id)).rejects.toMatchObject({ code: 'functions/failed-precondition' }); await order.set(before!);
    }
    const stage = order.collection('productionStages').doc('stage-shipping'); await stage.update({ status: 'in_progress' }); await expect(deliver(order.id)).rejects.toMatchObject({ code: 'functions/failed-precondition' }); await stage.update({ status: 'completed' });
    for (const collection of ['approvals', 'changeRequests']) {
      const pending = order.collection(collection).doc('pending'); await pending.set({ status: 'pending' }); await expect(deliver(order.id)).rejects.toMatchObject({ code: 'functions/failed-precondition' }); await pending.delete();
    }
    const slot = root().collection('productionSlots').doc(newId()); await slot.set({ orderId: order.id, status: 'scheduled', endAt: new Date(Date.now() + 86400000) }); await expect(deliver(order.id)).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await slot.update({ status: 'cancelled' }); expect(await deliver(order.id)).toMatchObject({ status: 'delivered' }); expect((await slot.get()).exists).toBe(true);
  }, 60_000);

  it('concilia reserva/consumo reais do estoque e serializa entregas concorrentes sem duplicar histórico', async () => {
    await signIn(ownerA); const order = await readyOrder();
    const material = await call<{ materialId: string }>('saveInventoryMaterial', { requestId: newId(), name: 'EVA sintético', sku: `delivery-${nonce}`, description: '', unit: 'un', unitCostCents: 1000, supplierId: null, reorderPoint: 0, active: true });
    const move = (kind: string, extra: Record<string, unknown> = {}) => call('applyInventoryMovement', { requestId: newId(), materialId: material.materialId, kind, quantity: 1, ...extra });
    await move('receive'); const reservation = await call<{ reservationId: string }>('applyInventoryMovement', { requestId: newId(), materialId: material.materialId, kind: 'reserve', quantity: 1, orderId: order.id, plannedQuantity: 1 });
    await expect(deliver(order.id)).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await move('issue', { reservationId: reservation.reservationId });
    const results = await Promise.allSettled([deliver(order.id), deliver(order.id)]); expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await order.collection('statusHistory').get()).size).toBe(1);
    expect((await root().collection('inventoryReservations').doc(reservation.reservationId).get()).data()).toMatchObject({ status: 'consumed', remainingMilli: 0 });
    expect((await root().collection('inventoryMovements').get()).size).toBe(3);
    await expect(move('reserve', { orderId: order.id })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
  }, 60_000);
});
