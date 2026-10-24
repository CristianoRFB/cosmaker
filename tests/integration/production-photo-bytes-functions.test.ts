import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { defaultProductionStages } from '../../functions/src/orders/production-template';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Production integration tests require local Firestore and Auth Emulators.');
const requireFromFunctions = createRequire(new URL('../../functions/package.json', import.meta.url));
const { initializeApp: initializeAdminApp } = requireFromFunctions('firebase-admin/app');
const { getAuth: getAdminAuth } = requireFromFunctions('firebase-admin/auth');
const { getFirestore, Timestamp } = requireFromFunctions('firebase-admin/firestore');
const { getStorage } = requireFromFunctions('firebase-admin/storage');
const projectId = 'demo-cosmaker';
const nonce = randomUUID().slice(0, 8);
const adminApp = initializeAdminApp({ projectId, storageBucket: `${projectId}.appspot.com` }, `photo-byte-tests-${nonce}`);
const adminAuth = getAdminAuth(adminApp);
const adminDb = getFirestore(adminApp);
const bucket = getStorage(adminApp).bucket();
const clientApp = initializeApp({ apiKey: 'emulator-only-key', authDomain: `${projectId}.firebaseapp.com`, projectId, appId: 'emulator-only-app' }, `photo-byte-client-${nonce}`);
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

type Photo = { photoId: string; storagePath: string };
const png = await readFile(new URL('../fixtures/production-progress.png', import.meta.url));
async function prepare(label: string) {
  await signIn(ownerA); const order = await seedOrder(label);
  await order.order.collection('productionStages').doc('stage-start').update({ status: 'in_progress' });
  return order;
}
const createPhoto = (orderId: string) => call<Photo>('createProductionPhotoUpload', { atelierId: atelierA, orderId, stageId: 'stage-start', originalName: 'proof.png', contentType: 'image/png', caption: 'Foto sintética', visibleToClient: true });
async function send(orderId: string, photo: Photo, bytes = png, query: Record<string, string> = {}, authenticated = true) {
  const endpoint = new URL(`http://${emulatorHost}:${process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || 15001}/${projectId}/us-central1/uploadProductionPhotoBytes`);
  for (const [key, value] of Object.entries({ atelierId: atelierA, orderId, photoId: photo.photoId, ...query })) endpoint.searchParams.set(key, value);
  return fetch(endpoint, { method: 'POST', body: new Uint8Array(bytes), headers: { 'Content-Type': 'image/png', ...(authenticated ? { Authorization: `Bearer ${await auth.currentUser!.getIdToken()}` } : {}) }, signal: AbortSignal.timeout(120_000) });
}
describe('Production photo bytes', () => {
  it('requires a durable client UID for photo reads and preserves CRM-linked historical photos', async () => {
    const { orderId, order } = await prepare('private-reader'); const photo = await createPhoto(orderId);
    expect((await send(orderId, photo)).status).toBe(200);
    const original = (await order.get()).data();
    const endpoint = new URL(`http://${emulatorHost}:${process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || 15001}/${projectId}/us-central1/downloadProductionPhotoBytes`);
    for (const [key, value] of Object.entries({ atelierId: atelierA, orderId, photoId: photo.photoId })) endpoint.searchParams.set(key, value);
    // Resolve the live token on every request, including after account switches.
    const authorizedRead = async () => fetch(endpoint, { headers: { Authorization: `Bearer ${await auth.currentUser!.getIdToken()}` } });
    await signIn(client); expect((await authorizedRead()).status).toBe(200);
    for (const clientUserId of [null, 42, '', foreignClient.uid]) {
      await order.update({ clientUserId, clientId: null });
      expect((await authorizedRead()).status).toBe(403);
    }
    await order.set({ ...original, clientUserId: null, email: 'previous-contact@cosmaker.test' });
    expect((await authorizedRead()).status).toBe(200); // CRM UID survives contact-email changes.
    await signIn(foreignClient); expect((await authorizedRead()).status).toBe(403);
    expect((await fetch(endpoint)).status).toBe(401);
    expect((await bucket.file(photo.storagePath).exists())[0]).toBe(true);
  }, 90_000);

  it('checks current UID, profile, membership, tenant, payload and content before storing bytes', async () => {
    const { orderId, order } = await prepare('http-identity'); const photo = await createPhoto(orderId); const file = bucket.file(photo.storagePath);
    expect((await send(orderId, photo, png, {}, false)).status).toBe(401);
    for (const person of [ownerB, reader, client, foreignClient]) { await signIn(person); expect((await send(orderId, photo)).status).toBe(403); }
    await signIn(ownerA);
    for (const target of [adminDb.doc(`users/${ownerA.uid}`), adminDb.doc(`ateliers/${atelierA}/members/${ownerA.uid}`), adminDb.doc(`ateliers/${atelierA}`)]) {
      await target.update({ active: false }); try { expect((await send(orderId, photo)).status).toBe(403); } finally { await target.update({ active: true }); }
    }
    await adminAuth.updateUser(ownerA.uid, { emailVerified: false }); await auth.currentUser!.getIdToken(true);
    try { expect((await send(orderId, photo)).status).toBe(409); } finally { await adminAuth.updateUser(ownerA.uid, { emailVerified: true }); await signIn(ownerA); }
    const invalidQueries: Record<string, string>[] = [{ atelierId: '../foreign' }, { photoId: 'invalid/path' }, { role: 'owner' }];
    for (const query of invalidQueries) expect((await send(orderId, photo, png, query)).status).toBe(400);
    expect((await send(orderId, photo, Buffer.from('not an image'))).status).toBe(400);
    const huge = Buffer.alloc(10 * 1024 * 1024 + 1); png.copy(huge, 0, 0, 12);
    expect([400, 413]).toContain((await send(orderId, photo, huge)).status);
    await order.collection('photos').doc(photo.photoId).update({ uploadedBy: ownerB.uid }); expect((await send(orderId, photo)).status).toBe(403);
    await order.collection('photos').doc(photo.photoId).update({ uploadedBy: ownerA.uid });
    await adminDb.doc(`ateliers/${atelierA}`).update({ demoWorkspace: true }); try { expect((await send(orderId, photo)).status).toBe(409); } finally { await adminDb.doc(`ateliers/${atelierA}`).update({ demoWorkspace: false }); }
    expect((await file.exists())[0]).toBe(false);
    expect((await order.collection('photos').doc(photo.photoId).get()).get('uploadStatus')).toBe('pending');
  }, 90_000);

  it('serializes concurrent uploads, binds actual bytes, retries safely and writes one audit', async () => {
    const { orderId, order } = await prepare('http-retry'); const photo = await createPhoto(orderId);
    const responses = await Promise.all([send(orderId, photo), send(orderId, photo)]);
    expect(responses.some((response) => response.status === 200)).toBe(true); expect(responses.every((response) => [200, 409].includes(response.status))).toBe(true);
    const retry = await send(orderId, photo); expect(retry.status).toBe(200); expect(await retry.json()).toMatchObject({ photoId: photo.photoId, status: 'ready', alreadyApplied: true });
    const record = (await order.collection('photos').doc(photo.photoId).get()).data();
    expect(record.storageGeneration).toEqual(expect.any(String)); expect(record.sha256).toMatch(/^[a-f0-9]{64}$/); expect(record.uploadLeaseId).toBeUndefined();
    expect((await bucket.file(photo.storagePath).download())[0].equals(png)).toBe(true);
    const logs = await adminDb.collection('auditLogs').where('atelierId', '==', atelierA).where('entityId', '==', orderId).where('action', '==', 'production.photo_uploaded').get(); expect(logs.size).toBe(1);
    const changed = Buffer.from(png); changed[changed.length - 1] ^= 1;
    expect((await send(orderId, photo, changed)).status).toBe(409);
    const collision = await createPhoto(orderId);
    // A legacy object may claim the desired hash. The endpoint compares the actual stored bytes.
    await bucket.file(collision.storagePath).save(changed, { metadata: { contentType: 'image/png', metadata: { photoId: collision.photoId, orderId, sha256: record.sha256 } } });
    expect((await send(orderId, collision)).status).toBe(409);
    expect((await bucket.file(collision.storagePath).download())[0].equals(changed)).toBe(true);
    expect((await order.collection('photos').doc(collision.photoId).get()).get('uploadStatus')).toBe('pending');
    expect((await order.collection('photos').doc(collision.photoId).get()).get('uploadLeaseId')).toBeUndefined();
    await expect(call('completeProductionPhotoUpload', { atelierId: atelierA, orderId, photoId: collision.photoId })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    expect((await order.collection('photos').doc(collision.photoId).get()).get('uploadStatus')).toBe('rejected');
  }, 90_000);

  it('serializes upload against approval evidence and refuses terminal orders and pending approvals', async () => {
    const { orderId, order } = await prepare('http-approval-race');
    await order.collection('productionStages').doc('stage-start').update({ requiresClientApproval: true });
    const first = await createPhoto(orderId); expect((await send(orderId, first)).status).toBe(200);
    const concurrent = await createPhoto(orderId);
    const [upload, completion] = await Promise.all([send(orderId, concurrent), advance(orderId, 'stage-start', 'complete')]);
    expect(completion.replayed).toBe(false); expect([200, 409]).toContain(upload.status);
    const stage = await order.collection('productionStages').doc('stage-start').get();
    expect(stage.get('status')).toBe('waiting_approval');
    const approval = await order.collection('approvals').doc(stage.get('pendingApprovalId')).get();
    const evidence = approval.get('photoEvidence').map((row: { photoId: string }) => row.photoId);
    expect(evidence).toContain(first.photoId);
    const uploaded = await order.collection('photos').doc(concurrent.photoId).get();
    expect(evidence.includes(concurrent.photoId)).toBe(uploaded.get('uploadStatus') === 'ready');
    if (uploaded.get('uploadStatus') === 'pending') expect((await send(orderId, concurrent)).status).toBe(409);
    const terminal = await prepare('http-terminal'); const late = await createPhoto(terminal.orderId);
    await terminal.order.update({ status: 'shipped' }); expect((await send(terminal.orderId, late)).status).toBe(409);
    expect((await bucket.file(late.storagePath).exists())[0]).toBe(false);
  }, 90_000);
});
