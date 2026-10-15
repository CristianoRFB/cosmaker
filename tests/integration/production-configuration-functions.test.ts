import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { defaultProductionStages } from '../../functions/src/orders/production-template';
import type { OrderProductionConfiguration, ProductionConfigurationStage } from '../../types/production';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Production integration tests require local Firestore and Auth Emulators.');
const requireFromFunctions = createRequire(new URL('../../functions/package.json', import.meta.url));
const { initializeApp: initializeAdminApp } = requireFromFunctions('firebase-admin/app');
const { getAuth: getAdminAuth } = requireFromFunctions('firebase-admin/auth');
const { getFirestore, Timestamp } = requireFromFunctions('firebase-admin/firestore');
const { getStorage } = requireFromFunctions('firebase-admin/storage');
const projectId = 'demo-cosmaker';
const nonce = randomUUID().slice(0, 8);
const adminApp = initializeAdminApp({ projectId, storageBucket: `${projectId}.appspot.com` }, `production-tests-${nonce}`);
const adminAuth = getAdminAuth(adminApp);
const adminDb = getFirestore(adminApp);
const bucket = getStorage(adminApp).bucket();
const clientApp = initializeApp({ apiKey: 'emulator-only-key', authDomain: `${projectId}.firebaseapp.com`, projectId, appId: 'emulator-only-app' }, `production-client-${nonce}`);
const auth = getAuth(clientApp);
const functions = getFunctions(clientApp, 'us-central1');
const emulatorHost = process.env.FIREBASE_EMULATOR_HOST || '127.0.0.1';
connectAuthEmulator(auth, `http://${emulatorHost}:${process.env.COSMAKER_AUTH_EMULATOR_PORT || '19099'}`, { disableWarnings: true });
connectFunctionsEmulator(functions, emulatorHost, Number(process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || 15001));

type Identity = { uid: string; email: string; password: string };
const createdUids: string[] = [];
const atelierA = `production-${nonce}-a`;
const atelierB = `production-${nonce}-b`;
const orderIds: string[] = [];
let ownerA: Identity;
let ownerB: Identity;
let reader: Identity;
let client: Identity;
let foreignClient: Identity;

async function createIdentity(label: string): Promise<Identity> {
  const email = `${label}-${nonce}@cosmaker.test`;
  const password = `Local!${randomUUID().slice(0, 14)}aA1`;
  const user = await adminAuth.createUser({ email, password, displayName: label, emailVerified: true });
  createdUids.push(user.uid);
  return { uid: user.uid, email, password };
}

async function seedMember(atelierId: string, person: Identity, role = 'owner', permissions: string[] = []) {
  await Promise.all([
    adminDb.doc(`users/${person.uid}`).set({ id: person.uid, email: person.email, name: person.email, accountType: 'atelier_member', atelierId, role, permissions, active: true }),
    adminDb.doc(`ateliers/${atelierId}/members/${person.uid}`).set({ userId: person.uid, role, permissions, active: true }),
  ]);
}

async function signIn(person: Identity) {
  await signOut(auth).catch(() => undefined);
  await signInWithEmailAndPassword(auth, person.email, person.password);
  await auth.currentUser?.getIdToken(true);
}

function call<T>(name: string, input: Record<string, unknown>) {
  return httpsCallable<Record<string, unknown>, T>(functions, name)(input).then((result) => result.data);
}

async function seedOrder(label: string, overrides: Record<string, unknown> = {}) {
  const orderId = `${label}-${randomUUID().slice(0, 8)}`;
  orderIds.push(orderId);
  const order = adminDb.doc(`ateliers/${atelierA}/orders/${orderId}`);
  const clientId = `client-${orderId}`;
  await order.set({ atelierId: atelierA, status: 'confirmed', character: 'Projeto sintético', email: client.email, clientUserId: client.uid, clientId, clientName: 'Cliente fictícia', amountRemaining: 0, progress: 0, approvedQuoteSnapshot: { total: 100, depositAmount: 0 }, ...overrides });
  await adminDb.doc(`ateliers/${atelierA}/clients/${clientId}`).set({ name: 'Cliente fictícia', email: client.email, userId: client.uid });
  await Promise.all(defaultProductionStages.map((stage) => order.collection('productionStages').doc(stage.id).set({ ...stage, atelierId: atelierA, orderId, status: 'pending', progress: 0, updatedAt: Timestamp.now() })));
  return { orderId, order };
}

function configuration(orderId: string) {
  return call<OrderProductionConfiguration>('getOrderProductionConfiguration', { atelierId: atelierA, orderId });
}

function save(orderId: string, snapshot: OrderProductionConfiguration, stages = snapshot.stages, requestId = randomUUID()) {
  return call<{ version: number; progress: number; replayed: boolean }>('saveOrderProductionConfiguration', {
    atelierId: atelierA, orderId, expectedVersion: snapshot.version, requestId,
    stages: stages.map((stage) => ({
      id: stage.id, name: stage.name, progressWeight: stage.progressWeight, requiresClientApproval: stage.requiresClientApproval,
      semanticKey: stage.semanticKey, assignedTo: stage.assignedTo, plannedStartDate: stage.plannedStartDate,
      deadline: stage.deadline, expectedUpdatedAt: stage.expectedUpdatedAt,
    })),
  });
}

function custom(label: string, semanticKey: ProductionConfigurationStage['semanticKey'] = 'in_production'): ProductionConfigurationStage {
  return { id: `custom-${label}-${randomUUID().slice(0, 8)}`, name: `Etapa ${label}`, semanticKey, progressWeight: 10, requiresClientApproval: false, assignedTo: null, plannedStartDate: null, deadline: null, expectedUpdatedAt: null, status: 'pending' };
}

function advance(orderId: string, stageId: string, action: string, extras: Record<string, unknown> = {}) {
  return call<{ version: number; progress: number; status: string; replayed: boolean }>('updateProductionStage', { atelierId: atelierA, orderId, stageId, action, requestId: randomUUID(), ...extras });
}

beforeAll(async () => {
  [ownerA, ownerB, reader, client, foreignClient] = await Promise.all(['owner-a', 'owner-b', 'reader', 'client', 'foreign-client'].map(createIdentity));
  await Promise.all([
    adminDb.doc(`ateliers/${atelierA}`).set({ name: 'Produção sintética A', active: true, ownerId: ownerA.uid, timezone: 'America/Sao_Paulo' }),
    adminDb.doc(`ateliers/${atelierB}`).set({ name: 'Produção sintética B', active: true, ownerId: ownerB.uid }),
    seedMember(atelierA, ownerA), seedMember(atelierB, ownerB), seedMember(atelierA, reader, 'assistant', ['orders:read']),
    adminDb.doc(`users/${client.uid}`).set({ id: client.uid, accountType: 'client', email: client.email, active: true }),
    adminDb.doc(`users/${foreignClient.uid}`).set({ id: foreignClient.uid, accountType: 'client', email: foreignClient.email, active: true }),
  ]);
}, 60000);

afterAll(async () => {
  await signOut(auth).catch(() => undefined);
  if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) await Promise.all(orderIds.map((orderId) => bucket.deleteFiles({ prefix: `ateliers/${atelierA}/orders/${orderId}/production/` }).catch(() => undefined)));
  for (const atelierId of [atelierA, atelierB]) {
    await adminDb.recursiveDelete(adminDb.doc(`ateliers/${atelierId}`));
    const audit = await adminDb.collection('auditLogs').where('atelierId', '==', atelierId).get();
    await Promise.all(audit.docs.map((snapshot: { ref: { delete(): Promise<unknown> } }) => snapshot.ref.delete()));
  }
  await Promise.all(createdUids.map((uid) => adminDb.doc(`users/${uid}`).delete()));
  await Promise.all(createdUids.map((uid) => adminAuth.deleteUser(uid)));
  await deleteApp(clientApp); await adminApp.delete();
}, 60000);

describe('configurable production callables', () => {
  it('persists configuration, custom work, safe reorder/removal, assignment and idempotent snapshots', async () => {
    await signIn(ownerA);
    const { orderId, order } = await seedOrder('configure');
    const original = await configuration(orderId);
    expect(original.stages.map((stage) => stage.id)).toEqual(defaultProductionStages.map((stage) => stage.id));
    const first = custom('paint'); const second = custom('assembly');
    const next = [...original.stages]; next.splice(3, 0, first, second);
    next[1] = { ...next[1], name: 'Modelagem especial', assignedTo: ownerA.uid, plannedStartDate: '2026-11-02', deadline: '2026-11-06', progressWeight: 25 };
    const requestId = randomUUID();
    expect(await save(orderId, original, next, requestId)).toMatchObject({ version: 1, replayed: false });
    expect(await save(orderId, original, next, requestId)).toMatchObject({ version: 1, replayed: true });
    await expect(save(orderId, original, next.map((stage) => ({ ...stage, name: `${stage.name} editado` })), requestId)).rejects.toMatchObject({ code: 'functions/already-exists' });
    await expect(save(orderId, original, next)).rejects.toMatchObject({ code: 'functions/aborted' });
    expect((await order.get()).get('approvedQuoteSnapshot')).toEqual({ total: 100, depositAmount: 0 });
    let current = await configuration(orderId);
    expect(current.stages[1]).toMatchObject({ name: 'Modelagem especial', assignedTo: ownerA.uid, deadline: '2026-11-06' });
    const reordered = [...current.stages]; [reordered[3], reordered[4]] = [reordered[4], reordered[3]];
    await save(orderId, current, reordered);
    current = await configuration(orderId);
    await save(orderId, current, current.stages.filter((stage) => stage.id !== first.id));
    expect((await configuration(orderId)).stages.some((stage) => stage.id === first.id)).toBe(false);
    expect((await order.collection('productionConfigurations').get()).size).toBe(3);
    expect((await order.collection('productionStages').get()).size).toBe(7);
  }, 60000);

  it('rejects tenant/role escalation, foreign/inactive assignees and weakening canonical approval', async () => {
    await signIn(ownerA); const { orderId } = await seedOrder('authorization'); const current = await configuration(orderId);
    const foreign = current.stages.map((stage) => stage.id === 'stage-modeling' ? { ...stage, assignedTo: ownerB.uid } : stage);
    await expect(save(orderId, current, foreign)).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    const weakening = current.stages.map((stage) => stage.id === 'stage-fitting' ? { ...stage, requiresClientApproval: false } : stage);
    await expect(save(orderId, current, weakening)).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await expect(save(orderId, current, current.stages.filter((stage) => stage.id !== 'stage-production'))).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    for (const person of [ownerB, reader, client]) {
      await signIn(person);
      await expect(configuration(orderId)).rejects.toMatchObject({ code: 'functions/permission-denied' });
      await expect(save(orderId, current)).rejects.toMatchObject({ code: 'functions/permission-denied' });
    }
    await signIn(ownerA); await adminDb.doc(`users/${ownerA.uid}`).update({ active: false });
    try { await expect(save(orderId, current)).rejects.toMatchObject({ code: 'functions/permission-denied' }); }
    finally { await adminDb.doc(`users/${ownerA.uid}`).update({ active: true }); }
  }, 60000);

  it('preserves execution/allocation history and aborts a stale agenda snapshot', async () => {
    await signIn(ownerA); const { orderId, order } = await seedOrder('history');
    await order.collection('productionStages').doc('stage-start').update({ assignedTo: reader.uid, updatedAt: Timestamp.now() });
    let current = await configuration(orderId); const added = custom('allocated'); const next = [...current.stages]; next.splice(3, 0, added);
    await save(orderId, current, next);
    await advance(orderId, 'stage-start', 'start'); await advance(orderId, 'stage-start', 'complete');
    await Promise.all([adminDb.doc(`users/${reader.uid}`).update({ active: false }), adminDb.doc(`ateliers/${atelierA}/members/${reader.uid}`).update({ active: false })]);
    try {
      current = await configuration(orderId);
      await save(orderId, current, current.stages.map((stage) => stage.id === 'stage-modeling' ? { ...stage, name: 'Modelagem futura' } : stage));
      expect((await order.collection('productionStages').doc('stage-start').get()).get('assignedTo')).toBe(reader.uid);
    } finally {
      await Promise.all([adminDb.doc(`users/${reader.uid}`).update({ active: true }), adminDb.doc(`ateliers/${atelierA}/members/${reader.uid}`).update({ active: true })]);
    }
    current = await configuration(orderId);
    const changed = current.stages.map((stage) => stage.id === 'stage-start' ? { ...stage, name: 'Histórico alterado' } : stage);
    await expect(save(orderId, current, changed)).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await adminDb.doc(`ateliers/${atelierA}/productionSlots/historical-${orderId}`).set({ orderId, stageId: added.id, assignedTo: ownerA.uid, status: 'cancelled', date: '2026-11-02' });
    await expect(save(orderId, current, current.stages.filter((stage) => stage.id !== added.id))).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await order.collection('productionStages').doc('stage-modeling').update({ assignedTo: ownerA.uid, updatedAt: Timestamp.now() });
    await expect(save(orderId, current)).rejects.toMatchObject({ code: 'functions/aborted' });
    const unchangedSnapshot = (await order.collection('productionStages').doc('stage-start').get()).data();
    expect(unchangedSnapshot.name).toBe('A iniciar'); expect(unchangedSnapshot.status).toBe('completed');
  }, 60000);

  it('serializes advance/progress, returns the same retry and records block/resume without bypass', async () => {
    await signIn(ownerA); const { orderId, order } = await seedOrder('advance');
    await expect(advance(orderId, 'stage-production', 'start')).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    const requestId = randomUUID();
    expect(await advance(orderId, 'stage-start', 'start', { expectedVersion: 0, requestId })).toMatchObject({ version: 1, replayed: false });
    expect(await advance(orderId, 'stage-start', 'start', { expectedVersion: 0, requestId })).toMatchObject({ version: 1, replayed: true });
    const competing = await Promise.allSettled([advance(orderId, 'stage-start', 'progress', { expectedVersion: 1, progress: 30 }), advance(orderId, 'stage-start', 'progress', { expectedVersion: 1, progress: 60 })]);
    expect(competing.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(competing.find((result) => result.status === 'rejected')).toMatchObject({ reason: { code: 'functions/aborted' } });
    await advance(orderId, 'stage-start', 'block', { note: 'Aguardando material' });
    expect((await order.collection('productionStages').doc('stage-start').get()).get('blockedReason')).toBe('Aguardando material');
    await advance(orderId, 'stage-start', 'start');
    await advance(orderId, 'stage-start', 'complete');
    const updates = await order.collection('productionStages').doc('stage-start').collection('updates').get();
    expect(updates.size).toBe(5);
  }, 60000);

  it('returns ready or financial waiting orders to real pending custom work and restores the gate after removal', async () => {
    await signIn(ownerA);
    for (const status of ['ready_to_ship', 'waiting_final_payment']) {
      const remaining = status === 'ready_to_ship' ? 0 : 10;
      const { orderId, order } = await seedOrder(`new-work-${status}`, { status, amountRemaining: remaining });
      await Promise.all(defaultProductionStages.slice(0, 5).map((stage) => order.collection('productionStages').doc(stage.id).update({ status: 'completed', progress: 100 })));
      let current = await configuration(orderId);
      const added = custom('additional-finish', 'finishing');
      const next = [...current.stages]; next.splice(5, 0, added);
      await save(orderId, current, next);
      expect((await order.get()).get('status')).toBe('finishing');
      await expect(advance(orderId, 'stage-shipping', 'start')).rejects.toMatchObject({ code: 'functions/failed-precondition' });
      current = await configuration(orderId);
      await save(orderId, current, current.stages.filter((stage) => stage.id !== added.id));
      expect((await order.get()).get('status')).toBe(status);
    }
  }, 60000);

  it('requires a strong client link and freezes legacy evidence from before the request, with an audited recovery', async () => {
    await signIn(ownerA); const { orderId, order } = await seedOrder('legacy-approval', { status: 'modeling', clientUserId: null });
    await order.collection('productionStages').doc('stage-start').update({ status: 'completed', progress: 100 });
    const stageRef = order.collection('productionStages').doc('stage-modeling');
    const requestedAt = Timestamp.fromMillis(Date.now() - 2000);
    const approvalRef = order.collection('approvals').doc('legacy-approval');
    await stageRef.update({ status: 'waiting_approval', progress: 100, requiresClientApproval: true, pendingApprovalId: approvalRef.id });
    await approvalRef.set({ atelierId: atelierA, orderId, stageId: 'stage-modeling', stageName: 'Modelagem', status: 'pending', requestedAt });
    const evidence = (photoId: string, uploadedAt: unknown) => ({ stageId: 'stage-modeling', uploadStatus: 'ready', visibleToClient: true, storagePath: `ateliers/${atelierA}/orders/${orderId}/production/${photoId}`, uploadedAt, storageGeneration: 'legacy-generation' });
    await order.collection('photos').doc('older-proof').set(evidence('older-proof', Timestamp.fromMillis(requestedAt.toMillis() - 1000)));
    await order.collection('photos').doc('later-proof').set(evidence('later-proof', Timestamp.fromMillis(requestedAt.toMillis() + 1000)));
    const clientRef = adminDb.doc(`ateliers/${atelierA}/clients/client-${orderId}`);
    const respond = () => call('respondToProductionApproval', { atelierId: atelierA, orderId, approvalId: approvalRef.id, decision: 'approved', comment: '' });
    await signIn(client); await clientRef.update({ userId: foreignClient.uid });
    await expect(respond()).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await clientRef.update({ userId: client.uid });
    await adminDb.doc(`users/${client.uid}`).update({ accountType: 'atelier_member' });
    try { await expect(respond()).rejects.toMatchObject({ code: 'functions/permission-denied' }); }
    finally { await adminDb.doc(`users/${client.uid}`).update({ accountType: 'client' }); }
    expect(await respond()).toMatchObject({ replayed: false });
    expect((await approvalRef.get()).get('photoEvidence')).toEqual([{ photoId: 'older-proof', storagePath: `ateliers/${atelierA}/orders/${orderId}/production/older-proof`, storageGeneration: 'legacy-generation' }]);
    expect((await approvalRef.get()).get('legacyEvidenceCapturedAt')).toBeTruthy();

    await signIn(ownerA);
    const recovery = await seedOrder('unverifiable-legacy', { status: 'modeling' });
    const recoveryStage = recovery.order.collection('productionStages').doc('stage-modeling');
    await recovery.order.collection('productionStages').doc('stage-start').update({ status: 'completed', progress: 100 });
    await recoveryStage.update({ status: 'waiting_approval', progress: 100, requiresClientApproval: true, pendingApprovalId: 'unverifiable-approval' });
    const badApproval = recovery.order.collection('approvals').doc('unverifiable-approval');
    await badApproval.set({ atelierId: atelierA, orderId: recovery.orderId, stageId: 'stage-modeling', stageName: 'Modelagem', status: 'pending', requestedAt: Timestamp.fromMillis(requestedAt.toMillis() - 2000) });
    await recovery.order.collection('photos').doc('later-only').set({ stageId: 'stage-modeling', uploadStatus: 'ready', visibleToClient: true, storagePath: `ateliers/${atelierA}/orders/${recovery.orderId}/production/later-only`, storageGeneration: 'generation-recovery', uploadedAt: Timestamp.now() });
    await signIn(client);
    await expect(call('respondToProductionApproval', { atelierId: atelierA, orderId: recovery.orderId, approvalId: badApproval.id, decision: 'approved', comment: '' })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await signIn(ownerA);
    const requestId = randomUUID();
    expect(await advance(recovery.orderId, 'stage-modeling', 'cancel_approval', { note: 'Revisar evidências antigas', requestId })).toMatchObject({ replayed: false });
    expect(await advance(recovery.orderId, 'stage-modeling', 'cancel_approval', { note: 'Revisar evidências antigas', requestId })).toMatchObject({ replayed: true });
    expect((await badApproval.get()).get('status')).toBe('cancelled');
    expect((await recoveryStage.get()).get('status')).toBe('in_progress');
    await advance(recovery.orderId, 'stage-modeling', 'complete');
    const freshId = (await recoveryStage.get()).get('pendingApprovalId');
    expect((await recovery.order.collection('approvals').doc(freshId).get()).get('photoEvidence')).toHaveLength(1);
  }, 90000);

  it('approves custom final work explicitly and enforces the shipping balance on start and completion', async () => {
    await signIn(ownerA); const { orderId, order } = await seedOrder('approval', { status: 'finishing', amountRemaining: 50 });
    let current = await configuration(orderId); const added = { ...custom('final-review', 'finishing'), requiresClientApproval: true }; const next = [...current.stages]; next.splice(5, 0, added);
    await save(orderId, current, next);
    await Promise.all(defaultProductionStages.slice(0, 4).map((stage) => order.collection('productionStages').doc(stage.id).update({ status: 'completed', progress: 100 })));
    await advance(orderId, 'stage-finishing', 'start');
    expect((await advance(orderId, 'stage-finishing', 'complete')).status).toBe('finishing');
    await advance(orderId, added.id, 'start'); await advance(orderId, added.id, 'progress', { progress: 65 });
    await expect(advance(orderId, added.id, 'complete')).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await order.collection('photos').doc('approval-photo').set({ stageId: added.id, visibleToClient: true, uploadStatus: 'ready', storagePath: `ateliers/${atelierA}/orders/${orderId}/production/approval-photo`, storageGeneration: 'generation-1' });
    await advance(orderId, added.id, 'complete');
    const approvalId = (await order.collection('productionStages').doc(added.id).get()).get('pendingApprovalId');
    const approval = (await order.collection('approvals').doc(approvalId).get()).data();
    expect(approval.stageSnapshot).toMatchObject({ id: added.id, requiresClientApproval: true, semanticKey: 'finishing' });
    expect(approval.photoEvidence).toEqual([{ photoId: 'approval-photo', storagePath: `ateliers/${atelierA}/orders/${orderId}/production/approval-photo`, storageGeneration: 'generation-1' }]);
    await expect(call('createProductionPhotoUpload', { atelierId: atelierA, orderId, stageId: added.id, originalName: 'late-proof.png', contentType: 'image/png', caption: '', visibleToClient: true })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    current = await configuration(orderId);
    await expect(save(orderId, current, current.stages.map((stage) => stage.id === added.id ? { ...stage, requiresClientApproval: false } : stage))).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await signIn(foreignClient);
    await expect(call('respondToProductionApproval', { atelierId: atelierA, orderId, approvalId, decision: 'approved', comment: '' })).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await signIn(client);
    await order.collection('photos').doc('approval-photo').update({ storageGeneration: 'generation-tampered' });
    await expect(call('respondToProductionApproval', { atelierId: atelierA, orderId, approvalId, decision: 'approved', comment: '' })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await order.collection('photos').doc('approval-photo').update({ storageGeneration: 'generation-1' });
    await call('respondToProductionApproval', { atelierId: atelierA, orderId, approvalId, decision: 'changes_requested', comment: 'Ajustar acabamento' });
    expect((await order.collection('productionStages').doc(added.id).get()).get('progress')).toBe(65);
    await signIn(ownerA); await advance(orderId, added.id, 'complete');
    const newApprovalId = (await order.collection('productionStages').doc(added.id).get()).get('pendingApprovalId');
    await signIn(client);
    expect(await call('respondToProductionApproval', { atelierId: atelierA, orderId, approvalId: newApprovalId, decision: 'approved', comment: 'Aprovado' })).toMatchObject({ replayed: false });
    expect(await call('respondToProductionApproval', { atelierId: atelierA, orderId, approvalId: newApprovalId, decision: 'approved', comment: 'Aprovado' })).toMatchObject({ replayed: true });
    expect((await order.get()).get('status')).toBe('waiting_final_payment');
    await signIn(ownerA);
    await expect(advance(orderId, 'stage-shipping', 'start')).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await order.update({ amountRemaining: 0, amountRemainingCents: 5000 });
    await expect(advance(orderId, 'stage-shipping', 'start')).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await order.update({ amountRemaining: 0, amountRemainingCents: 0 }); await advance(orderId, 'stage-shipping', 'start');
    await order.update({ amountRemaining: 5, amountRemainingCents: 500 });
    await expect(advance(orderId, 'stage-shipping', 'complete')).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await order.update({ amountRemaining: 0, amountRemainingCents: 0 }); expect((await advance(orderId, 'stage-shipping', 'complete')).status).toBe('shipped');
    await expect(advance(orderId, added.id, 'block', { note: 'Mudança tardia' })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await expect(call('createProductionPhotoUpload', { atelierId: atelierA, orderId, stageId: added.id, originalName: 'late.png', contentType: 'image/png', caption: '', visibleToClient: true })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
  }, 90000);

  it('rejects agenda mutations of an approval snapshot and treats malformed IDs as invalid payloads', async () => {
    await signIn(ownerA); const { orderId, order } = await seedOrder('agenda-approval');
    const stageRef = order.collection('productionStages').doc('stage-modeling');
    await stageRef.update({ status: 'waiting_approval', assignedTo: ownerA.uid, deadline: '2026-11-03', version: 4 });
    await expect(call('allocateProductionTime', { requestId: randomUUID(), orderId, stageId: 'stage-modeling', assignedTo: ownerA.uid, startAt: '2026-11-02T12:00:00.000Z', endAt: '2026-11-02T13:00:00.000Z', plannedHours: 1 })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    const slotId = `approval-slot-${orderId}`;
    const futureStart = new Date(Date.now() + 14 * 86400000);
    await adminDb.doc(`ateliers/${atelierA}/productionSlots/${slotId}`).set({ orderId, stageId: 'stage-modeling', assignedTo: ownerA.uid, date: futureStart.toISOString().slice(0, 10), startAt: Timestamp.fromDate(futureStart), plannedHours: 1, status: 'scheduled' });
    const before = (await stageRef.get()).data();
    expect(await call('cancelProductionSlot', { slotId })).toMatchObject({ status: 'cancelled' });
    expect((await stageRef.get()).data()).toEqual(before);
    expect(await call('cancelProductionSlot', { slotId })).toMatchObject({ status: 'cancelled' });
    const pastSlotId = `past-${slotId}`;
    await adminDb.doc(`ateliers/${atelierA}/productionSlots/${pastSlotId}`).set({ orderId, stageId: 'stage-modeling', assignedTo: ownerA.uid, date: '2026-01-01', startAt: Timestamp.fromDate(new Date('2026-01-01T12:00:00Z')), plannedHours: 1, status: 'scheduled' });
    await expect(call('cancelProductionSlot', { slotId: pastSlotId })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await expect(call('createProductionPhotoUpload', { atelierId: `${atelierA}/orders/evil`, orderId, stageId: 'stage-modeling', originalName: 'proof.png', contentType: 'image/png', caption: '', visibleToClient: true })).rejects.toMatchObject({ code: 'functions/invalid-argument' });
  }, 60000);

  it.runIf(Boolean(process.env.FIREBASE_STORAGE_EMULATOR_HOST))('validates immutable photo bytes, safe retries and a terminal order race in Storage Emulator', async () => {
    await signIn(ownerA); const { orderId, order } = await seedOrder('photos', { status: 'ready_to_ship' });
    await Promise.all(defaultProductionStages.slice(0, 5).map((stage) => order.collection('productionStages').doc(stage.id).update({ status: 'completed', progress: 100 })));
    await order.collection('productionStages').doc('stage-shipping').update({ status: 'in_progress' });
    const create = () => call<{ photoId: string; storagePath: string }>('createProductionPhotoUpload', { atelierId: atelierA, orderId, stageId: 'stage-shipping', originalName: 'proof.png', contentType: 'image/png', caption: 'Prova sintética', visibleToClient: true });
    const valid = await create();
    const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
    await bucket.file(valid.storagePath).save(bytes, { metadata: { contentType: 'image/png', metadata: { photoId: valid.photoId, orderId } } });
    const complete = (photoId: string) => call('completeProductionPhotoUpload', { atelierId: atelierA, orderId, photoId });
    expect(await complete(valid.photoId)).toMatchObject({ status: 'ready' });
    expect(await complete(valid.photoId)).toMatchObject({ status: 'ready' });
    expect((await order.collection('photos').doc(valid.photoId).get()).get('storageGeneration')).toBeTruthy();
    const bad = await create();
    await bucket.file(bad.storagePath).save(Buffer.from('not a png'), { metadata: { contentType: 'image/png', metadata: { photoId: bad.photoId, orderId } } });
    await expect(complete(bad.photoId)).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    expect((await order.collection('photos').doc(bad.photoId).get()).get('uploadStatus')).toBe('rejected');
    const beforeApproval = await create();
    await bucket.file(beforeApproval.storagePath).save(bytes, { metadata: { contentType: 'image/png', metadata: { photoId: beforeApproval.photoId, orderId } } });
    await order.collection('productionStages').doc('stage-shipping').update({ requiresClientApproval: true });
    await advance(orderId, 'stage-shipping', 'complete');
    const approvalId = (await order.collection('productionStages').doc('stage-shipping').get()).get('pendingApprovalId');
    expect((await order.collection('approvals').doc(approvalId).get()).get('photoEvidence')).toHaveLength(1);
    await expect(complete(beforeApproval.photoId)).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    expect((await order.collection('photos').doc(beforeApproval.photoId).get()).get('uploadStatus')).toBe('pending');
    await advance(orderId, 'stage-shipping', 'cancel_approval', { note: 'Adicionar evidência antes de reenviar' });
    expect(await complete(beforeApproval.photoId)).toMatchObject({ status: 'ready' });
    const late = await create();
    await bucket.file(late.storagePath).save(bytes, { metadata: { contentType: 'image/png', metadata: { photoId: late.photoId, orderId } } });
    await order.update({ status: 'shipped' });
    await expect(complete(late.photoId)).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    expect((await order.collection('photos').doc(late.photoId).get()).get('uploadStatus')).toBe('pending');
  }, 90000);
});
