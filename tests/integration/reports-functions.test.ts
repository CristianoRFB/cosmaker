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
const adminApp = initializeAdminApp({ projectId }, `reports-tests-${nonce}`);
const adminAuth = getAdminAuth(adminApp);
const adminDb = getFirestore(adminApp);
const clientApp = initializeApp({ apiKey: 'emulator-only-key', authDomain: `${projectId}.firebaseapp.com`, projectId, appId: 'emulator-only-app' }, `reports-client-${nonce}`);
const auth = getAuth(clientApp);
const functions = getFunctions(clientApp, 'us-central1');
const emulatorHost = process.env.FIREBASE_EMULATOR_HOST || '127.0.0.1';
connectAuthEmulator(auth, `http://${emulatorHost}:${process.env.COSMAKER_AUTH_EMULATOR_PORT || '19099'}`, { disableWarnings: true });
connectFunctionsEmulator(functions, emulatorHost, Number(process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || 15001));

type Identity = { uid: string; email: string; password: string };
const createdUids: string[] = [];
const atelierIds = [`reports-${nonce}-a`, `reports-${nonce}-b`];
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

let ordersReader: Identity; let financeReader: Identity; let settingsOnly: Identity; let customer: Identity;
const root = () => adminDb.doc(`ateliers/${atelierIds[0]}`);
const preferences = () => call<{ preferences: { timezone: string; defaultReportDays: number; includeCancelledOrders: boolean; version: number }; canEdit: boolean; publicProfile: Record<string, unknown> | null }>('getOperationalPreferences');
const report = (extra: Record<string, unknown> = {}) => call<{ period: { from: string; to: string; timezone: string }; orders: null | { total: number; byStatus: Record<string, number>; production: { averageProgress: number } }; quotes: null | { total: number }; requests: null | { total: number }; finance: null | { revenueCents: number; receivedCents: number; actualCostsCents: number; plannedCostsCents: number }; permissions: Record<string, boolean> }>('getAtelierOperationalReport', { from: '2026-10-21', to: '2026-10-21', ...extra });
async function addMember(user: Identity, permissions: string[]) {
  await adminDb.doc(`users/${user.uid}`).set({ active: true, accountType: 'atelier_member', atelierId: atelierIds[0] });
  await root().collection('members').doc(user.uid).set({ active: true, role: 'assistant', permissions });
}
beforeAll(async () => {
  [ownerA, ownerB, noReportAccess, ordersReader, financeReader, settingsOnly, customer] = await Promise.all(['owner-reports-a', 'owner-reports-b', 'denied-reports', 'orders-reports', 'finance-reports', 'settings-reports', 'client-reports'].map(createIdentity));
  await Promise.all([seedAtelier(atelierIds[0], ownerA), seedAtelier(atelierIds[1], ownerB)]);
  await Promise.all([addMember(noReportAccess, []), addMember(ordersReader, ['orders:read']), addMember(financeReader, ['finance:read']), addMember(settingsOnly, ['atelier:settings'])]);
  await adminDb.doc(`users/${customer.uid}`).set({ active: true, accountType: 'client' });
  await root().update({ timezone: 'UTC' });
  await adminDb.doc(`publicAteliers/${atelierIds[0]}`).set({ slug: `reports-${nonce}`, name: 'Ateliê sintético', tagline: '', brandColor: '#123abc', published: true, quoteRequestsEnabled: true, privateBillingEmail: 'PRIVATE-PROFILE' });
  const order = { quoteId: 'synthetic-q', description: 'Armadura sintética', expectedDeliveryDate: '2027-01-10', approvedQuoteSnapshot: { total: 1000, depositAmount: 300 }, amountPaid: 300, amountPaidCents: 30000, amountRemaining: 700, amountRemainingCents: 70000, status: 'in_production', progress: 50, character: 'Armadura A', clientName: 'PRIVATE-CLIENT', email: 'PRIVATE-EMAIL', createdAt: new Date('2026-10-22T01:30:00Z') };
  await root().collection('orders').doc('order-a').set(order);
  await root().collection('orders').doc('order-b').set({ ...order, character: 'Armadura B', status: 'completed', progress: 100, approvedQuoteSnapshot: { total: 500, depositAmount: 100 }, amountPaid: 500, amountPaidCents: 50000, amountRemaining: 0, amountRemainingCents: 0, createdAt: new Date('2026-10-22T12:00:00Z') });
  const base = { kind: 'expense', basis: 'actual', category: 'labor', orderId: 'order-a', description: 'PRIVATE-LEDGER', effectiveDate: '2026-10-21', createdAt: new Date() };
  await root().collection('financeEntries').doc('actual').set({ ...base, amountCents: 10000 });
  await root().collection('financeEntries').doc('planned').set({ ...base, basis: 'planned', amountCents: 20000 });
  await root().collection('financeEntries').doc('payment').set({ ...base, kind: 'payment', amountCents: 30000 });
  await root().collection('financeEntries').doc('income').set({ ...base, orderId: null, kind: 'income', amountCents: 1000, effectiveDate: '2026-10-22' });
  await root().collection('quotes').doc('quote-a').set({ status: 'sent', createdAt: new Date('2026-10-22T01:30:00Z') });
  await root().collection('quotes').doc('quote-b').set({ status: 'approved', createdAt: new Date('2026-10-22T12:00:00Z') });
  await root().collection('quoteRequests').doc('request-a').set({ status: 'new', createdAt: new Date('2026-10-22T01:30:00Z') });
  await signIn(ownerA);
});
afterAll(async () => {
  for (const id of atelierIds) {
    await adminDb.recursiveDelete(adminDb.doc(`ateliers/${id}`)); await adminDb.recursiveDelete(adminDb.doc(`publicAteliers/${id}`));
    const logs = await adminDb.collection('auditLogs').where('atelierId', '==', id).get(); await Promise.all(logs.docs.map((doc: { ref: { delete(): Promise<unknown> } }) => doc.ref.delete()));
  }
  for (const uid of createdUids) { await adminAuth.deleteUser(uid); await adminDb.doc(`users/${uid}`).delete(); }
  await deleteApp(clientApp); await deleteApp(adminApp);
});

describe('Operational reports and settings in demo-cosmaker', () => {
  it('persiste preferências auditadas e calcula coortes por fuso sem misturar saldos atuais com o período', async () => {
    await signIn(ownerA); const before = await report({ from: '2026-10-22', to: '2026-10-22' }); expect(before.orders?.total).toBe(2); expect(before.period.timezone).toBe('UTC');
    const input = { requestId: newId(), timezone: 'America/Sao_Paulo', defaultReportDays: 7, includeCancelledOrders: true, version: 0 };
    expect(await call('saveOperationalPreferences', input)).toMatchObject({ version: 1, alreadyApplied: false });
    expect(await call('saveOperationalPreferences', input)).toMatchObject({ version: 1, alreadyApplied: true });
    await expect(call('saveOperationalPreferences', { ...input, defaultReportDays: 30 })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    const result = await report(); expect(result.orders).toMatchObject({ total: 1, byStatus: { in_production: 1 }, production: { averageProgress: 50 } });
    expect(result.quotes?.total).toBe(1); expect(result.requests?.total).toBe(1);
    expect(result.finance).toMatchObject({ revenueCents: 150000, receivedCents: 80000, actualCostsCents: 10000, plannedCostsCents: 20000 });
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
    const defaults = await call<{ period: { from: string; to: string } }>('getAtelierOperationalReport');
    expect((Date.parse(defaults.period.to) - Date.parse(defaults.period.from)) / 86400000 + 1).toBe(7);
  }, 60_000);

  it('mascara domínios por permissão e permite manter identidade com settings sem conceder leitura de serviços', async () => {
    await signIn(ordersReader); const orders = await report(); expect(orders.orders?.total).toBe(1); expect(orders.finance).toBeNull(); expect(orders.quotes).toBeNull(); expect(JSON.stringify(orders)).not.toContain('revenueCents');
    await signIn(financeReader); const finance = await report(); expect(finance.orders).toBeNull(); expect(finance.quotes).toBeNull(); expect(finance.finance?.receivedCents).toBe(80000);
    await expect(call('saveOperationalPreferences', { ...(await preferences()).preferences, requestId: newId() })).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await signIn(settingsOnly); const settings = await preferences(); expect(settings.canEdit).toBe(true); expect(settings.publicProfile).toMatchObject({ slug: `reports-${nonce}` }); expect(JSON.stringify(settings)).not.toContain('PRIVATE');
    await call('saveOperationalPreferences', { ...settings.preferences, defaultReportDays: 10, requestId: newId() });
    await expect(report()).rejects.toMatchObject({ code: 'functions/permission-denied' });
    for (const user of [noReportAccess, customer]) { await signIn(user); await expect(report()).rejects.toMatchObject({ code: 'functions/permission-denied' }); }
  }, 60_000);

  it('nega payload adulterado, datas inválidas e concorrência administrativa sem sobrescrever preferências', async () => {
    await signIn(ownerA); const current = (await preferences()).preferences;
    for (const extra of [{ atelierId: atelierIds[1] }, { from: '2026-02-30' }, { from: '2026-10-22', to: '2026-10-21' }, { includeCancelled: 'yes' }]) await expect(report(extra)).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    for (const extra of [{ timezone: null }, { timezone: 'unknown/zone' }, { defaultReportDays: 0 }, { includeCancelledOrders: null }, { version: -1 }, { planId: 'premium' }]) await expect(call('saveOperationalPreferences', { ...current, ...extra, requestId: newId() })).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    const results = await Promise.allSettled([call('saveOperationalPreferences', { ...current, defaultReportDays: 14, requestId: newId() }), call('saveOperationalPreferences', { ...current, defaultReportDays: 20, requestId: newId() })]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await preferences()).preferences.version).toBe(current.version + 1);
    const logs = await adminDb.collection('auditLogs').where('atelierId', '==', atelierIds[0]).where('action', '==', 'settings.operational_saved').get(); expect(logs.size).toBe(3);
    await signIn(ownerB); const other = await report(); expect(other.orders?.total).toBe(0); expect(other.finance?.revenueCents).toBe(0);
  }, 60_000);

  it('nega perfil, membership, tenant e e-mail inativos e falha diante de valores financeiros inconsistentes', async () => {
    await signIn(ownerA); const refs = [adminDb.doc(`users/${ownerA.uid}`), root().collection('members').doc(ownerA.uid), root()];
    for (const ref of refs) { await ref.update({ active: false }); try { await expect(report()).rejects.toMatchObject({ code: 'functions/permission-denied' }); } finally { await ref.update({ active: true }); } }
    await adminAuth.updateUser(ownerA.uid, { emailVerified: false }); await auth.currentUser!.getIdToken(true);
    try { await expect(report()).rejects.toMatchObject({ code: 'functions/failed-precondition' }); } finally { await adminAuth.updateUser(ownerA.uid, { emailVerified: true }); await signIn(ownerA); }
    await root().collection('orders').doc('order-a').update({ amountPaidCents: 1 });
    try { await expect(report()).rejects.toMatchObject({ code: 'functions/failed-precondition' }); await signIn(ordersReader); expect((await report()).finance).toBeNull(); }
    finally { await root().collection('orders').doc('order-a').update({ amountPaidCents: 30000 }); }
    await signOut(auth); await expect(report()).rejects.toMatchObject({ code: 'functions/unauthenticated' });
  }, 60_000);

  it('recusa métricas truncadas quando o volume exige agregação paginada', async () => {
    const batch = adminDb.batch(); for (let index = 0; index < 500; index++) batch.create(adminDb.doc(`ateliers/${atelierIds[1]}/orders/cap-${index}`), { status: 'confirmed' }); await batch.commit();
    await adminDb.doc(`ateliers/${atelierIds[1]}/orders/cap-extra`).set({ status: 'confirmed' });
    await signIn(ownerB); await expect(report()).rejects.toMatchObject({ code: 'functions/resource-exhausted' });
  }, 60_000);
});
