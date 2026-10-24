import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

const requireFunctions = createRequire(new URL('../../functions/package.json', import.meta.url));
const { initializeApp: initializeAdminApp } = requireFunctions('firebase-admin/app');
const { getAuth: getAdminAuth } = requireFunctions('firebase-admin/auth');
const { getFirestore, Timestamp } = requireFunctions('firebase-admin/firestore');
const projectId = 'demo-cosmaker'; const nonce = randomUUID().slice(0, 8);
const admin = initializeAdminApp({ projectId }, `client-payments-admin-${nonce}`);
const db = getFirestore(admin); const adminAuth = getAdminAuth(admin);
const app = initializeApp({ apiKey: 'emulator-only-key', projectId, appId: 'emulator-only-app' }, `client-payments-${nonce}`);
const auth = getAuth(app); const functions = getFunctions(app);
connectAuthEmulator(auth, `http://127.0.0.1:${process.env.COSMAKER_AUTH_EMULATOR_PORT || '19099'}`, { disableWarnings: true });
connectFunctionsEmulator(functions, '127.0.0.1', Number(process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || '15001'));
const tenants = [`payments-${nonce}-a`, `payments-${nonce}-b`];
const password = 'Synthetic!Payment2026';
let customer: { uid: string; email: string }; let other: { uid: string; email: string };
const order = db.doc(`ateliers/${tenants[0]}/orders/order`);
const foreign = db.doc(`ateliers/${tenants[1]}/orders/order`);
const now = Timestamp.now();
const call = <T = Record<string, unknown>>(name = 'listClientOrderPayments', extra: Record<string, unknown> = {}) => httpsCallable<Record<string, unknown>, T>(functions, name)({ atelierId: tenants[0], orderId: 'order', ...extra }).then(result => result.data);
const signIn = async (email: string) => { await signOut(auth); await signInWithEmailAndPassword(auth, email, password); await auth.currentUser!.getIdToken(true); };
beforeAll(async () => {
  [customer, other] = await Promise.all(['customer', 'other'].map(async label => { const email = `${label}-${nonce}@cosmaker.test`; const value = await adminAuth.createUser({ email, password, emailVerified: true }); await db.doc(`users/${value.uid}`).set({ active: true, accountType: 'client' }); return { uid: value.uid, email }; }));
  await Promise.all(tenants.map(id => db.doc(`ateliers/${id}`).set({ active: true })));
  const valid = { clientUserId: customer.uid, email: other.email, clientId: 'crm', quoteId: 'quote', description: 'Projeto fictício', character: 'Armadura sintética', expectedDeliveryDate: '2027-12-31', status: 'in_production', approvedQuoteSnapshot: { total: 100, depositAmount: 30 }, amountPaid: 30, amountPaidCents: 3000, amountRemaining: 70, amountRemainingCents: 7000, createdAt: now };
  await order.set(valid); await foreign.set({ ...valid, clientUserId: other.uid, clientId: null });
  await db.doc(`ateliers/${tenants[0]}/clients/crm`).set({ userId: customer.uid });
  await order.collection('payments').doc('deposit').set({ type: 'deposit', status: 'paid', amount: 30, amountCents: 3000, method: 'cash', reference: 'INTERNAL-REFERENCE', confirmedBy: 'PRIVATE-STAFF-UID', financeEntryId: 'PRIVATE-LEDGER', paidAt: now, createdAt: now });
});
afterAll(async () => { for (const id of tenants) await db.recursiveDelete(db.doc(`ateliers/${id}`)); for (const identity of [customer, other]) { await adminAuth.deleteUser(identity.uid); await db.doc(`users/${identity.uid}`).delete(); } await deleteApp(app); await admin.delete(); });

describe('Client payment projections', () => {
  it('projects real cents and balances, preserves compensated history and paginates without internal data', async () => {
    await signIn(customer.email);
    const page = await call<{ order: { receivedCents: number; remainingCents: number }; payments: Array<Record<string, unknown>>; nextCursor: string | null }>();
    expect(page.order).toMatchObject({ receivedCents: 3000, remainingCents: 7000 });
    expect(page.payments[0]).toMatchObject({ id: 'deposit', amountCents: 3000, status: 'paid', method: 'cash' });
    expect(JSON.stringify(page)).not.toMatch(/INTERNAL|PRIVATE|confirmedBy|financeEntryId|reference/);
    const detail = await call<{ payments: unknown[] }>('getClientPayment', { paymentId: 'deposit' }); expect(detail.payments).toEqual(page.payments);
    await order.collection('payments').doc('deposit').update({ status: 'refunded', reversedAt: now, reversalReason: 'PRIVATE-REASON' });
    await order.update({ amountPaid: 0, amountPaidCents: 0, amountRemaining: 100, amountRemainingCents: 10000 });
    const refunded = await call<{ payments: Array<{ status: string }>; order: { receivedCents: number } }>(); expect(refunded.payments[0].status).toBe('refunded'); expect(refunded.order.receivedCents).toBe(0); expect(JSON.stringify(refunded)).not.toContain('PRIVATE');
    const batch = db.batch(); for (let index = 0; index < 51; index++) batch.set(order.collection('payments').doc(`legacy-${String(index).padStart(2, '0')}`), { type: 'installment', status: 'cancelled', amount: 1 }); await batch.commit();
    const first = await call<{ payments: Array<{ id: string }>; nextCursor: string }>(); expect(first.payments).toHaveLength(50); expect(first.nextCursor).toBeTruthy();
    const second = await call<{ payments: Array<{ id: string }>; nextCursor: null }>('listClientOrderPayments', { cursor: first.nextCursor }); expect(second.payments).toHaveLength(2); expect(second.nextCursor).toBeNull(); expect(new Set([...first.payments, ...second.payments].map(p => p.id)).size).toBe(52);
  }, 60_000);
  it('denies anonymous, reused email, foreign tenant/client, revoked profiles and malformed requests', async () => {
    await signOut(auth); await expect(call()).rejects.toMatchObject({ code: 'functions/unauthenticated' });
    await signIn(other.email); await expect(call()).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await signIn(customer.email); await expect(call('listClientOrderPayments', { atelierId: tenants[1] })).rejects.toMatchObject({ code: 'functions/permission-denied' });
    for (const extra of [{ uid: other.uid }, { orderId: '../order' }, { cursor: '../cursor' }]) await expect(call('listClientOrderPayments', extra)).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    await expect(call('getClientPayment', { paymentId: 'missing' })).rejects.toMatchObject({ code: 'functions/not-found' });
    await db.doc(`ateliers/${tenants[0]}/clients/crm`).update({ userId: other.uid }); await expect(call()).rejects.toMatchObject({ code: 'functions/permission-denied' }); await db.doc(`ateliers/${tenants[0]}/clients/crm`).update({ userId: customer.uid });
    for (const target of [db.doc(`users/${customer.uid}`), db.doc(`ateliers/${tenants[0]}`)]) { await target.update({ active: false }); await expect(call()).rejects.toMatchObject({ code: 'functions/permission-denied' }); await target.update({ active: true }); }
    await adminAuth.updateUser(customer.uid, { disabled: true }); await expect(call()).rejects.toMatchObject({ code: 'functions/unauthenticated' }); await adminAuth.updateUser(customer.uid, { disabled: false });
    await adminAuth.updateUser(customer.uid, { emailVerified: false }); await auth.currentUser!.getIdToken(true); await expect(call()).rejects.toMatchObject({ code: 'functions/failed-precondition' }); await adminAuth.updateUser(customer.uid, { emailVerified: true }); await auth.currentUser!.getIdToken(true);
  }, 60_000);
  it('pages client order history and retains undated/CRM-linked orders without email or malformed-UID bypass', async () => {
    await signIn(customer.email);
    const base = (await order.get()).data();
    const batch = db.batch();
    for (let index = 0; index < 52; index++) batch.set(order.parent.doc(`page-${String(index).padStart(2, '0')}`), { ...base, createdAt: Timestamp.fromMillis(now.toMillis() - index * 1000) });
    batch.set(order.parent.doc('undated'), { ...base, createdAt: null });
    batch.set(order.parent.doc('crm-linked'), { ...base, clientUserId: null, email: 'old-address@cosmaker.test' });
    batch.set(order.parent.doc('malformed-uid'), { ...base, clientUserId: 42 });
    batch.set(order.parent.doc('email-only-forbidden'), { ...base, clientUserId: null, clientId: null, email: customer.email });
    batch.set(db.doc(`ateliers/${tenants[0]}/clients/foreign-email`), { email: customer.email, userId: other.uid });
    await batch.commit();
    const list = (data: Record<string, unknown> = {}) => httpsCallable<Record<string, unknown>, { orders: Array<{ id: string }>; nextCursor: string | null }>(functions, 'listClientOrders')(data).then(result => result.data);
    const first = await list(); expect(first.orders).toHaveLength(50); expect(first.nextCursor).toBeTruthy();
    const second = await list({ cursor: first.nextCursor }); const ids = [...first.orders, ...second.orders].map(value => value.id);
    expect(new Set(ids).size).toBe(55); expect(second.nextCursor).toBeNull();
    expect(ids).toContain('undated'); expect(ids).toContain('crm-linked'); expect(ids).not.toContain('malformed-uid'); expect(ids).not.toContain('email-only-forbidden');
    await expect(list({ cursor: 'not-a-cursor' })).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    await expect(list({ cursor: Buffer.from(`ateliers/${tenants[1]}/orders/order`).toString('base64url') })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
  }, 60_000);

  it('rejects inconsistent money and never invents a zero balance on corrupt legacy data', async () => {
    await signIn(customer.email);
    await order.update({ amountPaidCents: 1 }); await expect(call()).rejects.toMatchObject({ code: 'functions/failed-precondition' }); await order.update({ amountPaidCents: 0 });
    await order.collection('payments').doc('deposit').update({ amountCents: 1 }); await expect(call()).rejects.toMatchObject({ code: 'functions/failed-precondition' });
  }, 60_000);
});
