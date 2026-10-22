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
const adminApp = initializeAdminApp({ projectId }, `finance-tests-${nonce}`);
const adminAuth = getAdminAuth(adminApp);
const adminDb = getFirestore(adminApp);
const clientApp = initializeApp({ apiKey: 'emulator-only-key', authDomain: `${projectId}.firebaseapp.com`, projectId, appId: 'emulator-only-app' }, `finance-client-${nonce}`);
const auth = getAuth(clientApp);
const functions = getFunctions(clientApp, 'us-central1');
const emulatorHost = process.env.FIREBASE_EMULATOR_HOST || '127.0.0.1';
connectAuthEmulator(auth, `http://${emulatorHost}:${process.env.COSMAKER_AUTH_EMULATOR_PORT || '19099'}`, { disableWarnings: true });
connectFunctionsEmulator(functions, emulatorHost, Number(process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || 15001));

type Identity = { uid: string; email: string; password: string };
const createdUids: string[] = [];
const atelierIds = [`finance-${nonce}-a`, `finance-${nonce}-b`];
const newId = () => randomUUID();
let ownerA: Identity;
let ownerB: Identity;
let noFinanceAccess: Identity;

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

let reader: Identity;
let customer: Identity;
const date = '2026-10-22';
const root = () => adminDb.doc(`ateliers/${atelierIds[0]}`);
async function seedOrder(id: string, extras: Record<string, unknown> = {}) {
  await root().collection('orders').doc(id).set({ atelierId: atelierIds[0], status: 'confirmed', character: 'Armadura sintética',
    quoteId: 'quote-synthetic', description: 'Armadura', expectedDeliveryDate: '2027-01-10',
    approvedQuoteSnapshot: { total: 1000, depositAmount: 300 }, amountPaid: 300, amountPaidCents: 30_000,
    amountRemaining: 700, amountRemainingCents: 70_000, updatedAt: new Date(), ...extras });
}
function entry(orderId: string | null, extras: Record<string, unknown> = {}, requestId = newId()) {
  return call<{ entryId: string; alreadyApplied: boolean }>('recordFinanceEntry', { requestId, orderId, kind: 'expense', basis: 'actual', category: 'materials',
    amountCents: 1234, description: 'Material sintético', effectiveDate: date, ...extras });
}
function reverse(entryId: string, requestId = newId()) {
  return call<{ entryId: string; alreadyApplied: boolean }>('reverseFinanceEntry', { requestId, entryId, reason: 'Correção de valor declarado', effectiveDate: date });
}
function workspace(orderId?: string, extra: Record<string, unknown> = {}) {
  return call<{ summary: { actualCostsCents: number; plannedCostsCents: number; receivedCents: number; revenueCents: number; byOrder: Array<Record<string, unknown>> }; entries: Array<{ id: string; amountCents: number; reversed: boolean }>; nextCursor: string | null; filteredCount: number }>('listFinanceWorkspace', { ...(orderId ? { orderId } : {}), ...extra });
}
beforeAll(async () => {
  [ownerA, ownerB, noFinanceAccess, reader, customer] = await Promise.all(['owner-finance-a', 'owner-finance-b', 'denied-finance', 'reader-finance', 'client-finance'].map(createIdentity));
  await Promise.all([seedAtelier(atelierIds[0], ownerA), seedAtelier(atelierIds[1], ownerB)]);
  for (const [user, permissions] of [[noFinanceAccess, ['orders:read', 'payments:write']], [reader, ['finance:read']]] as Array<[Identity, string[]]>) {
    await adminDb.doc(`users/${user.uid}`).set({ accountType: 'atelier_member', atelierId: atelierIds[0], active: true });
    await root().collection('members').doc(user.uid).set({ active: true, role: 'assistant', permissions });
  }
  await adminDb.doc(`users/${customer.uid}`).set({ accountType: 'client', active: true });
  await signIn(ownerA);
});
afterAll(async () => {
  for (const id of atelierIds) {
    await adminDb.recursiveDelete(adminDb.doc(`ateliers/${id}`));
    const audits = await adminDb.collection('auditLogs').where('atelierId', '==', id).get();
    await Promise.all(audits.docs.map((doc: { ref: { delete(): Promise<unknown> } }) => doc.ref.delete()));
  }
  for (const uid of createdUids) {
    await adminAuth.deleteUser(uid).catch(() => undefined);
    await adminDb.doc(`users/${uid}`).delete();
  }
  await deleteApp(clientApp); await deleteApp(adminApp);
});

describe('Finance Functions em demo-cosmaker', () => {
  it('registra custos planejados/realizados, receitas e compensações imutáveis com auditoria', async () => {
    await signIn(ownerA); const id = 'cost-order'; await seedOrder(id);
    for (const category of ['materials', 'production', 'labor', 'operational', 'shipping', 'fees', 'other']) await entry(id, { category, amountCents: 1000 });
    await entry(id, { basis: 'planned', amountCents: 9000 });
    const expense = await entry(id, { amountCents: 500 });
    const correctionId = newId();
    expect(await reverse(expense.entryId, correctionId)).toMatchObject({ alreadyApplied: false });
    expect(await reverse(expense.entryId, correctionId)).toMatchObject({ alreadyApplied: true });
    await expect(reverse(expense.entryId)).rejects.toMatchObject({ code: 'functions/already-exists' });
    const data = await workspace(id);
    expect(data.summary).toMatchObject({ actualCostsCents: 7000, plannedCostsCents: 9000, revenueCents: 100_000, receivedCents: 30_000 });
    expect(data.summary.byOrder[0]).toMatchObject({ resultCents: 93_000, marginBasisPoints: 9300 });
    expect(data.entries.find((row) => row.id === expense.entryId)).toMatchObject({ amountCents: 500, reversed: true });
    const original = (await root().collection('financeEntries').doc(expense.entryId).get()).data();
    expect(original).toMatchObject({ amountCents: 500, reversesEntryId: null, actorId: ownerA.uid });
    const audit = await adminDb.collection('auditLogs').where('atelierId', '==', atelierIds[0]).where('entityId', '==', expense.entryId).get();
    expect(audit.size).toBe(1); expect(audit.docs[0].data()).toMatchObject({ action: 'finance.entry_recorded', actorId: ownerA.uid });
    await entry(null, { kind: 'income', amountCents: 1000 });
    await entry(null, { kind: 'income', basis: 'planned', amountCents: 2000 });
    expect((await workspace()).summary).toMatchObject({ revenueCents: 102_000, receivedCents: 31_000 });
  }, 60_000);

  it('serializa recebimentos concorrentes, deduplica retries e compensa sem duplicar saldo', async () => {
    await signIn(ownerA); const id = 'payment-order'; await seedOrder(id);
    const key = newId();
    const payload = { kind: 'payment', amountCents: 40_000, method: 'pix', reference: 'Comprovante manual sintético' };
    const attempts = await Promise.allSettled([entry(id, payload, key), entry(id, payload, key)]);
    expect(attempts.every((result) => result.status === 'fulfilled')).toBe(true);
    const results = attempts.map((result) => (result as PromiseFulfilledResult<{ entryId: string; alreadyApplied: boolean }>).value);
    expect(new Set(results.map((result) => result.entryId)).size).toBe(1);
    expect(results.filter((result) => !result.alreadyApplied)).toHaveLength(1);
    await expect(entry(id, payload)).rejects.toMatchObject({ code: 'functions/already-exists' });
    await expect(entry(id, { ...payload, amountCents: 1 }, key)).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    const competing = await Promise.allSettled([entry(id, { ...payload, reference: 'Segunda parcela', amountCents: 20_000 }), entry(id, { ...payload, reference: 'Terceira parcela', amountCents: 20_000 })]);
    expect(competing.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const corrected = await Promise.allSettled([reverse(results[0].entryId), reverse(results[0].entryId)]);
    expect(corrected.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await workspace(id)).summary.byOrder[0]).toMatchObject({ receivedCents: 50_000, remainingCents: 50_000 });
    expect((await root().collection('orders').doc(id).get()).data()).toMatchObject({ amountPaid: 500, amountPaidCents: 50_000, amountRemaining: 500, amountRemainingCents: 50_000 });
    expect((await root().collection('orders').doc(id).collection('payments').doc(results[0].entryId).get()).data()).toMatchObject({ status: 'refunded', amountCents: 40_000 });
    await entry(id, { ...payload, reference: 'Quitação declarada', amountCents: 50_000 });
    await expect(entry(id, { ...payload, reference: 'Excesso', amountCents: 1 })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    expect((await workspace(id)).summary.byOrder[0]).toMatchObject({ receivedCents: 100_000, remainingCents: 0 });
  }, 60_000);

  it('nega A/B, injeção de tenant, papéis sem permissão, cliente e conta não autenticada', async () => {
    await signIn(ownerA); const own = await entry('cost-order');
    await expect(entry('cost-order', { atelierId: atelierIds[1] })).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    await expect(entry('cost-order', { actorId: ownerB.uid })).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    await signIn(ownerB);
    expect((await workspace()).entries).toEqual([]);
    await expect(entry('cost-order')).rejects.toMatchObject({ code: 'functions/not-found' });
    await expect(workspace('cost-order')).rejects.toMatchObject({ code: 'functions/not-found' });
    await expect(reverse(own.entryId)).rejects.toMatchObject({ code: 'functions/not-found' });
    for (const user of [noFinanceAccess, customer]) {
      await signIn(user);
      await expect(workspace()).rejects.toMatchObject({ code: 'functions/permission-denied' });
      await expect(entry(null)).rejects.toMatchObject({ code: 'functions/permission-denied' });
    }
    await signIn(reader); expect((await workspace('cost-order')).entries.length).toBeGreaterThan(0);
    await expect(entry(null)).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await expect(reverse(own.entryId)).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await signOut(auth); await expect(workspace()).rejects.toMatchObject({ code: 'functions/unauthenticated' });
  }, 60_000);

  it('rejeita valores adulterados, saldos inconsistentes, suspensão, demo e perfis inativos', async () => {
    await signIn(ownerA);
    for (const change of [{ amountCents: -1 }, { amountCents: 1.5 }, { amountCents: Number.MAX_SAFE_INTEGER + 1 }, { effectiveDate: '2026-02-31' }, { description: 'x'.repeat(301) }, { kind: 'income' }, { orderId: '../other' }, { method: 'pix' }]) {
      await expect(entry('cost-order', change)).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    }
    await seedOrder('broken-order', { amountPaidCents: 1 });
    await expect(entry('broken-order', { kind: 'payment', method: 'cash', amountCents: 1 })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await root().collection('orders').doc('broken-order').delete();
    for (const [ref, changed, restored, code] of [
      [root(), { active: false }, { active: true }, 'permission-denied'],
      [root(), { demoWorkspace: true }, { demoWorkspace: false }, 'failed-precondition'],
      [adminDb.doc(`users/${ownerA.uid}`), { active: false }, { active: true }, 'permission-denied'],
      [root().collection('members').doc(ownerA.uid), { active: false }, { active: true }, 'permission-denied'],
      [adminDb.doc(`users/${ownerA.uid}`), { atelierId: atelierIds[1] }, { atelierId: atelierIds[0] }, 'permission-denied'],
    ] as Array<[FirebaseFirestore.DocumentReference, Record<string, unknown>, Record<string, unknown>, string]>) {
      await ref.update(changed);
      try { await expect(entry(null)).rejects.toMatchObject({ code: `functions/${code}` }); } finally { await ref.update(restored); }
    }
    await adminAuth.updateUser(ownerA.uid, { emailVerified: false }); await auth.currentUser?.getIdToken(true);
    try { await expect(entry(null)).rejects.toMatchObject({ code: 'functions/failed-precondition' }); }
    finally { await adminAuth.updateUser(ownerA.uid, { emailVerified: true }); await signIn(ownerA); }
  }, 60_000);

  it('integra a entrada existente ao ledger sem duplicação e permite correção contábil preservando produção', async () => {
    await signIn(ownerA); const id = 'deposit-order'; await seedOrder(id, { status: 'waiting_deposit', amountPaid: 0, amountPaidCents: 0, amountRemaining: 1000, amountRemainingCents: 100_000 });
    await root().collection('orders').doc(id).collection('payments').doc('deposit').set({ type: 'deposit', status: 'pending', amount: 300, createdAt: new Date() });
    const payload = { atelierId: atelierIds[0], orderId: id, method: 'cash', reference: 'Entrada sintética' };
    const attempts = await Promise.all([call('confirmOrderDeposit', payload), call('confirmOrderDeposit', payload)]);
    expect(attempts.filter((result) => (result as { alreadyConfirmed: boolean }).alreadyConfirmed)).toHaveLength(1);
    const data = await workspace(id);
    expect(data.entries).toHaveLength(1); expect(data.summary.byOrder[0]).toMatchObject({ receivedCents: 30_000, remainingCents: 70_000 });
    await reverse(data.entries[0].id);
    const stages = await root().collection('orders').doc(id).collection('productionStages').get();
    expect(stages.size).toBeGreaterThan(0);
    expect((await root().collection('orders').doc(id).get()).data()).toMatchObject({ status: 'confirmed', amountPaidCents: 0, amountRemainingCents: 100_000 });
    await entry(id, { kind: 'payment', method: 'cash', amountCents: 30_000 });
    expect((await workspace(id)).summary.byOrder[0]).toMatchObject({ receivedCents: 30_000 });
  }, 60_000);

  it('concilia recebimento manual legado antes da correção sem duplicar valores nem perder o original', async () => {
    await signIn(ownerA); const id = 'legacy-order'; await seedOrder(id);
    const paymentRef = root().collection('orders').doc(id).collection('payments').doc('deposit');
    await paymentRef.set({ type: 'deposit', amount: 300, status: 'paid', method: 'cash', confirmedBy: ownerA.uid, paidAt: new Date(), createdAt: new Date() });
    const payload = { orderId: id, paymentId: 'deposit', requestId: newId() };
    const result = await call<{ entryId: string }>('reconcileLegacyFinancePayment', payload);
    expect(await call('reconcileLegacyFinancePayment', payload)).toMatchObject({ entryId: result.entryId, alreadyApplied: true });
    expect((await workspace(id)).summary.receivedCents).toBe(30_000);
    await reverse(result.entryId);
    expect((await workspace(id)).summary.receivedCents).toBe(0);
    expect((await paymentRef.get()).data()).toMatchObject({ amount: 300, amountCents: 30_000, confirmedBy: ownerA.uid, status: 'refunded' });
    await signIn(ownerB);
    await expect(call('reconcileLegacyFinancePayment', { ...payload, requestId: newId() })).rejects.toMatchObject({ code: 'functions/not-found' });
    await signIn(ownerA);
    await paymentRef.set({ type: 'deposit', amount: 300, status: 'paid', method: 'cash' });
    await expect(call('reconcileLegacyFinancePayment', { ...payload, requestId: newId() })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
  }, 60_000);

  it('pagina o histórico, aplica datas e mostra compensação mesmo fora da página original', async () => {
    await signIn(ownerA); const id = 'pagination-order'; await seedOrder(id);
    const batch = adminDb.batch();
    for (let index = 0; index < 53; index++) batch.create(root().collection('financeEntries').doc(`page-${nonce}-${String(index).padStart(3, '0')}`), {
      kind: 'expense', basis: 'actual', category: 'labor', amountCents: 100, description: 'Costura sintética', effectiveDate: '2026-10-01', orderId: id,
      paymentId: null, method: null, reference: null, reversesEntryId: null, reason: null, actorId: ownerA.uid, createdAt: new Date(`2026-10-01T10:00:${String(index).padStart(2, '0')}Z`),
    });
    await batch.commit();
    const first = await workspace(id); expect(first.entries).toHaveLength(50); expect(first.nextCursor).toBeTruthy();
    const next = await workspace(id, { cursor: first.nextCursor }); expect(next.entries).toHaveLength(3); expect(next.nextCursor).toBeNull();
    expect(new Set([...first.entries, ...next.entries].map((row) => row.id)).size).toBe(53);
    expect((await workspace(id, { from: '2026-10-02', to: date })).entries).toEqual([]);
    await reverse(next.entries[2].id);
    expect((await workspace(id)).summary.actualCostsCents).toBe(5200);
    expect((await workspace(id, { from: date, to: date })).summary.actualCostsCents).toBe(-100);
    await expect(workspace(id, { from: date, to: '2026-10-01' })).rejects.toMatchObject({ code: 'functions/invalid-argument' });
  }, 60_000);
});
