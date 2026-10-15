import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc, updateDoc } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { connectStorageEmulator, deleteObject, getBytes, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';

const requireFromFunctions = createRequire(new URL('../../functions/package.json', import.meta.url));
const { initializeApp: initializeAdminApp } = requireFromFunctions('firebase-admin/app');
const { getAuth: getAdminAuth } = requireFromFunctions('firebase-admin/auth');
const { getFirestore: getAdminFirestore } = requireFromFunctions('firebase-admin/firestore');
const { getStorage: getAdminStorage } = requireFromFunctions('firebase-admin/storage');
const projectId = 'demo-cosmaker';
const bucketName = `${projectId}.appspot.com`;
const nonce = randomUUID().slice(0, 8);
const adminApp = initializeAdminApp({ projectId, storageBucket: bucketName }, `order-file-tests-${nonce}`);
const adminAuth = getAdminAuth(adminApp);
const adminDb = getAdminFirestore(adminApp);
const bucket = getAdminStorage(adminApp).bucket();
const clientApp = initializeApp({ apiKey: 'emulator-only-key', authDomain: `${projectId}.firebaseapp.com`, projectId, appId: 'emulator-only-app', storageBucket: bucketName }, `order-file-client-${nonce}`);
const auth = getAuth(clientApp);
const db = getFirestore(clientApp);
const storage = getStorage(clientApp);
const functions = getFunctions(clientApp, 'us-central1');
const host = process.env.FIREBASE_EMULATOR_HOST || '127.0.0.1';
const emulatorConfigured = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.FIREBASE_STORAGE_EMULATOR_HOST);
const storagePort = Number(process.env.COSMAKER_STORAGE_EMULATOR_PORT || process.env.FIREBASE_STORAGE_EMULATOR_HOST?.split(':').at(-1) || 19199);
connectAuthEmulator(auth, `http://${host}:${process.env.COSMAKER_AUTH_EMULATOR_PORT || '19099'}`, { disableWarnings: true });
connectFirestoreEmulator(db, host, Number(process.env.FIRESTORE_EMULATOR_HOST?.split(':').at(-1) || process.env.COSMAKER_FIRESTORE_EMULATOR_PORT || 18080));
connectStorageEmulator(storage, host, storagePort);
connectFunctionsEmulator(functions, host, Number(process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || 15001));

type Identity = { uid: string; email: string; password: string };
type FileView = { id: string; originalName: string; visibleToClient: boolean; uploadStatus: string; archived: boolean; revision: number; [key: string]: unknown };
type Upload = { fileId: string; storagePath: string; status: string; alreadyCreated: boolean };
const atelierA = `order-files-${nonce}-a`;
const atelierB = `order-files-${nonce}-b`;
const demoAtelier = `order-files-${nonce}-demo`;
const orderId = `order-${nonce}`;
const createdIdentities: Identity[] = [];
const pngBytes = readFileSync(resolve(process.cwd(), 'tests/fixtures/production-progress.png'));
let ownerA: Identity;
let ownerB: Identity;
let clientA: Identity;
let stranger: Identity;
let reader: Identity;
let unverified: Identity;

async function identity(label: string, emailVerified = true) {
  const email = `${label}-${nonce}@cosmaker.test`;
  const password = `Local!${randomUUID().slice(0, 14)}aA1`;
  const user = await adminAuth.createUser({ email, password, emailVerified });
  const result = { uid: user.uid, email, password };
  createdIdentities.push(result);
  return result;
}
async function signIn(user: Identity) {
  await signOut(auth).catch(() => undefined);
  await signInWithEmailAndPassword(auth, user.email, user.password);
  await auth.currentUser?.getIdToken(true);
}
function call<T = Record<string, unknown>>(name: string, data: Record<string, unknown>) {
  return httpsCallable<Record<string, unknown>, T>(functions, name)(data).then((response) => response.data);
}
function request(extra: Record<string, unknown> = {}) {
  return { atelierId: atelierA, orderId, requestId: randomUUID(), originalName: 'referencia.png', contentType: 'image/png', size: pngBytes.length, category: 'reference', visibleToClient: false, ...extra };
}
async function createReady(extra: Record<string, unknown> = {}) {
  const upload = await call<Upload>('createOrderFileUpload', request(extra));
  await uploadBytes(ref(storage, upload.storagePath), pngBytes, { contentType: 'image/png', customMetadata: { fileId: upload.fileId, orderId } });
  await call('completeOrderFileUpload', { atelierId: atelierA, orderId, fileId: upload.fileId });
  return upload;
}
function access(fileId: string, expectedRevision: number, visibleToClient: boolean, archived = false, requestId = randomUUID()) {
  return { atelierId: atelierA, orderId, fileId, expectedRevision, visibleToClient, archived, requestId };
}

beforeAll(async () => {
  // This suite never falls back to a remote project or remote Storage.
  if (!emulatorConfigured) {
    throw new Error('Order file tests require local Auth, Firestore and Storage Emulators.');
  }
  [ownerA, ownerB, clientA, stranger, reader, unverified] = await Promise.all([
    identity('owner-files-a'), identity('owner-files-b'), identity('client-files-a'), identity('stranger-files'), identity('reader-files-a'), identity('unverified-files', false),
  ]);
  await Promise.all([
    adminDb.doc(`ateliers/${atelierA}`).set({ active: true, ownerId: ownerA.uid }),
    adminDb.doc(`ateliers/${atelierB}`).set({ active: true, ownerId: ownerB.uid }),
    adminDb.doc(`ateliers/${demoAtelier}`).set({ active: true, demoWorkspace: true, ownerId: ownerA.uid }),
    adminDb.doc(`ateliers/${atelierA}/members/${ownerA.uid}`).set({ role: 'owner', active: true, permissions: [] }),
    adminDb.doc(`ateliers/${atelierB}/members/${ownerB.uid}`).set({ role: 'owner', active: true, permissions: [] }),
    adminDb.doc(`ateliers/${demoAtelier}/members/${ownerA.uid}`).set({ role: 'owner', active: true, permissions: [] }),
    adminDb.doc(`ateliers/${atelierA}/members/${reader.uid}`).set({ role: 'assistant', active: true, permissions: ['orders:read'] }),
    adminDb.doc(`ateliers/${atelierA}/members/${unverified.uid}`).set({ role: 'owner', active: true, permissions: [] }),
    adminDb.doc(`ateliers/${atelierA}/orders/${orderId}`).set({ atelierId: atelierA, clientUserId: clientA.uid, email: clientA.email, status: 'confirmed' }),
    adminDb.doc(`ateliers/${atelierB}/orders/${orderId}`).set({ atelierId: atelierB, email: stranger.email, status: 'confirmed' }),
    adminDb.doc(`ateliers/${demoAtelier}/orders/${orderId}`).set({ atelierId: demoAtelier, email: clientA.email, status: 'confirmed' }),
  ]);
}, 30_000);

afterAll(async () => {
  if (!emulatorConfigured) {
    await deleteApp(clientApp);
    await adminApp.delete();
    return;
  }
  for (const atelierId of [atelierA, atelierB, demoAtelier]) {
    await adminDb.recursiveDelete(adminDb.doc(`ateliers/${atelierId}`)).catch(() => undefined);
    await bucket.deleteFiles({ prefix: `ateliers/${atelierId}/` }).catch(() => undefined);
    const audits = await adminDb.collection('auditLogs').where('atelierId', '==', atelierId).get();
    await Promise.all(audits.docs.map((document: { ref: { delete(): Promise<unknown> } }) => document.ref.delete()));
  }
  await Promise.all(createdIdentities.map((user) => adminAuth.deleteUser(user.uid).catch(() => undefined)));
  await deleteApp(clientApp);
  await adminApp.delete();
}, 30_000);

describe('Order file Functions and Storage in Firebase Emulator', () => {
  it('rejects anonymous, unverified, reader, client, demo and Tenant B mutations and validates the upload intent', async () => {
    await signOut(auth);
    await expect(call('createOrderFileUpload', request())).rejects.toMatchObject({ code: 'functions/unauthenticated' });
    await signIn(unverified);
    await expect(call('listOrderFiles', { atelierId: atelierA, orderId })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await expect(call('createOrderFileUpload', request())).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    for (const user of [ownerB, reader, clientA, stranger]) {
      await signIn(user);
      await expect(call('createOrderFileUpload', request())).rejects.toMatchObject({ code: 'functions/permission-denied' });
    }
    await signIn(ownerB);
    await expect(call('listOrderFiles', { atelierId: atelierA, orderId })).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await signIn(ownerA);
    await expect(call('createOrderFileUpload', request({ atelierId: demoAtelier }))).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await expect(call('createOrderFileUpload', request({ atelierId: atelierB }))).rejects.toMatchObject({ code: 'functions/permission-denied' });
    for (const invalid of [{ storagePath: 'ateliers/another/orders/order/attachments/file' }, { size: 20 * 1024 * 1024 + 1 }, { contentType: 'text/html' }, { category: 'arbitrary' }, { originalName: '\u0000file.png' }]) {
      await expect(call('createOrderFileUpload', request(invalid))).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    }
    const input = request();
    const upload = await call<Upload>('createOrderFileUpload', input);
    expect(upload).toMatchObject({ fileId: input.requestId, status: 'pending', alreadyCreated: false });
    expect(await call('createOrderFileUpload', input)).toMatchObject({ fileId: upload.fileId, alreadyCreated: true });
    await expect(call('createOrderFileUpload', { ...input, originalName: 'other.png' })).rejects.toMatchObject({ code: 'functions/already-exists' });
    const file = (await adminDb.doc(`ateliers/${atelierA}/orders/${orderId}/files/${upload.fileId}`).get()).data();
    expect(file).toMatchObject({ uploadedBy: ownerA.uid, storagePath: upload.storagePath, uploadStatus: 'pending', revision: 0 });
    await expect(setDoc(doc(db, `ateliers/${atelierA}/orders/${orderId}/files/forged`), { storagePath: upload.storagePath, uploadStatus: 'ready' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(updateDoc(doc(db, `ateliers/${atelierA}/orders/${orderId}/files/${upload.fileId}`), { visibleToClient: true })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(uploadBytes(ref(storage, `ateliers/${atelierA}/orders/${orderId}/documents/forged.pdf`), new Uint8Array([1, 2, 3]), { contentType: 'application/pdf' })).rejects.toMatchObject({ code: 'storage/unauthorized' });
    await expect(call('completeOrderFileUpload', { atelierId: atelierA, orderId, fileId: upload.fileId })).rejects.toMatchObject({ code: 'functions/failed-precondition', details: { reason: 'file_not_received' } });
  }, 60_000);

  it('validates stored bytes before ready, removes permanent download tokens and completes once on retries', async () => {
    await signIn(ownerA);
    const upload = await call<Upload>('createOrderFileUpload', request({ visibleToClient: true }));
    await expect(uploadBytes(ref(storage, upload.storagePath), pngBytes, { contentType: 'image/png', customMetadata: { fileId: 'wrong-file', orderId } })).rejects.toMatchObject({ code: 'storage/unauthorized' });
    await uploadBytes(ref(storage, upload.storagePath), pngBytes, { contentType: 'image/png', customMetadata: { fileId: upload.fileId, orderId } });
    // A link obtained before backend validation must become unusable after token removal.
    const preValidationUrl = await getDownloadURL(ref(storage, upload.storagePath)).catch(() => null);
    await expect(uploadBytes(ref(storage, upload.storagePath), pngBytes, { contentType: 'image/png', customMetadata: { fileId: upload.fileId, orderId } })).rejects.toMatchObject({ code: 'storage/unauthorized' });
    expect(await call('completeOrderFileUpload', { atelierId: atelierA, orderId, fileId: upload.fileId })).toMatchObject({ status: 'ready', alreadyApplied: false });
    expect(await call('completeOrderFileUpload', { atelierId: atelierA, orderId, fileId: upload.fileId })).toMatchObject({ status: 'ready', alreadyApplied: true });
    const storedBytes = await getBytes(ref(storage, upload.storagePath));
    expect(Buffer.from(storedBytes).equals(pngBytes)).toBe(true);
    await expect(getDownloadURL(ref(storage, upload.storagePath))).rejects.toMatchObject({ code: 'storage/no-download-url' });
    if (preValidationUrl) expect((await fetch(preValidationUrl)).ok).toBe(false);
    const [metadata] = await bucket.file(upload.storagePath).getMetadata();
    expect(metadata.metadata?.firebaseStorageDownloadTokens).toBeFalsy();
    const ready = (await adminDb.doc(`ateliers/${atelierA}/orders/${orderId}/files/${upload.fileId}`).get()).data();
    expect(ready).toMatchObject({ uploadStatus: 'ready', archived: false });
    expect(String(ready?.generation)).not.toBe('');
    const audits = await adminDb.collection('auditLogs').where('atelierId', '==', atelierA).where('action', '==', 'order.file_uploaded').get();
    expect(audits.docs.filter((document: { data(): { after: { fileId: string } } }) => document.data().after.fileId === upload.fileId)).toHaveLength(1);
  }, 45_000);

  it.each(['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])('rejects MIME-spoofed %s bytes and deletes the rejected object', async (contentType) => {
    await signIn(ownerA);
    const bytes = Buffer.from('This is not an image or PDF.');
    const input = request({ contentType, size: bytes.length });
    const upload = await call<Upload>('createOrderFileUpload', input);
    await uploadBytes(ref(storage, upload.storagePath), bytes, { contentType, customMetadata: { fileId: upload.fileId, orderId } });
    await expect(call('completeOrderFileUpload', { atelierId: atelierA, orderId, fileId: upload.fileId })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    expect((await adminDb.doc(`ateliers/${atelierA}/orders/${orderId}/files/${upload.fileId}`).get()).data()?.uploadStatus).toBe('rejected');
    expect((await bucket.file(upload.storagePath).exists())[0]).toBe(false);
    await expect(call('createOrderFileUpload', input)).rejects.toMatchObject({ code: 'functions/failed-precondition' });
  }, 30_000);

  it('filters client lists and revokes byte access with versioned, audited, idempotent sharing and archival', async () => {
    await signIn(ownerA);
    const internal = await createReady({ originalName: 'interno.png' });
    const shared = await createReady({ originalName: 'cliente.png', visibleToClient: true });
    const pending = await call<Upload>('createOrderFileUpload', request({ originalName: 'pendente.png', visibleToClient: true }));
    await signIn(reader);
    const staffList = await call<{ files: FileView[] }>('listOrderFiles', { atelierId: atelierA, orderId });
    expect(staffList.files.map((file) => file.id)).toEqual(expect.arrayContaining([internal.fileId, shared.fileId, pending.fileId]));
    expect(staffList.files.find((file) => file.id === internal.fileId)).not.toHaveProperty('uploadedBy');
    expect(staffList.files.find((file) => file.id === internal.fileId)).not.toHaveProperty('requestFingerprint');
    await expect(call('updateOrderFileAccess', access(shared.fileId, 0, false))).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await signIn(clientA);
    const clientList = await call<{ files: FileView[] }>('listOrderFiles', { atelierId: atelierA, orderId });
    expect(clientList.files.some((file) => file.id === shared.fileId)).toBe(true);
    expect(clientList.files.some((file) => file.id === internal.fileId || file.id === pending.fileId)).toBe(false);
    await expect(getDoc(doc(db, `ateliers/${atelierA}/orders/${orderId}/files/${shared.fileId}`))).rejects.toMatchObject({ code: 'permission-denied' });
    expect(Buffer.from(await getBytes(ref(storage, shared.storagePath))).equals(pngBytes)).toBe(true);
    await expect(getBytes(ref(storage, internal.storagePath))).rejects.toMatchObject({ code: 'storage/unauthorized' });
    await expect(getDownloadURL(ref(storage, shared.storagePath))).rejects.toMatchObject({ code: 'storage/no-download-url' });
    // Model a previously stored attachment carrying a residual public token.
    await bucket.file(shared.storagePath).setMetadata({ metadata: { fileId: shared.fileId, orderId, firebaseStorageDownloadTokens: randomUUID() } });
    const legacyUrl = await getDownloadURL(ref(storage, shared.storagePath));
    expect((await fetch(legacyUrl)).ok).toBe(true);
    await signIn(stranger);
    await expect(call('listOrderFiles', { atelierId: atelierA, orderId })).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await expect(getBytes(ref(storage, shared.storagePath))).rejects.toMatchObject({ code: 'storage/unauthorized' });
    await signIn(ownerB);
    await expect(getBytes(ref(storage, shared.storagePath))).rejects.toMatchObject({ code: 'storage/unauthorized' });
    await expect(call('completeOrderFileUpload', { atelierId: atelierA, orderId, fileId: shared.fileId })).rejects.toMatchObject({ code: 'functions/permission-denied' });

    await signIn(ownerA);
    const revoke = access(shared.fileId, 0, false);
    expect(await call('updateOrderFileAccess', revoke)).toMatchObject({ revision: 1, alreadyApplied: false });
    expect(await call('updateOrderFileAccess', revoke)).toMatchObject({ revision: 1, alreadyApplied: true });
    await expect(call('updateOrderFileAccess', { ...revoke, visibleToClient: true })).rejects.toMatchObject({ code: 'functions/already-exists' });
    await expect(call('updateOrderFileAccess', access(shared.fileId, 0, true))).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await signIn(clientA);
    await expect(getBytes(ref(storage, shared.storagePath))).rejects.toMatchObject({ code: 'storage/unauthorized' });
    expect((await fetch(legacyUrl)).ok).toBe(false);
    expect((await call<{ files: FileView[] }>('listOrderFiles', { atelierId: atelierA, orderId })).files.some((file) => file.id === shared.fileId)).toBe(false);

    await signIn(ownerA);
    expect(await call('updateOrderFileAccess', access(shared.fileId, 1, true))).toMatchObject({ revision: 2 });
    expect(await call('updateOrderFileAccess', access(shared.fileId, 2, true, true))).toMatchObject({ revision: 3 });
    expect((await adminDb.doc(`ateliers/${atelierA}/orders/${orderId}/files/${shared.fileId}`).get()).data()).toMatchObject({ archived: true, visibleToClient: false, revision: 3 });
    await signIn(clientA);
    await expect(getBytes(ref(storage, shared.storagePath))).rejects.toMatchObject({ code: 'storage/unauthorized' });
    await signIn(ownerA);
    expect(Buffer.from(await getBytes(ref(storage, shared.storagePath))).equals(pngBytes)).toBe(true);
    await expect(deleteObject(ref(storage, shared.storagePath))).rejects.toMatchObject({ code: 'storage/unauthorized' });
    expect(await call('updateOrderFileAccess', access(shared.fileId, 3, false))).toMatchObject({ revision: 4 });
    const audits = await adminDb.collection('auditLogs').where('atelierId', '==', atelierA).where('action', '==', 'order.file_access_updated').get();
    expect(audits.docs.filter((document: { data(): { after: { fileId: string } } }) => document.data().after.fileId === shared.fileId)).toHaveLength(4);
  }, 60_000);

  it('keeps the original quote reference immutable and projects it for the owning client', async () => {
    const fileId = `quote-snapshot-${nonce}`;
    const storagePath = `ateliers/${atelierA}/quoteRequests/request-${nonce}/references/${fileId}`;
    await adminDb.doc(`ateliers/${atelierA}/orders/${orderId}/files/${fileId}`).set({ originalName: 'snapshot.png', storagePath, contentType: 'image/png', size: pngBytes.length, source: 'quote_request', createdAt: new Date() });
    await signIn(clientA);
    const list = await call<{ files: FileView[] }>('listOrderFiles', { atelierId: atelierA, orderId });
    expect(list.files).toEqual(expect.arrayContaining([expect.objectContaining({ id: fileId, visibleToClient: true, uploadStatus: 'ready' })]));
    await signIn(ownerA);
    await expect(call('updateOrderFileAccess', access(fileId, 0, false, true))).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    expect((await adminDb.doc(`ateliers/${atelierA}/orders/${orderId}/files/${fileId}`).get()).data()?.source).toBe('quote_request');
  }, 30_000);

  it('cancels pending and rejected uploads with audit and retry safety without allowing their reuse or byte upload', async () => {
    await signIn(ownerA);
    const pendingInput = request({ originalName: 'nao-enviado.png', visibleToClient: true });
    const pending = await call<Upload>('createOrderFileUpload', pendingInput);
    const rejectBytes = Buffer.from('Invalid image content.');
    const rejectedInput = request({ originalName: 'recusado.png', size: rejectBytes.length });
    const rejected = await call<Upload>('createOrderFileUpload', rejectedInput);
    await uploadBytes(ref(storage, rejected.storagePath), rejectBytes, { contentType: 'image/png', customMetadata: { fileId: rejected.fileId, orderId } });
    await expect(call('completeOrderFileUpload', { atelierId: atelierA, orderId, fileId: rejected.fileId })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await signIn(reader);
    await expect(call('updateOrderFileAccess', access(pending.fileId, 0, false, true))).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await signIn(ownerA);
    for (const upload of [pending, rejected]) {
      const cancellation = access(upload.fileId, 0, false, true);
      expect(await call('updateOrderFileAccess', cancellation)).toMatchObject({ revision: 1, alreadyApplied: false });
      expect(await call('updateOrderFileAccess', cancellation)).toMatchObject({ revision: 1, alreadyApplied: true });
      const document = await adminDb.doc(`ateliers/${atelierA}/orders/${orderId}/files/${upload.fileId}`).get();
      expect(document.data()).toMatchObject({ uploadStatus: 'cancelled', archived: true, visibleToClient: false, revision: 1 });
      await expect(call('completeOrderFileUpload', { atelierId: atelierA, orderId, fileId: upload.fileId })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
      await expect(call('updateOrderFileAccess', access(upload.fileId, 1, true))).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    }
    await expect(uploadBytes(ref(storage, pending.storagePath), pngBytes, { contentType: 'image/png', customMetadata: { fileId: pending.fileId, orderId } })).rejects.toMatchObject({ code: 'storage/unauthorized' });
    for (const original of [pendingInput, rejectedInput]) await expect(call('createOrderFileUpload', original)).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    const actions = await adminDb.collection('auditLogs').where('atelierId', '==', atelierA).where('action', '==', 'order.file_access_updated').get();
    expect(actions.docs.filter((document: { data(): { after: { fileId: string } } }) => [pending.fileId, rejected.fileId].includes(document.data().after.fileId))).toHaveLength(2);
    await signIn(clientA);
    const clientFiles = await call<{ files: FileView[] }>('listOrderFiles', { atelierId: atelierA, orderId });
    expect(clientFiles.files.some((file) => file.id === pending.fileId || file.id === rejected.fileId)).toBe(false);
  }, 60_000);
});
