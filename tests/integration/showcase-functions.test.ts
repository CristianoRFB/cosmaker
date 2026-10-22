import { readFile } from 'node:fs/promises';
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
const adminApp = initializeAdminApp({ projectId }, `showcase-tests-${nonce}`);
const adminAuth = getAdminAuth(adminApp);
const adminDb = getFirestore(adminApp);
const { getStorage } = requireFromFunctions('firebase-admin/storage');
const bucket = getStorage(adminApp).bucket(`${projectId}.appspot.com`);
const clientApp = initializeApp({ apiKey: 'emulator-only-key', authDomain: `${projectId}.firebaseapp.com`, projectId, appId: 'emulator-only-app' }, `showcase-client-${nonce}`);
const auth = getAuth(clientApp);
const functions = getFunctions(clientApp, 'us-central1');
const emulatorHost = process.env.FIREBASE_EMULATOR_HOST || '127.0.0.1';
connectAuthEmulator(auth, `http://${emulatorHost}:${process.env.COSMAKER_AUTH_EMULATOR_PORT || '19099'}`, { disableWarnings: true });
connectFunctionsEmulator(functions, emulatorHost, Number(process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || 15001));

type Identity = { uid: string; email: string; password: string };
const createdUids: string[] = [];
const atelierIds = [`showcase-${nonce}-a`, `showcase-${nonce}-b`];
const newId = () => randomUUID();
let ownerA: Identity;
let ownerB: Identity;
let noShowcaseAccess: Identity;

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

const slugs = [`showcase-${nonce}-a`, `showcase-${nonce}-b`];
const functionBase = `http://${emulatorHost}:${process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || 15001}/${projectId}/us-central1`;
const serviceInput = { title: 'Armaduras sob medida', description: 'Modelagem e pintura de armaduras para cosplay.', category: 'armor', public: true, active: true, sortOrder: 0, internalNotes: 'PRIVATE-SERVICE-NOTE', version: 0 };
const projectInput = { ...serviceInput, title: 'Armadura violeta', public: false, character: 'Personagem sintético', franchise: 'Universo fictício', featured: true };
const saveService = (extra: Record<string, unknown> = {}, requestId = newId()) => call<{ id: string; version: number; alreadyApplied: boolean }>('saveAtelierService', { ...serviceInput, ...extra, requestId });
const saveProject = (extra: Record<string, unknown> = {}, requestId = newId()) => call<{ id: string; version: number; alreadyApplied: boolean }>('saveAtelierPortfolioProject', { ...projectInput, ...extra, requestId });
const publicCatalog = (tenantSlug = slugs[0]) => call<{ status: string; services: Array<Record<string, unknown>>; projects: Array<Record<string, unknown>> }>('listPublicShowcase', { tenantSlug });
const profileInput = { name: 'Ateliê Violeta', tagline: 'Projetos autorais', brandColor: '#123abc', published: true, quoteRequestsEnabled: true };
let png: Buffer;
async function upload(project: string, image: string, version: number, bytes = png, contentType = 'image/png') {
  return fetch(`${functionBase}/uploadShowcaseImage?${new URLSearchParams({ projectId: project, imageId: image, version: String(version), caption: 'Armadura sintética' })}`, { method: 'POST', body: new Uint8Array(bytes), headers: { Authorization: `Bearer ${await auth.currentUser!.getIdToken()}`, 'Content-Type': contentType } });
}
async function image(project: string, imageId: string, tenantSlug: string | null = slugs[0]) {
  return fetch(`${functionBase}/downloadShowcaseImage?${new URLSearchParams({ projectId: project, imageId, ...(tenantSlug ? { tenantSlug } : {}) })}`, { headers: tenantSlug ? {} : { Authorization: `Bearer ${await auth.currentUser!.getIdToken()}` } });
}
beforeAll(async () => {
  [ownerA, ownerB, noShowcaseAccess] = await Promise.all(['owner-showcase-a', 'owner-showcase-b', 'denied-showcase'].map(createIdentity));
  await Promise.all([seedAtelier(atelierIds[0], ownerA), seedAtelier(atelierIds[1], ownerB)]);
  for (let index = 0; index < 2; index++) {
    await adminDb.doc(`publicAtelierSlugs/${slugs[index]}`).set({ atelierId: atelierIds[index], slug: slugs[index] });
    await adminDb.doc(`publicAteliers/${atelierIds[index]}`).set({ slug: slugs[index], name: 'Ateliê sintético', published: true, quoteRequestsEnabled: true, privateBillingEmail: 'PRIVATE-CONTACT' });
  }
  await adminDb.doc(`users/${noShowcaseAccess.uid}`).set({ active: true, accountType: 'atelier_member', atelierId: atelierIds[0] });
  await adminDb.doc(`ateliers/${atelierIds[0]}/members/${noShowcaseAccess.uid}`).set({ active: true, role: 'assistant', permissions: [] });
  png = await readFile(new URL('../fixtures/production-progress.png', import.meta.url));
  await signIn(ownerA);
});
afterAll(async () => {
  for (let index = 0; index < 2; index++) {
    await adminDb.recursiveDelete(adminDb.doc(`ateliers/${atelierIds[index]}`));
    await adminDb.doc(`publicAtelierSlugs/${slugs[index]}`).delete();
    await adminDb.recursiveDelete(adminDb.doc(`publicAteliers/${atelierIds[index]}`));
    const [files] = await bucket.getFiles({ prefix: `ateliers/${atelierIds[index]}/portfolio/` });
    await Promise.all(files.map((file: { delete(): Promise<unknown> }) => file.delete()));
    const audits = await adminDb.collection('auditLogs').where('atelierId', '==', atelierIds[index]).get();
    await Promise.all(audits.docs.map((doc: { ref: { delete(): Promise<unknown> } }) => doc.ref.delete()));
  }
  for (const uid of createdUids) { await adminAuth.deleteUser(uid); await adminDb.doc(`users/${uid}`).delete(); }
  await deleteApp(clientApp); await deleteApp(adminApp);
});
describe('Showcase Functions em demo-cosmaker', () => {
  it('mantém serviços versionados, deduplica retries e projeta apenas conteúdo público do slug', async () => {
    await signIn(ownerA); const key = newId(); const service = await saveService({}, key);
    expect(await saveService({}, key)).toMatchObject({ id: service.id, alreadyApplied: true });
    await expect(saveService({ title: 'Outro título' }, key)).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    const catalog = await publicCatalog(); expect(catalog.services).toHaveLength(1);
    expect(JSON.stringify(catalog)).not.toContain('PRIVATE');
    await expect(saveService({ id: service.id, version: 0, title: 'Concorrente' })).rejects.toMatchObject({ code: 'functions/aborted' });
    await saveService({ id: service.id, version: 1, public: false });
    expect((await publicCatalog()).services).toEqual([]);
    const own = await call<{ items: Array<Record<string, unknown>> }>('listAtelierShowcase', { section: 'services' });
    expect(own.items[0]).toMatchObject({ id: service.id, public: false, internalNotes: 'PRIVATE-SERVICE-NOTE', version: 2 });
    await signIn(ownerB); expect((await publicCatalog(slugs[1])).services).toEqual([]);
    await expect(saveService({ id: service.id, version: 2 })).rejects.toMatchObject({ code: 'functions/not-found' });
    await signIn(ownerA);
    const attempts = await Promise.allSettled([saveService({ id: service.id, version: 2, title: 'Edição A' }), saveService({ id: service.id, version: 2, title: 'Edição B' })]);
    expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  }, 60_000);

  it('transfere bytes privados, publica galeria e revoga leitura ao despublicar projeto ou página', async () => {
    await signIn(ownerA); const project = await saveProject(); const imageId = newId();
    await expect(saveProject({ id: project.id, version: 1, public: true })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    expect((await image(project.id, imageId)).status).toBe(404);
    expect((await upload(project.id, imageId, 1)).status).toBe(200);
    expect((await upload(project.id, imageId, 1)).status).toBe(200);
    expect((await upload(project.id, imageId, 2, Buffer.concat([png, Buffer.from('changed')]))).status).toBe(409);
    const preview = await image(project.id, imageId, null); expect(preview.status).toBe(200); expect(Buffer.from(await preview.arrayBuffer())).toEqual(png);
    expect((await image(project.id, imageId)).status).toBe(404);
    await saveProject({ id: project.id, version: 2, public: true });
    const published = await image(project.id, imageId); expect(published.status).toBe(200); expect(published.headers.get('cache-control')).toContain('no-store');
    expect(Buffer.from(await published.arrayBuffer())).toEqual(png);
    const catalog = await publicCatalog(); expect(catalog.projects).toHaveLength(1); expect(JSON.stringify(catalog)).not.toMatch(/PRIVATE|storagePath|sha256|downloadUrl|actorId/);
    expect((await image(project.id, imageId, slugs[1])).status).toBe(404);
    await call('saveAtelierPublicProfile', { ...profileInput, published: false, quoteRequestsEnabled: false, version: 0, requestId: newId() });
    expect((await publicCatalog()).status).toBe('unpublished'); expect((await image(project.id, imageId)).status).toBe(404);
    await call('saveAtelierPublicProfile', { ...profileInput, version: 1, requestId: newId() });
    expect((await image(project.id, imageId)).status).toBe(200);
    await saveProject({ id: project.id, version: 3, public: false });
    expect((await image(project.id, imageId)).status).toBe(404);
    const removed = { requestId: newId(), projectId: project.id, imageId, version: 4 };
    await call('removeShowcaseImage', removed); expect(await call('removeShowcaseImage', removed)).toMatchObject({ alreadyApplied: true });
    expect((await image(project.id, imageId, null)).status).toBe(404);
    expect((await adminDb.doc(`ateliers/${atelierIds[0]}/portfolio/${project.id}`).get()).data()).toMatchObject({ images: [], public: false, version: 5 });
  }, 60_000);

  it('nega payloads adulterados, conteúdo inválido, acesso cruzado, papéis e perfis sem autorização', async () => {
    await signIn(ownerA); const project = await saveProject();
    for (const changes of [{ atelierId: atelierIds[1] }, { actorId: ownerB.uid }, { title: 'x'.repeat(121) }, { category: 'unknown' }, { public: true, active: false }, { version: -1 }]) {
      await expect(saveService(changes)).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    }
    expect((await upload(project.id, newId(), 1, Buffer.from('%PDF-1.7'), 'application/pdf')).status).toBe(400);
    await signIn(ownerB); expect((await upload(project.id, newId(), 1)).status).toBe(404); expect((await image(project.id, newId(), null)).status).toBe(404);
    await signIn(noShowcaseAccess);
    for (const name of ['saveAtelierService', 'saveAtelierPortfolioProject', 'saveAtelierPublicProfile']) await expect(call(name, {})).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await expect(call('listAtelierShowcase', { section: 'portfolio' })).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await signIn(ownerA);
    await adminDb.doc(`users/${ownerA.uid}`).update({ active: false });
    try { expect((await upload(project.id, newId(), 1)).status).toBe(403); await expect(saveService()).rejects.toMatchObject({ code: 'functions/permission-denied' }); }
    finally { await adminDb.doc(`users/${ownerA.uid}`).update({ active: true }); }
    await adminDb.doc(`ateliers/${atelierIds[0]}`).update({ active: false });
    try { expect((await publicCatalog()).status).toBe('suspended'); await expect(saveService()).rejects.toMatchObject({ code: 'functions/permission-denied' }); }
    finally { await adminDb.doc(`ateliers/${atelierIds[0]}`).update({ active: true }); }
    await signOut(auth); await expect(saveService()).rejects.toMatchObject({ code: 'functions/unauthenticated' });
    await expect(call('listPublicShowcase', { tenantSlug: slugs[0], atelierId: atelierIds[1] })).rejects.toMatchObject({ code: 'functions/invalid-argument' });
  }, 60_000);

  it('vincula solicitação ao serviço publicado do próprio slug e preserva snapshot comercial', async () => {
    await signIn(ownerA); const service = await saveService({ title: 'Perucas autorais', category: 'wig' });
    const input = { name: 'Visitante sintético', email: 'visitor@example.test', character: 'Personagem sintético', franchise: 'Universo sintético', category: 'wig', description: 'Projeto fictício para validar o vínculo comercial.', desiredDeliveryDate: '2027-10-22', urgency: 'normal', serviceId: service.id };
    const result = await call<{ requestId: string }>('createPublicQuoteRequest', { tenantSlug: slugs[0], input, references: [] });
    const request = await adminDb.doc(`ateliers/${atelierIds[0]}/quoteRequests/${result.requestId}`).get();
    expect(request.data()).toMatchObject({ showcaseContext: { service: { id: service.id, title: 'Perucas autorais' } } });
    await expect(call('createPublicQuoteRequest', { tenantSlug: slugs[1], input, references: [] })).rejects.toMatchObject({ code: 'functions/not-found' });
    await saveService({ id: service.id, version: 1, public: false });
    await expect(call('createPublicQuoteRequest', { tenantSlug: slugs[0], input, references: [] })).rejects.toMatchObject({ code: 'functions/not-found' });
    expect((await adminDb.doc(`ateliers/${atelierIds[0]}/quoteRequests/${result.requestId}`).get()).data()?.showcaseContext.service.title).toBe('Perucas autorais');
    await expect(call('createPublicQuoteRequest', { tenantSlug: slugs[0], input: { ...input, serviceId: '../other' }, references: [] })).rejects.toMatchObject({ code: 'functions/invalid-argument' });
  }, 60_000);

  it('preserva slug e flags comerciais, audita branding e bloqueia intake de demonstração', async () => {
    await signIn(ownerA);
    const profile = { ...profileInput, version: 2, requestId: newId() };
    await call('saveAtelierPublicProfile', profile); expect(await call('saveAtelierPublicProfile', profile)).toMatchObject({ alreadyApplied: true });
    const resolution = await call<{ tenant: Record<string, unknown> }>('resolvePublicTenant', { tenantSlug: slugs[0] });
    expect(resolution.tenant).toMatchObject({ slug: slugs[0], name: 'Ateliê Violeta', brandColor: '#123abc' });
    expect(JSON.stringify(resolution)).not.toContain('PRIVATE');
    await adminDb.doc(`ateliers/${atelierIds[0]}`).update({ demoWorkspace: true });
    try {
      await expect(call('saveAtelierPublicProfile', { ...profile, version: 3, requestId: newId() })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    } finally { await adminDb.doc(`ateliers/${atelierIds[0]}`).update({ demoWorkspace: false }); }
    const logs = await adminDb.collection('auditLogs').where('atelierId', '==', atelierIds[0]).where('action', '==', 'showcase.profile_saved').get();
    expect(logs.size).toBe(3);
  }, 60_000);
});
