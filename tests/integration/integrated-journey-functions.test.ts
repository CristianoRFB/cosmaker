import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { connectFirestoreEmulator, getFirestore as getClientFirestore, addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
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
const adminApp = initializeAdminApp({ projectId }, `journey-tests-${nonce}`);
const adminAuth = getAdminAuth(adminApp);
const adminDb = getFirestore(adminApp);
const clientApp = initializeApp({ apiKey: 'emulator-only-key', authDomain: `${projectId}.firebaseapp.com`, projectId, appId: 'emulator-only-app' }, `journey-client-${nonce}`);
const auth = getAuth(clientApp);
const functions = getFunctions(clientApp, 'us-central1');
const emulatorHost = process.env.FIREBASE_EMULATOR_HOST || '127.0.0.1';
connectAuthEmulator(auth, `http://${emulatorHost}:${process.env.COSMAKER_AUTH_EMULATOR_PORT || '19099'}`, { disableWarnings: true });
connectFunctionsEmulator(functions, emulatorHost, Number(process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || 15001));

type Identity = { uid: string; email: string; password: string };
const createdUids: string[] = [];
const atelierIds = [`journey-${nonce}-a`, `journey-${nonce}-b`];
const newId = () => randomUUID();
let ownerA: Identity;
let ownerB: Identity;

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

const { getStorage: getAdminStorage } = requireFromFunctions('firebase-admin/storage');
const clientDb = getClientFirestore(clientApp); connectFirestoreEmulator(clientDb, emulatorHost, Number(process.env.FIRESTORE_EMULATOR_HOST!.split(':').at(-1)));
const bucket = getAdminStorage(adminApp).bucket(`${projectId}.appspot.com`); const png = readFileSync(new URL('../fixtures/production-progress.png', import.meta.url));
let customer: Identity; const slugs = [`journey-${nonce}-a`, `journey-${nonce}-b`]; const root = () => adminDb.doc(`ateliers/${atelierIds[0]}`);
const today = new Date().toISOString().slice(0, 10); const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
async function waitFor(predicate: () => Promise<boolean>) { const end = Date.now() + 20000; while (Date.now() < end) { if (await predicate()) return; await new Promise((resolve) => setTimeout(resolve, 250)); } throw new Error('A integração do domínio não persistiu o resultado esperado.'); }
beforeAll(async () => {
  [ownerA, ownerB, customer] = await Promise.all(['journey-owner-a', 'journey-owner-b', 'journey-client'].map(createIdentity));
  await Promise.all([seedAtelier(atelierIds[0], ownerA), seedAtelier(atelierIds[1], ownerB)]);
  await adminDb.doc(`users/${customer.uid}`).set({ active: true, accountType: 'client' });
  for (let index = 0; index < 2; index++) {
    await adminDb.doc(`ateliers/${atelierIds[index]}`).update({ timezone: 'UTC' });
    await adminDb.doc(`publicAteliers/${atelierIds[index]}`).set({ slug: slugs[index], name: `Ateliê sintético ${index}`, published: true, quoteRequestsEnabled: true, brandColor: index ? '#123abc' : '#663399' });
    await adminDb.doc(`publicAtelierSlugs/${slugs[index]}`).set({ slug: slugs[index], atelierId: atelierIds[index] });
  }
});
afterAll(async () => {
  for (let index = 0; index < 2; index++) {
    await bucket.deleteFiles({ prefix: `ateliers/${atelierIds[index]}/` }); await adminDb.recursiveDelete(adminDb.doc(`ateliers/${atelierIds[index]}`)); await adminDb.doc(`publicAteliers/${atelierIds[index]}`).delete(); await adminDb.doc(`publicAtelierSlugs/${slugs[index]}`).delete();
    const logs = await adminDb.collection('auditLogs').where('atelierId', '==', atelierIds[index]).get(); await Promise.all(logs.docs.map((doc: { ref: { delete(): Promise<unknown> } }) => doc.ref.delete()));
  }
  for (const uid of createdUids) { await adminAuth.deleteUser(uid); await adminDb.doc(`users/${uid}`).delete(); }
  await deleteApp(clientApp); await deleteApp(adminApp);
});
type ChangePage = { currentAgreement: { version: number }; currentAgreementFingerprint: string; requests: Array<{ id: string; version: number; proposalFingerprint: string }> };
describe('Integrated visitor to completed order journey', () => {
  it('persiste a jornada completa e mantém saldos, medidas, reserva, revisões, mensagens, relatórios e A/B coerentes', async () => {
    await signIn(ownerA);
    const service = await call<{ id: string }>('saveAtelierService', { requestId: newId(), title: 'Armaduras sob medida', description: 'Confecção e acabamento de armaduras sintéticas.', category: 'armor', public: true, active: true, sortOrder: 0, internalNotes: 'Nota privada da equipe', version: 0 });
    await signOut(auth);
    const created = await call<{ requestId: string; references: Array<{ uploadId: string; storagePath: string; capability: string }> }>('createPublicQuoteRequest', { tenantSlug: slugs[0], input: { name: 'Cliente da jornada', email: customer.email, character: 'Armadura da jornada', franchise: 'Obra sintética', category: 'full_cosplay', description: 'Projeto totalmente fictício para a jornada integrada.', desiredDeliveryDate: '2027-12-31', urgency: 'normal', serviceId: service.id }, references: [{ name: 'reference.png', contentType: 'image/png', size: png.length, sha256: (await import('node:crypto')).createHash('sha256').update(png).digest('hex') }] });
    const referenceUpload = await fetch(`http://${emulatorHost}:${process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || '15001'}/${projectId}/us-central1/uploadPublicQuoteReferenceBytes?${new URLSearchParams({ tenantSlug: slugs[0], requestId: created.requestId, uploadId: created.references[0].uploadId })}`, { method: 'POST', body: png, headers: { 'Content-Type': 'image/png', Authorization: `Bearer ${created.references[0].capability}` } });
    expect(referenceUpload.status).toBe(200);
    expect((await root().collection('quoteRequests').doc(created.requestId).get()).get('showcaseContext.service.title')).toBe('Armaduras sob medida');
    expect((await call<{ services: unknown[] }>('listPublicShowcase', { tenantSlug: slugs[1] })).services).toEqual([]);
    console.log('JOURNEY: visitante → serviço → solicitação e imagem persistidos.');

    await signIn(ownerA);
    const crm = await call<{ clientId: string }>('saveAtelierClient', { name: 'Cliente da jornada', email: customer.email, phone: '' });
    const profile = await addDoc(collection(clientDb, 'ateliers', atelierIds[0], 'measurementProfiles'), { clientId: crm.clientId, name: 'Medidas da jornada', active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    const measure = await addDoc(collection(profile, 'measurements'), { type: 'circumference', label: 'Tórax', value: 88, unit: 'cm', notes: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    const quote = await call<{ quoteId: string }>('createQuoteDraft', { atelierId: atelierIds[0], requestId: created.requestId, items: [{ description: 'Armadura', category: 'labor', quantity: 1, unitPrice: 1000 }], urgencyFee: 0, shipping: 0, discount: 0, validUntil: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), depositPercentage: 30 });
    await call('publishQuote', { atelierId: atelierIds[0], quoteId: quote.quoteId });
    await signIn(customer); await call('respondToQuote', { atelierId: atelierIds[0], quoteId: quote.quoteId, decision: 'approved', comment: '' });
    const orderId = quote.quoteId; const order = root().collection('orders').doc(orderId); await waitFor(async () => (await order.get()).exists);
    expect((await order.get()).data()).toMatchObject({ status: 'waiting_deposit', clientId: crm.clientId, clientUserId: customer.uid, approvedQuoteSnapshot: { total: 1000 } });
    expect((await order.collection('measurementSnapshot').doc(measure.id).get()).get('value')).toBe(88);
    await updateDoc(doc(clientDb, 'ateliers', atelierIds[0], 'measurementProfiles', profile.id, 'measurements', measure.id), { value: 101, unit: 'cm', notes: '', updatedAt: serverTimestamp() });
    expect((await order.collection('measurementSnapshot').doc(measure.id).get()).get('value')).toBe(88);
    console.log('JOURNEY: proposta → aprovação → pedido e snapshot de medidas preservados.');

    await signIn(ownerA); await call('confirmOrderDeposit', { atelierId: atelierIds[0], orderId, method: 'cash', reference: `deposit-${nonce}` });
    await call('saveMemberScheduleCapacity', { memberId: ownerA.uid, weeklyHoursByWeekday: { '0': 8, '1': 8, '2': 8, '3': 8, '4': 8, '5': 8, '6': 8 }, workdayStartMinute: 480, workdayEndMinute: 1020, timezone: 'UTC' });
    const slotId = newId(); await call('allocateProductionTime', { requestId: slotId, orderId, stageId: 'stage-modeling', assignedTo: ownerA.uid, startAt: `${tomorrow}T09:00:00.000Z`, endAt: `${tomorrow}T10:00:00.000Z`, plannedHours: 1 });
    const material = await call<{ materialId: string }>('saveInventoryMaterial', { requestId: newId(), name: 'EVA da jornada', sku: `journey-${nonce}`, description: '', unit: 'un', unitCostCents: 2500, supplierId: null, reorderPoint: 0, active: true });
    const move = (kind: string, extra: Record<string, unknown> = {}) => call<{ reservationId: string }>('applyInventoryMovement', { requestId: newId(), materialId: material.materialId, kind, quantity: 2, ...extra });
    await move('receive'); const reservation = await move('reserve', { orderId, plannedQuantity: 2 });
    await call('sendOrderMessage', { atelierId: atelierIds[0], orderId, requestId: newId(), text: 'Planejamento e reserva confirmados.', attachmentIds: [] });
    await signIn(customer); await call('sendOrderMessage', { atelierId: atelierIds[0], orderId, requestId: newId(), text: 'Referências e medidas conferidas.', attachmentIds: [] });
    await call('markOrderConversationRead', { atelierId: atelierIds[0], orderId, sequence: 2 });
    await signIn(ownerA);
    const stage = (stageId: string, action: string) => call('updateProductionStage', { atelierId: atelierIds[0], orderId, stageId, action, requestId: newId() });
    for (const id of ['stage-start', 'stage-modeling', 'stage-production']) { await stage(id, 'start'); await stage(id, 'complete'); }
    await move('issue', { reservationId: reservation.reservationId });
    await call('recordFinanceEntry', { requestId: newId(), orderId, kind: 'expense', basis: 'actual', category: 'materials', amountCents: 5000, description: 'Materiais consumidos na jornada', effectiveDate: today });
    await stage('stage-fitting', 'start');
    const photo = await call<{ photoId: string; storagePath: string; capability: string }>('createProductionPhotoUpload', { atelierId: atelierIds[0], orderId, stageId: 'stage-fitting', originalName: 'fitting.png', contentType: 'image/png', caption: 'Prova sintética da jornada', visibleToClient: true });
    const photoEndpoint = new URL(`http://${emulatorHost}:${process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || 15001}/${projectId}/us-central1/uploadProductionPhotoBytes`);
    for (const [key, value] of Object.entries({ atelierId: atelierIds[0], orderId, photoId: photo.photoId })) photoEndpoint.searchParams.set(key, value);
    const uploadedPhoto = await fetch(photoEndpoint, { method: 'POST', body: new Uint8Array(png), headers: { Authorization: `Bearer ${await auth.currentUser!.getIdToken()}`, 'Content-Type': 'image/png' } });
    expect(uploadedPhoto.status).toBe(200); expect(await uploadedPhoto.json()).toMatchObject({ photoId: photo.photoId, status: 'ready' });
    await stage('stage-fitting', 'complete'); const approval = (await order.collection('approvals').get()).docs[0];
    await signIn(customer); await call('respondToProductionApproval', { atelierId: atelierIds[0], orderId, approvalId: approval.id, decision: 'approved', comment: '' });
    await signIn(ownerA); await stage('stage-finishing', 'start'); await stage('stage-finishing', 'complete');
    console.log('JOURNEY: agenda → reserva → produção → foto/aprovação → consumo/custo persistidos.');

    const current = await call<ChangePage>('listOrderChangeRequests', { atelierId: atelierIds[0], orderId });
    await call('proposeOrderChangeRequest', { atelierId: atelierIds[0], orderId, requestId: newId(), baseAgreementVersion: current.currentAgreement.version, baseAgreementFingerprint: current.currentAgreementFingerprint, reason: 'Acabamento adicional aprovado para o projeto', changes: { valueDeltaCents: 10000, scope: 'Armadura com acabamento adicional aprovado', materials: 'EVA e pintura sintéticos' } });
    const change = (await call<ChangePage>('listOrderChangeRequests', { atelierId: atelierIds[0], orderId })).requests[0];
    await signIn(customer); await call('respondToOrderChangeRequest', { atelierId: atelierIds[0], orderId, changeRequestId: change.id, requestId: newId(), version: change.version, proposalFingerprint: change.proposalFingerprint, decision: 'approved', comment: '', confirmed: true });
    await signIn(ownerA); await call('applyOrderChangeRequest', { atelierId: atelierIds[0], orderId, changeRequestId: change.id, requestId: newId(), version: change.version, proposalFingerprint: change.proposalFingerprint });
    expect((await order.get()).get('amountRemainingCents')).toBe(80000);
    await call('recordFinanceEntry', { requestId: newId(), orderId, kind: 'payment', basis: 'actual', category: 'other', amountCents: 80000, method: 'cash', reference: `final-${nonce}`, description: 'Quitação manual da jornada', effectiveDate: today });
    await stage('stage-shipping', 'start'); await stage('stage-shipping', 'complete');
    const delivery = { orderId, action: 'deliver', requestId: newId(), expectedVersion: 0, method: 'pickup', note: 'Entrega conferida da jornada integrada' };
    await expect(call('finalizeOrder', delivery)).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await call('cancelProductionSlot', { slotId });
    await call('finalizeOrder', delivery); expect(await call('finalizeOrder', delivery)).toMatchObject({ alreadyApplied: true });
    await call('finalizeOrder', { orderId, action: 'complete', requestId: newId(), expectedVersion: 1, note: 'Histórico final e entrega conferidos' });
    expect((await order.get()).data()).toMatchObject({ status: 'completed', amountPaidCents: 110000, amountRemainingCents: 0, approvedQuoteSnapshot: { total: 1000 }, currentAgreement: { totalCents: 110000 } });
    const report = await call<{ orders: { byStatus: Record<string, number> }; finance: { revenueCents: number; receivedCents: number; actualCostsCents: number } }>('getAtelierOperationalReport');
    expect(report.orders.byStatus.completed).toBe(1); expect(report.finance).toMatchObject({ revenueCents: 110000, receivedCents: 110000, actualCostsCents: 5000 });
    const client = await call<{ history: { orders: Array<{ id: string; status: string }>; payments: unknown[] } }>('getAtelierClient', { clientId: crm.clientId }); expect(client.history.orders).toContainEqual(expect.objectContaining({ id: orderId, status: 'completed' })); expect(client.history.payments).toHaveLength(2);
    const conversation = await call<{ messages: unknown[] }>('getOrderConversation', { atelierId: atelierIds[0], orderId }); expect(conversation.messages).toHaveLength(2);
    await signIn(customer); expect((await call<{ orders: Array<{ id: string; status: string }> }>('listClientOrders')).orders).toContainEqual(expect.objectContaining({ id: orderId, status: 'completed' }));
    expect((await call<{ notifications: unknown[] }>('listInternalNotifications')).notifications.length).toBeGreaterThanOrEqual(4);
    await signIn(ownerB); expect((await call<{ finance: { revenueCents: number }; orders: { total: number } }>('getAtelierOperationalReport')).finance.revenueCents).toBe(0);
    await expect(call('getOrderConversation', { atelierId: atelierIds[0], orderId })).rejects.toMatchObject({ code: 'functions/permission-denied' });
    expect((await adminDb.doc(`ateliers/${atelierIds[1]}/orders/${orderId}`).get()).exists).toBe(false);
    console.log('JOURNEY PASS: revisão → quitação → expedição → entrega → conclusão → CRM/relatórios/portal/notificações, A/B isolado.');
  }, 240_000);
});
