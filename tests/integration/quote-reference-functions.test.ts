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
    const created = await call<{ requestId: string; references: Array<{ uploadId: string; storagePath: string; capability: string }> }>('createPublicQuoteRequest', { tenantSlug: slug, input: { name: 'Cliente sintético', email: customer.email, character: 'Armadura', franchise: 'Obra sintética', category: 'full_cosplay', description: 'Solicitação inteiramente fictícia para validar referências privadas.', desiredDeliveryDate: '2027-12-31', urgency: 'normal' }, references: [{ name: 'reference.png', contentType: 'image/png', size: png.length, sha256: (await import('node:crypto')).createHash('sha256').update(png).digest('hex') }] });
    requestId = created.requestId; referenceId = created.references[0].uploadId; path = created.references[0].storagePath;
    await expect(uploadBytes(ref(storage, path), png, { contentType: 'image/png' })).rejects.toMatchObject({ code: 'storage/unauthorized' });
    const endpoint = new URL(`http://${emulatorHost}:${process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || '15001'}/${projectId}/us-central1/uploadPublicQuoteReferenceBytes`);
    endpoint.search = new URLSearchParams({ tenantSlug: slug, requestId, uploadId: referenceId }).toString();
    const upload = () => fetch(endpoint, { method: 'POST', body: png, headers: { 'Content-Type': 'image/png', Authorization: `Bearer ${created.references[0].capability}` } });
    expect((await upload()).status).toBe(200);
    const [original] = await bucket.file(path).getMetadata();
    expect((await upload()).status).toBe(200);
    expect((await bucket.file(path).getMetadata())[0].generation).toBe(original.generation);
    await expect(call('completePublicQuoteReferenceUpload', { tenantSlug: slug, requestId, uploadId: referenceId })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    const ready = (await adminDb.doc(`ateliers/${atelierIds[0]}/quoteRequests/${requestId}/references/${referenceId}`).get()).data(); expect(ready).toMatchObject({ uploadStatus: 'ready', size: png.length }); expect(ready.sha256).toMatch(/^[a-f0-9]{64}$/); expect(ready.storageGeneration).toBeTruthy();
    expect((await download({}, false)).status).toBe(401);
    await signIn(ownerA); const result = await download(); expect(result.status).toBe(200); expect(result.headers.get('cache-control')).toContain('no-store'); expect(result.headers.get('x-content-type-options')).toBe('nosniff'); expect(Buffer.from(await result.arrayBuffer())).toEqual(png);
    await expect(getDownloadURL(ref(storage, path))).rejects.toMatchObject({ code: 'storage/unauthorized' });
    await signIn(quotesReader); expect((await download()).status).toBe(200);
    await signIn(customer); expect((await download()).status).toBe(403);
    await signIn(ownerB); expect((await download()).status).toBe(404);
  }, 60_000);

  it('restringe capability a slug/arquivo/hash/expiração e impede replay, concorrência e sobrescrita', async () => {
    await signOut(auth);
    const hash = (await import('node:crypto')).createHash('sha256').update(png).digest('hex');
    const create = (sha256 = hash, size = png.length) => call<{ requestId: string; references: Array<{ uploadId: string; storagePath: string; capability: string }> }>('createPublicQuoteRequest', {
      tenantSlug: slug, input: { name: 'Cliente sintético', email: customer.email, character: 'Armadura', franchise: 'Obra sintética', category: 'full_cosplay', description: 'Solicitação fictícia para validar capabilities públicas.', desiredDeliveryDate: '2027-12-31', urgency: 'normal' },
      references: [{ name: 'reference.png', contentType: 'image/png', size, sha256 }],
    });
    await expect(create('invalid')).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    await expect(create(hash, 10 * 1024 * 1024 + 1)).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    const item = await create(); const target = item.references[0];
    const record = adminDb.doc(target.storagePath);
    const send = (options: { query?: Record<string, string>; capability?: string; body?: Buffer; type?: string; method?: string } = {}) => {
      const query = new URLSearchParams({ tenantSlug: slug, requestId: item.requestId, uploadId: target.uploadId, ...options.query });
      return fetch(`http://${emulatorHost}:${process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || '15001'}/${projectId}/us-central1/uploadPublicQuoteReferenceBytes?${query}`, {
        method: options.method || 'POST', body: options.method === 'GET' ? undefined : new Uint8Array(options.body || png), headers: { 'Content-Type': options.type || 'image/png', Authorization: `Bearer ${options.capability ?? target.capability}` },
      });
    };
    expect((await send({ method: 'GET' })).status).toBe(405);
    expect((await send({ capability: '0'.repeat(64) })).status).toBe(403);
    expect((await send({ query: { atelierId: atelierIds[1] } })).status).toBe(400);
    const foreignSlug = `${slug}-b`;
    await adminDb.doc(`publicAtelierSlugs/${foreignSlug}`).set({ slug: foreignSlug, atelierId: atelierIds[1] });
    await adminDb.doc(`publicAteliers/${atelierIds[1]}`).set({ slug: foreignSlug, published: true, quoteRequestsEnabled: true });
    try { expect((await send({ query: { tenantSlug: foreignSlug } })).status).toBe(403); }
    finally { await adminDb.doc(`publicAtelierSlugs/${foreignSlug}`).delete(); }
    expect((await send({ query: { uploadId: randomUUID() } })).status).toBe(403);
    expect((await send({ body: Buffer.from('fake image') })).status).toBe(400);
    expect((await send({ type: 'image/jpeg' })).status).toBe(400);
    expect((await send({ body: Buffer.concat([png, Buffer.from('changed')]) })).status).toBe(400);
    expect((await send({ body: Buffer.alloc(10 * 1024 * 1024 + 1) })).status).toBe(400);
    const expiration = (await record.get()).get('uploadExpiresAtMs');
    await record.update({ uploadExpiresAtMs: Date.now() - 1 }); expect((await send()).status).toBe(403); await record.update({ uploadExpiresAtMs: expiration });
    for (const [ref, field, original, denied] of [
      [adminDb.doc(`ateliers/${atelierIds[0]}`), 'active', true, false],
      [adminDb.doc(`ateliers/${atelierIds[0]}`), 'demoWorkspace', false, true],
      [adminDb.doc(`publicAteliers/${atelierIds[0]}`), 'published', true, false],
      [adminDb.doc(`publicAteliers/${atelierIds[0]}`), 'quoteRequestsEnabled', true, false],
      [adminDb.doc(`ateliers/${atelierIds[0]}/quoteRequests/${item.requestId}`), 'status', 'new', 'quoted'],
    ] as const) {
      await ref.update({ [field]: denied }); expect((await send()).ok).toBe(false); await ref.update({ [field]: original });
    }
    await expect(call('completePublicQuoteReferenceUpload', { tenantSlug: slug, requestId: item.requestId, uploadId: target.uploadId })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    const parallel = await Promise.all([send(), send()]); expect(parallel.some(r => r.status === 200)).toBe(true); expect(parallel.every(r => [200, 409].includes(r.status))).toBe(true);
    const before = (await record.get()).data(); const [metadata] = await bucket.file(target.storagePath).getMetadata();
    expect(before.uploadStatus).toBe('ready'); expect(before.capabilityConsumedAt).toBeTruthy(); expect(before.uploadCapabilityHash).not.toBe(target.capability);
    expect((await send()).status).toBe(200); expect((await record.get()).get('validatedAt')).toEqual(before.validatedAt);
    expect((await bucket.file(target.storagePath).getMetadata())[0].generation).toBe(metadata.generation);
    expect((await call<{ discarded: boolean }>('discardPublicQuoteReferenceUpload', { tenantSlug: slug, requestId: item.requestId, uploadId: target.uploadId })).discarded).toBe(false);
    expect((await bucket.file(target.storagePath).exists())[0]).toBe(true);
    await record.update({ uploadExpiresAtMs: Date.now() - 1 }); expect((await send()).status).toBe(403);
    const collision = await create(); const collisionRef = collision.references[0]; const different = Buffer.concat([png, Buffer.from('legacy')]);
    await bucket.file(collisionRef.storagePath).save(different, { metadata: { contentType: 'image/png', metadata: { sha256: hash } } });
    const response = await send({ query: { requestId: collision.requestId, uploadId: collisionRef.uploadId }, capability: collisionRef.capability });
    expect(response.status).toBe(409); expect((await bucket.file(collisionRef.storagePath).download())[0]).toEqual(different);
  }, 120_000);

  it('mantém leitura legada somente pelo servidor, com revogação e isolamento sem apagar objetos', async () => {
    await signIn(ownerA);
    await adminDb.doc(`ateliers/${atelierIds[0]}/clients/legacy-client`).set({ name: 'Cliente sintético' });
    await adminDb.doc(`ateliers/${atelierIds[0]}/portfolio/legacy-project`).set({ title: 'Projeto sintético' });
    await adminDb.doc(`ateliers/${atelierIds[0]}/orders/legacy-order`).set({ status: 'completed' });
    const endpoint = `http://${emulatorHost}:${process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || '15001'}/${projectId}/us-central1/downloadLegacyAtelierFileBytes`;
    const read = async (path: string, anonymous = false) => fetch(`${endpoint}?${new URLSearchParams({ path })}`, { headers: !anonymous && auth.currentUser ? { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` } : {} });
    const paths = ['branding/legacy.png', 'portfolio/legacy-project/legacy.png', 'clients/legacy-client/measurements/legacy.png', 'contracts/legacy.pdf', 'invoices/legacy.pdf', 'orders/legacy-order/shipping/legacy.pdf'];
    for (const path of paths) {
      const bytes = path.endsWith('.pdf') ? Buffer.from('%PDF-1.4\nsynthetic') : png;
      const type = path.endsWith('.pdf') ? 'application/pdf' : 'image/png';
      const fullPath = `ateliers/${atelierIds[0]}/${path}`; const oldToken = randomUUID();
      await bucket.file(fullPath).save(bytes, { metadata: { contentType: type, metadata: { firebaseStorageDownloadTokens: oldToken } } });
      expect((await read(path, true)).status).toBe(401);
      const allowed = await read(path); expect(allowed.status).toBe(200); expect(Buffer.from(await allowed.arrayBuffer())).toEqual(bytes);
      expect(allowed.headers.get('cache-control')).toContain('no-store'); expect(allowed.headers.get('x-content-sha256')).toMatch(/^[a-f0-9]{64}$/);
      expect((await fetch(tokenUrl(fullPath, oldToken))).status).not.toBe(200);
      await expect(getDownloadURL(ref(storage, fullPath))).rejects.toMatchObject({ code: 'storage/unauthorized' });
      expect((await bucket.file(fullPath).exists())[0]).toBe(true);
      await signIn(ownerB); expect((await read(path)).status).toBe(404); await signIn(ownerA);
    }
    for (const path of ['../other/secret', 'ateliers/other/contracts/secret.pdf', 'orders/legacy-order/production/photo', 'orders/legacy-order/attachments/file', 'quoteRequests/request/references/ref']) expect((await read(path)).status).toBe(400);
    await signIn(customer); expect((await read(paths[0])).status).toBe(403);
    await signIn(quotesReader); expect((await read(paths[0])).status).toBe(403);
    await signIn(ownerA);
    for (const target of [adminDb.doc(`users/${ownerA.uid}`), adminDb.doc(`ateliers/${atelierIds[0]}/members/${ownerA.uid}`), adminDb.doc(`ateliers/${atelierIds[0]}`)]) {
      await target.update({ active: false }); try { expect((await read(paths[0])).status).toBe(403); } finally { await target.update({ active: true }); }
    }
  }, 120_000);

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
