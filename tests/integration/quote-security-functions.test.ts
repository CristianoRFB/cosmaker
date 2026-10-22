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
const adminApp = initializeAdminApp({ projectId }, `quotes-security-tests-${nonce}`);
const adminAuth = getAdminAuth(adminApp);
const adminDb = getFirestore(adminApp);
const clientApp = initializeApp({ apiKey: 'emulator-only-key', authDomain: `${projectId}.firebaseapp.com`, projectId, appId: 'emulator-only-app' }, `quotes-security-client-${nonce}`);
const auth = getAuth(clientApp);
const functions = getFunctions(clientApp, 'us-central1');
const emulatorHost = process.env.FIREBASE_EMULATOR_HOST || '127.0.0.1';
connectAuthEmulator(auth, `http://${emulatorHost}:${process.env.COSMAKER_AUTH_EMULATOR_PORT || '19099'}`, { disableWarnings: true });
connectFunctionsEmulator(functions, emulatorHost, Number(process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || 15001));

type Identity = { uid: string; email: string; password: string };
const createdUids: string[] = [];
const atelierIds = [`quotes-security-${nonce}-a`, `quotes-security-${nonce}-b`];
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

let customer: Identity; let reader: Identity;
const root = () => adminDb.doc(`ateliers/${atelierIds[0]}`);
const newRequest = async () => {
  const ref = root().collection('quoteRequests').doc(); await ref.set({ status: 'new', name: 'Cliente sintético', email: customer.email, character: 'Armadura', franchise: 'Obra sintética', category: 'full_cosplay', description: 'Projeto totalmente sintético para validação de segurança.', desiredDeliveryDate: '2027-12-31', createdAt: new Date() }); return ref.id;
};
const input = (requestId: string) => ({ atelierId: atelierIds[0], requestId, items: [{ description: 'Confecção sintética', category: 'labor', quantity: 1, unitPrice: 1000 }], urgencyFee: 0, shipping: 0, discount: 0, depositPercentage: 30, validUntil: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) });
const draft = (requestId: string, extra: Record<string, unknown> = {}) => call<{ quoteId: string; total: number }>('createQuoteDraft', { ...input(requestId), ...extra });
const publish = (quoteId: string, extra: Record<string, unknown> = {}) => call<{ alreadyPublished: boolean }>('publishQuote', { atelierId: atelierIds[0], quoteId, ...extra });
const respond = (quoteId: string, extra: Record<string, unknown> = {}) => call('respondToQuote', { atelierId: atelierIds[0], quoteId, decision: 'approved', comment: '', ...extra });
beforeAll(async () => {
  [ownerA, ownerB, reader, customer] = await Promise.all(['quotes-owner-a', 'quotes-owner-b', 'quotes-reader', 'quotes-client'].map(createIdentity));
  await Promise.all([seedAtelier(atelierIds[0], ownerA), seedAtelier(atelierIds[1], ownerB)]);
  await adminDb.doc(`users/${reader.uid}`).set({ active: true, accountType: 'atelier_member', atelierId: atelierIds[0] }); await root().collection('members').doc(reader.uid).set({ active: true, role: 'assistant', permissions: ['quotes:read'] });
  await adminDb.doc(`users/${customer.uid}`).set({ active: true, accountType: 'client' });
});
afterAll(async () => {
  for (const id of atelierIds) {
    await adminDb.recursiveDelete(adminDb.doc(`ateliers/${id}`)); const logs = await adminDb.collection('auditLogs').where('atelierId', '==', id).get(); await Promise.all(logs.docs.map((doc: { ref: { delete(): Promise<unknown> } }) => doc.ref.delete()));
  }
  for (const uid of createdUids) { await adminAuth.deleteUser(uid); await adminDb.doc(`users/${uid}`).delete(); }
  await deleteApp(clientApp); await deleteApp(adminApp);
});
describe('Quote authorization and integrity regressions', () => {
  it('nega rascunho/publicação por leitor, cliente, tenant B, e-mail não verificado e revogação de perfil/membership/tenant', async () => {
    await signIn(ownerA); const requestId = await newRequest(); const created = await draft(requestId);
    for (const user of [reader, customer, ownerB]) { await signIn(user); await expect(draft(requestId)).rejects.toMatchObject({ code: 'functions/permission-denied' }); await expect(publish(created.quoteId)).rejects.toMatchObject({ code: 'functions/permission-denied' }); }
    await signIn(ownerA);
    for (const ref of [adminDb.doc(`users/${ownerA.uid}`), root().collection('members').doc(ownerA.uid), root()]) {
      await ref.update({ active: false }); try { await expect(draft(requestId)).rejects.toMatchObject({ code: 'functions/permission-denied' }); await expect(publish(created.quoteId)).rejects.toMatchObject({ code: 'functions/permission-denied' }); } finally { await ref.update({ active: true }); }
    }
    await adminAuth.updateUser(ownerA.uid, { emailVerified: false }); await auth.currentUser!.getIdToken(true);
    try { await expect(draft(requestId)).rejects.toMatchObject({ code: 'functions/failed-precondition' }); await expect(publish(created.quoteId)).rejects.toMatchObject({ code: 'functions/failed-precondition' }); } finally { await adminAuth.updateUser(ownerA.uid, { emailVerified: true }); await signIn(ownerA); }
    expect((await root().collection('quotes').get()).size).toBe(1); expect((await root().collection('quotes').doc(created.quoteId).get()).get('status')).toBe('draft');
    await signOut(auth); await expect(draft(requestId)).rejects.toMatchObject({ code: 'functions/unauthenticated' });
  }, 60_000);

  it('recusa payload extra, caminhos, datas inexistentes e valores monetários sem precisão segura', async () => {
    await signIn(ownerA); const requestId = await newRequest();
    for (const extra of [{ role: 'owner' }, { atelierId: '../foreign' }, { requestId: 'invalid/path' }, { validUntil: '2026-02-30' }, { expectedStartDate: '2027-02-30' }, { items: [{ description: 'Valor inválido', category: 'labor', quantity: 100000000, unitPrice: 100000000 }] }]) await expect(draft(requestId, extra)).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    const created = await draft(requestId); await expect(publish(created.quoteId, { role: 'owner' })).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    await root().collection('quotes').doc(created.quoteId).update({ validUntil: '2026-02-30' }); await expect(publish(created.quoteId)).rejects.toMatchObject({ code: 'functions/failed-precondition' });
  }, 60_000);

  it('serializa publicação concorrente e retry sem duplicar auditoria e recusa versão superada', async () => {
    await signIn(ownerA); const requestId = await newRequest(); const created = await draft(requestId);
    const results = await Promise.all([publish(created.quoteId), publish(created.quoteId)]); expect(results.filter((result) => result.alreadyPublished === false)).toHaveLength(1);
    expect(await publish(created.quoteId)).toMatchObject({ alreadyPublished: true });
    const logs = await adminDb.collection('auditLogs').where('entityId', '==', created.quoteId).where('action', '==', 'quote.sent_to_client_portal').get(); expect(logs.size).toBe(1);
    await root().collection('quoteRequests').doc(requestId).update({ activeQuoteId: 'newer-version' }); await expect(publish(created.quoteId)).rejects.toMatchObject({ code: 'functions/failed-precondition' });
  }, 60_000);

  it('exige cliente ativo e tenant ativo na resposta, respeita UID forte e mantém aprovação/criação do pedido', async () => {
    await signIn(ownerA); const requestId = await newRequest(); const created = await draft(requestId); await publish(created.quoteId); const quoteRef = root().collection('quotes').doc(created.quoteId);
    await signIn(customer);
    for (const target of [adminDb.doc(`users/${customer.uid}`), root()]) { await target.update({ active: false }); try { await expect(respond(created.quoteId)).rejects.toMatchObject({ code: 'functions/permission-denied' }); } finally { await target.update({ active: true }); } }
    await expect(respond(created.quoteId, { role: 'owner' })).rejects.toMatchObject({ code: 'functions/invalid-argument' }); await expect(respond(created.quoteId, { comment: {} })).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    await quoteRef.update({ clientUserId: ownerB.uid }); await expect(respond(created.quoteId)).rejects.toMatchObject({ code: 'functions/permission-denied' }); await quoteRef.update({ clientUserId: customer.uid });
    await respond(created.quoteId); expect((await quoteRef.get()).get('status')).toBe('approved');
    const deadline = Date.now() + 15000; const order = root().collection('orders').doc(created.quoteId);
    while (!(await order.get()).exists && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 250));
    expect((await order.get()).data()).toMatchObject({ status: 'waiting_deposit', approvedQuoteSnapshot: { total: 1000 }, clientUserId: customer.uid });
    expect((await order.collection('items').get()).size).toBe(1);
  }, 60_000);
});
