import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { connectStorageEmulator, getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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
const adminApp = initializeAdminApp({ projectId }, `references-tests-${nonce}`);
const adminAuth = getAdminAuth(adminApp);
const adminDb = getFirestore(adminApp);
const clientApp = initializeApp({ apiKey: 'emulator-only-key', authDomain: `${projectId}.firebaseapp.com`, projectId, appId: 'emulator-only-app' }, `references-client-${nonce}`);
const auth = getAuth(clientApp);
const functions = getFunctions(clientApp, 'us-central1');
const emulatorHost = process.env.FIREBASE_EMULATOR_HOST || '127.0.0.1';
connectAuthEmulator(auth, `http://${emulatorHost}:${process.env.COSMAKER_AUTH_EMULATOR_PORT || '19099'}`, { disableWarnings: true });
connectFunctionsEmulator(functions, emulatorHost, Number(process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || 15001));

type Identity = { uid: string; email: string; password: string };
const createdUids: string[] = [];
const atelierIds = [`references-${nonce}-a`, `references-${nonce}-b`];
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

const { getStorage: getAdminStorage } = requireFromFunctions('firebase-admin/storage');
const storage = getStorage(clientApp, `gs://${projectId}.appspot.com`); const storagePort = process.env.COSMAKER_STORAGE_EMULATOR_PORT || '19199';
connectStorageEmulator(storage, emulatorHost, Number(storagePort));
const bucket = getAdminStorage(adminApp).bucket(`${projectId}.appspot.com`);
const png = readFileSync(new URL('../fixtures/production-progress.png', import.meta.url));
const slug = `references-${nonce}`;
let customer: Identity; let quotesReader: Identity; let requestId: string; let referenceId: string; let path: string;
async function download(query: Record<string, string> = {}, withAuth = true) {
  const url = new URL(`http://${emulatorHost}:${process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || '15001'}/${projectId}/us-central1/downloadQuoteReferenceBytes`);
  url.searchParams.set('requestId', requestId); url.searchParams.set('referenceId', referenceId); for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return fetch(url, { headers: withAuth && auth.currentUser ? { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` } : {} });
}
function tokenUrl(objectPath: string, token: string) { return `http://${emulatorHost}:${storagePort}/v0/b/${projectId}.appspot.com/o/${encodeURIComponent(objectPath)}?alt=media&token=${encodeURIComponent(token)}`; }
beforeAll(async () => {
  [ownerA, ownerB, noReportAccess, quotesReader, customer] = await Promise.all(['references-owner-a', 'references-owner-b', 'references-denied', 'references-reader', 'references-client'].map(createIdentity));
  await Promise.all([seedAtelier(atelierIds[0], ownerA), seedAtelier(atelierIds[1], ownerB)]);
  await adminDb.doc(`publicAteliers/${atelierIds[0]}`).set({ slug, name: 'Ateliê sintético', published: true, quoteRequestsEnabled: true });
  await adminDb.doc(`publicAtelierSlugs/${slug}`).set({ atelierId: atelierIds[0], slug });
  for (const [user, permissions] of [[noReportAccess, ['orders:read']], [quotesReader, ['quotes:read']]] as Array<[Identity, string[]]>) {
    await adminDb.doc(`users/${user.uid}`).set({ active: true, accountType: 'atelier_member', atelierId: atelierIds[0] }); await adminDb.doc(`ateliers/${atelierIds[0]}/members/${user.uid}`).set({ active: true, role: 'assistant', permissions });
  }
  await adminDb.doc(`users/${customer.uid}`).set({ active: true, accountType: 'client' });
});
afterAll(async () => {
  for (const id of atelierIds) { await bucket.deleteFiles({ prefix: `ateliers/${id}/` }); await adminDb.recursiveDelete(adminDb.doc(`ateliers/${id}`)); await adminDb.doc(`publicAteliers/${id}`).delete(); }
  await adminDb.doc(`publicAtelierSlugs/${slug}`).delete();
  for (const uid of createdUids) { await adminAuth.deleteUser(uid); await adminDb.doc(`users/${uid}`).delete(); }
  await deleteApp(clientApp); await deleteApp(adminApp);
});
describe('Protected quote reference bytes', () => {
  it('valida upload público, revoga token antes de ready e transfere bytes somente para equipe autorizada', async () => {
    await signOut(auth);
    const created = await call<{ requestId: string; references: Array<{ uploadId: string; storagePath: string }> }>('createPublicQuoteRequest', { tenantSlug: slug, input: { name: 'Cliente sintético', email: customer.email, character: 'Armadura', franchise: 'Obra sintética', category: 'full_cosplay', description: 'Solicitação inteiramente fictícia para validar referências privadas.', desiredDeliveryDate: '2027-12-31', urgency: 'normal' }, references: [{ name: 'reference.png', contentType: 'image/png', size: png.length }] });
    requestId = created.requestId; referenceId = created.references[0].uploadId; path = created.references[0].storagePath;
    await uploadBytes(ref(storage, path), png, { contentType: 'image/png' });
    const [pending] = await bucket.file(path).getMetadata(); const oldToken = pending.metadata?.firebaseStorageDownloadTokens?.split(',')[0]; expect(oldToken).toBeTruthy();
    expect((await fetch(tokenUrl(path, oldToken))).status).toBe(200);
    await call('completePublicQuoteReferenceUpload', { tenantSlug: slug, requestId, uploadId: referenceId });
    const ready = (await adminDb.doc(`ateliers/${atelierIds[0]}/quoteRequests/${requestId}/references/${referenceId}`).get()).data(); expect(ready).toMatchObject({ uploadStatus: 'ready', size: png.length }); expect(ready.sha256).toMatch(/^[a-f0-9]{64}$/); expect(ready.storageGeneration).toBeTruthy();
    expect((await fetch(tokenUrl(path, oldToken))).status).not.toBe(200);
    expect((await download({}, false)).status).toBe(401);
    await signIn(ownerA); const result = await download(); expect(result.status).toBe(200); expect(result.headers.get('cache-control')).toContain('no-store'); expect(result.headers.get('x-content-type-options')).toBe('nosniff'); expect(Buffer.from(await result.arrayBuffer())).toEqual(png);
    await expect(getDownloadURL(ref(storage, path))).rejects.toMatchObject({ code: 'storage/unauthorized' });
    await signIn(quotesReader); expect((await download()).status).toBe(200);
    await signIn(customer); expect((await download()).status).toBe(403);
    await signIn(ownerB); expect((await download()).status).toBe(404);
  }, 60_000);

  it('nega permissões, perfis e tenant revogados e parâmetros adulterados sem fornecer URLs privadas', async () => {
    await signIn(noReportAccess); expect((await download()).status).toBe(403);
    await signIn(ownerA); expect((await download({ atelierId: atelierIds[1] })).status).toBe(400);
    for (const target of [adminDb.doc(`users/${ownerA.uid}`), adminDb.doc(`ateliers/${atelierIds[0]}/members/${ownerA.uid}`), adminDb.doc(`ateliers/${atelierIds[0]}`)]) {
      await target.update({ active: false }); try { const denied = await download(); expect(denied.status).toBe(403); expect(await denied.text()).not.toContain(path); } finally { await target.update({ active: true }); }
    }
    const record = adminDb.doc(`ateliers/${atelierIds[0]}/quoteRequests/${requestId}/references/${referenceId}`);
    await record.update({ archived: true }); expect((await download()).status).toBe(404); await record.update({ archived: false });
    await record.update({ sha256: '0'.repeat(64) }); expect((await download()).status).toBe(409); await record.update({ sha256: (await import('node:crypto')).createHash('sha256').update(png).digest('hex') });
    await record.update({ storagePath: `ateliers/${atelierIds[1]}/quoteRequests/foreign/references/foreign` }); expect((await download()).status).toBe(409); await record.update({ storagePath: path });
  }, 60_000);

  it('concilia links legados em leitura autorizada e preserva a cópia protegida do pedido para o cliente por UID', async () => {
    await signIn(ownerA);
    const legacyId = newId(); const legacyPath = `ateliers/${atelierIds[0]}/quoteRequests/${requestId}/references/${legacyId}`; const legacyToken = newId();
    await bucket.file(legacyPath).save(png, { metadata: { contentType: 'image/png', metadata: { firebaseStorageDownloadTokens: legacyToken } } });
    await adminDb.doc(legacyPath).set({ originalName: 'legacy.png', contentType: 'image/png', size: png.length, storagePath: legacyPath });
    expect((await fetch(tokenUrl(legacyPath, legacyToken))).status).toBe(200);
    expect((await download({ referenceId: legacyId })).status).toBe(200); expect((await fetch(tokenUrl(legacyPath, legacyToken))).status).not.toBe(200);
    const orderId = newId(); const order = adminDb.doc(`ateliers/${atelierIds[0]}/orders/${orderId}`);
    await order.set({ requestId, clientUserId: customer.uid, clientId: null, email: customer.email, status: 'confirmed' });
    await order.collection('files').doc(referenceId).set({ ...(await adminDb.doc(path).get()).data(), source: 'quote_request' });
    const url = `http://${emulatorHost}:${process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || '15001'}/${projectId}/us-central1/downloadOrderFileBytes?atelierId=${atelierIds[0]}&orderId=${orderId}&fileId=${referenceId}`;
    await signIn(customer); const result = await fetch(url, { headers: { Authorization: `Bearer ${await auth.currentUser!.getIdToken()}` } }); expect(result.status).toBe(200); expect(Buffer.from(await result.arrayBuffer())).toEqual(png);
    await signIn(ownerB); expect((await fetch(url, { headers: { Authorization: `Bearer ${await auth.currentUser!.getIdToken()}` } })).status).toBe(403);
  }, 60_000);
});
