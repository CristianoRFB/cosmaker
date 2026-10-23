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
const adminApp = initializeAdminApp({ projectId }, `client-quotes-tests-${nonce}`);
const adminAuth = getAdminAuth(adminApp);
const adminDb = getFirestore(adminApp);
const clientApp = initializeApp({ apiKey: 'emulator-only-key', authDomain: `${projectId}.firebaseapp.com`, projectId, appId: 'emulator-only-app' }, `client-quotes-client-${nonce}`);
const auth = getAuth(clientApp);
const functions = getFunctions(clientApp, 'us-central1');
const emulatorHost = process.env.FIREBASE_EMULATOR_HOST || '127.0.0.1';
connectAuthEmulator(auth, `http://${emulatorHost}:${process.env.COSMAKER_AUTH_EMULATOR_PORT || '19099'}`, { disableWarnings: true });
connectFunctionsEmulator(functions, emulatorHost, Number(process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || 15001));

type Identity = { uid: string; email: string; password: string };
const createdUids: string[] = [];
const atelierIds = [`client-quotes-${nonce}-a`, `client-quotes-${nonce}-b`];
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

let customer: Identity; let recycled: Identity;
const root = () => adminDb.doc(`ateliers/${atelierIds[0]}`);
const stamp = () => new Date();
const makeQuote = async (id: string, fields: Record<string, unknown> = {}, tenant = root()) => {
  const ref = tenant.collection('quotes').doc(id);
  await ref.set({ requestId: `request-${id}`, clientId: null, email: customer.email, status: 'sent', materialsCost: 100, laborCost: 200, otherCost: 0, urgencyFee: 0, shipping: 0, discount: 0, subtotal: 300, total: 300, depositPercentage: 30, depositAmount: 90, validUntil: '2027-12-31', createdAt: stamp(), updatedAt: stamp(), internalNotes: 'PRIVATE', actorId: ownerA.uid, downloadUrl: 'PRIVATE', ...fields });
  return ref;
};
const list = (data: Record<string, unknown> = {}) => call<{ quotes: Record<string, unknown>[]; nextCursor: string | null }>('listClientQuotes', data);
const detail = (id: string, data: Record<string, unknown> = {}) => call<{ quote: Record<string, unknown>; items: Record<string, unknown>[]; responses: Record<string, unknown>[]; nextResponsesCursor: string | null }>('getClientQuote', { atelierId: atelierIds[0], quoteId: id, ...data });
beforeAll(async () => {
  [ownerA, ownerB, customer] = await Promise.all(['projection-owner-a', 'projection-owner-b', 'projection-client'].map(createIdentity));
  await Promise.all([seedAtelier(atelierIds[0], ownerA), seedAtelier(atelierIds[1], ownerB)]);
  await adminDb.doc(`users/${customer.uid}`).set({ active: true, accountType: 'client' });
});
afterAll(async () => {
  for (const id of atelierIds) await adminDb.recursiveDelete(adminDb.doc(`ateliers/${id}`));
  await adminDb.recursiveDelete(adminDb.doc(`foreign/${nonce}`));
  for (const uid of createdUids) { await adminAuth.deleteUser(uid); await adminDb.doc(`users/${uid}`).delete(); }
  await deleteApp(clientApp); await deleteApp(adminApp);
});
describe('Client quote projection, UID isolation and revocation', () => {
  it('projects only public fields and accepts a verified, truly unbound invitation', async () => {
    const quote = await makeQuote('unbound');
    await quote.collection('items').doc('item').set({ description: 'Confecção', category: 'labor', quantity: 1, unitPrice: 300, total: 300, internalCostCents: 1, actorId: ownerA.uid });
    await quote.collection('responses').doc('reply').set({ decision: 'request_changes', comment: 'Ajustar tamanho', createdAt: stamp(), actorId: ownerA.uid, email: ownerA.email, internalNotes: 'PRIVATE' });
    await signIn(customer);
    expect((await list()).quotes.map((quote) => quote.id)).toContain('unbound');
    const result = await detail('unbound');
    expect(result.items).toHaveLength(1); expect(result.responses).toHaveLength(1);
    expect(result.responses[0].createdAt).toEqual(expect.any(String));
    for (const data of [result.quote, ...result.items, ...result.responses]) for (const key of ['actorId', 'internalNotes', 'downloadUrl', 'internalCostCents', 'clientUserId', 'approvedBy', 'rejectedBy']) expect(data).not.toHaveProperty(key);
    expect(result.responses[0]).not.toHaveProperty('email');
    await expect(list({ email: customer.email })).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    await expect(detail('unbound', { role: 'owner' })).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    await expect(detail('../foreign')).rejects.toMatchObject({ code: 'functions/invalid-argument' });
  }, 60_000);

  it('denies recycled email, conflicting/malformed UIDs and unindexed CRM ownership; preserves history after email changes', async () => {
    const previousEmail = customer.email;
    await makeQuote('strong', { clientUserId: customer.uid });
    await makeQuote('approved-legacy', { status: 'approved', approvedBy: customer.uid });
    await root().collection('clients').doc('legacy-crm').set({ userId: customer.uid, email: previousEmail });
    await makeQuote('crm-legacy', { clientId: 'legacy-crm' });
    await makeQuote('unindexed-crm');
    await makeQuote('conflict', { clientId: 'legacy-crm', clientUserId: ownerB.uid });
    await makeQuote('malformed', { clientUserId: '' });
    const changedEmail = `changed-${nonce}@cosmaker.test`;
    await adminAuth.updateUser(customer.uid, { email: changedEmail }); customer.email = changedEmail;
    recycled = await createIdentity('replacement');
    await adminAuth.updateUser(recycled.uid, { email: previousEmail }); recycled.email = previousEmail;
    await adminDb.doc(`users/${recycled.uid}`).set({ active: true, accountType: 'client' });
    await signIn(recycled);
    expect((await list()).quotes).toHaveLength(0);
    for (const id of ['strong', 'approved-legacy', 'crm-legacy', 'unindexed-crm', 'conflict', 'malformed']) await expect(detail(id)).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await expect(call('respondToQuote', { atelierId: atelierIds[0], quoteId: 'crm-legacy', decision: 'request_changes', comment: 'Teste de vínculo' })).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await signIn(customer);
    const ids = (await list()).quotes.map((quote) => quote.id);
    expect(ids).toEqual(expect.arrayContaining(['strong', 'approved-legacy', 'crm-legacy']));
    expect(ids).not.toContain('conflict'); expect(ids).not.toContain('malformed');
    expect((await detail('strong')).quote.id).toBe('strong');
  }, 60_000);

  it('checks profile, tenant, role, verification, canonical namespace, drafts and foreign cursors', async () => {
    const own = await makeQuote('active', { clientUserId: customer.uid });
    await makeQuote('draft', { status: 'draft' });
    await makeQuote('foreign-tenant', { email: ownerB.email, clientUserId: ownerB.uid }, adminDb.doc(`ateliers/${atelierIds[1]}`));
    await makeQuote('namespace', { clientUserId: customer.uid }, adminDb.doc(`foreign/${nonce}`));
    await signIn(customer);
    for (const target of [root(), adminDb.doc(`users/${customer.uid}`)]) {
      await target.update({ active: false });
      try { if (target.path.startsWith('users/')) await expect(list()).rejects.toMatchObject({ code: 'functions/permission-denied' }); else expect((await list()).quotes).toHaveLength(0); await expect(detail(own.id)).rejects.toMatchObject({ code: 'functions/permission-denied' }); }
      finally { await target.update({ active: true }); }
    }
    const ids = (await list()).quotes.map((row) => row.id); expect(ids).not.toContain('namespace'); expect(ids).not.toContain('draft'); expect(ids).not.toContain('foreign-tenant');
    await expect(detail('foreign-tenant', { atelierId: atelierIds[1] })).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await expect(detail('draft')).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await expect(list({ cursor: Buffer.from(`ateliers/${atelierIds[1]}/quotes/foreign-tenant`).toString('base64url') })).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await adminAuth.updateUser(customer.uid, { emailVerified: false }); await auth.currentUser!.getIdToken(true);
    await expect(list()).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await adminAuth.updateUser(customer.uid, { emailVerified: true });
    await signIn(ownerA); await expect(list()).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await signOut(auth); await expect(list()).rejects.toMatchObject({ code: 'functions/unauthenticated' });
  }, 60_000);

  it('paginates quote and response history without silently dropping undated legacy rows', async () => {
    const quotes = await Promise.all(Array.from({ length: 52 }, (_, i) => makeQuote(`page-${String(i).padStart(3, '0')}`, { clientUserId: customer.uid, createdAt: i === 51 ? null : new Date(2000000000000 + i * 1000) })));
    await Promise.all(Array.from({ length: 52 }, (_, i) => quotes[0].collection('responses').doc(`reply-${i}`).set({ decision: 'request_changes', comment: `Resposta ${i}`, createdAt: i === 51 ? null : stamp(), actorId: customer.uid })));
    await signIn(customer);
    const first = await list(); expect(first.quotes).toHaveLength(50); expect(first.nextCursor).toEqual(expect.any(String));
    const second = await list({ cursor: first.nextCursor }); expect(second.nextCursor).toBeNull();
    const ids = [...first.quotes, ...second.quotes].map((row) => row.id); expect(new Set(ids).size).toBe(ids.length); expect(ids).toContain('page-051');
    const firstDetail = await detail(quotes[0].id); expect(firstDetail.responses).toHaveLength(50);
    const secondDetail = await detail(quotes[0].id, { responseCursor: firstDetail.nextResponsesCursor }); expect(secondDetail.responses).toHaveLength(2); expect(secondDetail.nextResponsesCursor).toBeNull();
    expect([...firstDetail.responses, ...secondDetail.responses].find((response) => response.id === 'reply-51')?.createdAt).toBeNull();
    await expect(detail(quotes[0].id, { responseCursor: 'not-in-history' })).rejects.toMatchObject({ code: 'functions/invalid-argument' });
  }, 90_000);
});
