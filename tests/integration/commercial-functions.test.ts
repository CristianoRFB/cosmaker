import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
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
const adminApp = initializeAdminApp({ projectId }, `commercial-tests-${nonce}`);
const adminAuth = getAdminAuth(adminApp);
const adminDb = getFirestore(adminApp);
const clientApp = initializeApp({
  apiKey: 'emulator-only-key',
  authDomain: `${projectId}.firebaseapp.com`,
  projectId,
  appId: 'emulator-only-app',
}, `commercial-client-${nonce}`);
const auth = getAuth(clientApp);
const functions = getFunctions(clientApp, 'us-central1');
const emulatorHost = process.env.FIREBASE_EMULATOR_HOST || '127.0.0.1';
connectAuthEmulator(auth, `http://${emulatorHost}:${process.env.COSMAKER_AUTH_EMULATOR_PORT || '19099'}`, { disableWarnings: true });
connectFunctionsEmulator(functions, emulatorHost, Number(process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || 15001));

const createdUids: string[] = [];
const createdAteliers: string[] = [];
let adminCredentials = { email: '', password: '', uid: '' };
let ownerCredentials = { email: '', password: '' };
let secondOwnerCredentials = { email: '', password: '' };

async function createIdentity(label: string, platformAdmin = false) {
  const email = `${label}-${nonce}@cosmaker.test`;
  const password = `Local!${randomUUID().slice(0, 14)}aA1`;
  const user = await adminAuth.createUser({ email, password, displayName: label, emailVerified: true });
  createdUids.push(user.uid);
  if (platformAdmin) {
    await adminAuth.setCustomUserClaims(user.uid, { platformAdmin: true });
    await adminDb.doc(`users/${user.uid}`).set({ id: user.uid, email, name: label, accountType: 'platform_admin', active: true });
  }
  return { email, password, uid: user.uid };
}

async function createTenant(options: {
  label: string;
  status?: 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'demo';
  planId?: 'essencial' | 'pro' | 'premium';
  trialUntil?: string | null;
  entitlement?: boolean;
  limit?: number | null | 'absent';
  demoWorkspace?: boolean;
  configured?: boolean;
}) {
  const owner = await createIdentity(`owner-${options.label}`);
  const atelierId = `it-${nonce}-${options.label}`;
  createdAteliers.push(atelierId);
  const state: Record<string, unknown> = {
    planId: options.planId ?? (options.status === 'trial' || options.status === 'demo' ? 'premium' : 'essencial'),
    subscriptionStatus: options.status ?? 'active',
    trialUntil: options.trialUntil ?? null,
    entitlementOverrides: { 'test_only.operation_probe': options.entitlement ?? true },
    limitOverrides: options.limit === 'absent' ? {} : { 'test_only.operation_count': options.limit ?? null },
  };
  await Promise.all([
    adminDb.doc(`users/${owner.uid}`).set({ id: owner.uid, email: owner.email, name: owner.email, accountType: 'atelier_member', atelierId, role: 'owner', permissions: [], active: true }),
    adminDb.doc(`ateliers/${atelierId}`).set({ id: atelierId, name: `Synthetic ${options.label}`, ownerId: owner.uid, active: true, ...(options.demoWorkspace ? { demoWorkspace: true } : {}) }),
    adminDb.doc(`ateliers/${atelierId}/members/${owner.uid}`).set({ userId: owner.uid, role: 'owner', permissions: [], active: true }),
    adminDb.doc(`ateliers/${atelierId}/commercial/state`).set(state),
    adminDb.doc(`ateliers/${atelierId}/commercial/config`).set({ featureConfig: options.configured === false ? {} : { 'test_only.operation_probe': true } }),
  ]);
  return { atelierId, owner };
}

async function signIn(credentials: { email: string; password: string }) {
  await signOut(auth).catch(() => undefined);
  await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
  await auth.currentUser?.getIdToken(true);
}

function call<T>(name: string, data: Record<string, unknown> = {}) {
  return httpsCallable<Record<string, unknown>, T>(functions, name)(data).then((result) => result.data);
}

beforeAll(async () => {
  adminCredentials = await createIdentity(`platform-${nonce}`, true);
  const first = await createTenant({ label: 'tenant-a', limit: 1, planId: 'essencial' });
  const second = await createTenant({ label: 'tenant-b', limit: null, planId: 'pro' });
  ownerCredentials = first.owner;
  secondOwnerCredentials = second.owner;
}, 60000);

afterAll(async () => {
  await signOut(auth).catch(() => undefined);
  await Promise.all(createdAteliers.map((id) => adminDb.recursiveDelete(adminDb.doc(`ateliers/${id}`)).catch(() => undefined)));
  await Promise.all(createdUids.map((uid) => adminDb.doc(`users/${uid}`).delete().catch(() => undefined)));
  await Promise.all(createdUids.map((uid) => adminAuth.deleteUser(uid).catch(() => undefined)));
  await deleteApp(clientApp).catch(() => undefined);
  await adminApp.delete().catch(() => undefined);
});

describe('Commercial Functions em Firebase Emulator', () => {
  it('autoriza somente Platform Owner, grava auditoria e rejeita tenantId enviado pelo browser', async () => {
    const tenantA = `it-${nonce}-tenant-a`;
    const before = (await adminDb.doc(`ateliers/${tenantA}/commercial/state`).get()).data();
    await Promise.all([
      adminDb.doc(`ateliers/${tenantA}/clients/synthetic-client`).set({ id: 'synthetic-client', name: 'Dado sintético' }),
      adminDb.doc(`ateliers/${tenantA}/orders/synthetic-order`).set({ id: 'synthetic-order', status: 'in_progress' }),
    ]);
    await signIn(ownerCredentials);
    await expect(call('updatePlatformTenantCommercialState', {
      operation: 'assign_plan', atelierId: tenantA, planId: 'pro', subscriptionStatus: 'active', reason: 'Atribuição autorizada para teste.',
    })).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await expect(call('runTestOnlyCommercialOperation', { atelierId: 'it-forged' })).rejects.toMatchObject({ code: 'functions/invalid-argument' });

    await signIn(adminCredentials);
    const auditStartedAt = Date.now();
    const changed = await call<{ state: Record<string, unknown> }>('updatePlatformTenantCommercialState', {
      operation: 'assign_plan', atelierId: tenantA, planId: 'pro', subscriptionStatus: 'active', reason: 'Atribuição de plano para validar auditoria.',
    });
    expect(changed.state.planId).toBe('pro');
    expect((await adminDb.doc(`ateliers/${tenantA}/clients/synthetic-client`).get()).exists).toBe(true);
    expect((await adminDb.doc(`ateliers/${tenantA}/orders/synthetic-order`).get()).data()?.status).toBe('in_progress');
    const blocked = await call<{ state: Record<string, unknown> }>('updatePlatformTenantCommercialState', {
      operation: 'set_entitlement_override', atelierId: tenantA, featureKey: 'test_only.operation_probe', enabled: false, reason: 'Bloqueio sintético para teste de auditoria.',
    });
    const limited = await call<{ state: Record<string, unknown> }>('updatePlatformTenantCommercialState', {
      operation: 'set_limit_override', atelierId: tenantA, limitKey: 'test_only.operation_count', limit: 0, reason: 'Limite zero sintético para teste de auditoria.',
    });
    const audit = await adminDb.collection('auditLogs').where('atelierId', '==', tenantA).get();
    const entries = audit.docs.map((document: { data: () => Record<string, unknown> }) => document.data());
    expect(entries).toHaveLength(3);
    const expectedChanges = [
      { action: 'platform.commercial.plan_assigned', reason: 'Atribuição de plano para validar auditoria.', before, after: changed.state },
      { action: 'platform.commercial.entitlement_override_set', reason: 'Bloqueio sintético para teste de auditoria.', before: changed.state, after: blocked.state },
      { action: 'platform.commercial.limit_override_set', reason: 'Limite zero sintético para teste de auditoria.', before: blocked.state, after: limited.state },
    ];
    for (const expected of expectedChanges) {
      const entry = entries.find((item: Record<string, unknown>) => item.action === expected.action);
      expect(entry).toMatchObject({ ...expected, actorId: adminCredentials.uid, atelierId: tenantA, entity: 'tenant_commercial_state', entityId: tenantA });
      const timestamp = entry?.timestamp as { toMillis(): number };
      expect(timestamp.toMillis()).toBeGreaterThanOrEqual(auditStartedAt);
      expect(timestamp.toMillis()).toBeLessThanOrEqual(Date.now());
    }
    expect((await adminDb.doc(`ateliers/${tenantA}/commercial/state`).get()).data()).toEqual(limited.state);
    await call('updatePlatformTenantCommercialState', {
      operation: 'set_entitlement_override', atelierId: tenantA, featureKey: 'test_only.operation_probe', enabled: true, reason: 'Liberação sintética para teste de concorrência.',
    });
    await call('updatePlatformTenantCommercialState', {
      operation: 'set_limit_override', atelierId: tenantA, limitKey: 'test_only.operation_count', limit: 1, reason: 'Limite sintético para concorrência.',
    });
  }, 60000);

  it('recusa staff, customer, perfil global sem claim, perfil inativo e email não verificado', async () => {
    const tenantA = `it-${nonce}-tenant-a`;
    const staff = await createIdentity('staff-denied');
    const customer = await createIdentity('customer-denied');
    const noClaim = await createIdentity('platform-without-claim');
    const inactive = await createIdentity('inactive-platform', true);
    const unverified = await createIdentity('unverified-platform', true);
    await Promise.all([
      adminDb.doc(`users/${staff.uid}`).set({ id: staff.uid, email: staff.email, accountType: 'atelier_member', atelierId: tenantA, role: 'assistant', permissions: [], active: true }),
      adminDb.doc(`ateliers/${tenantA}/members/${staff.uid}`).set({ userId: staff.uid, role: 'assistant', permissions: [], active: true }),
      adminDb.doc(`users/${customer.uid}`).set({ id: customer.uid, email: customer.email, accountType: 'client', role: 'client', permissions: [], active: true }),
      adminDb.doc(`users/${noClaim.uid}`).set({ id: noClaim.uid, email: noClaim.email, accountType: 'platform_admin', active: true }),
      adminDb.doc(`users/${inactive.uid}`).update({ active: false }),
      adminAuth.updateUser(unverified.uid, { emailVerified: false }),
    ]);
    const stateBefore = (await adminDb.doc(`ateliers/${tenantA}/commercial/state`).get()).data();
    const auditBefore = (await adminDb.collection('auditLogs').where('atelierId', '==', tenantA).get()).size;
    for (const identity of [staff, customer, noClaim, inactive, unverified]) {
      await signIn(identity);
      for (const operation of [
        { operation: 'assign_plan', planId: 'premium', subscriptionStatus: 'active' },
        { operation: 'set_status', subscriptionStatus: 'cancelled' },
        { operation: 'start_trial' },
        { operation: 'set_entitlement_override', featureKey: 'test_only.operation_probe', enabled: true },
        { operation: 'set_limit_override', limitKey: 'test_only.operation_count', limit: null },
      ]) {
        await expect(call('updatePlatformTenantCommercialState', { ...operation, atelierId: tenantA, reason: 'Tentativa não autorizada na fixture.' })).rejects.toMatchObject({ code: 'functions/permission-denied' });
      }
      await expect(call('createPlatformDemoTenant', { displayName: 'Demonstração não autorizada', reason: 'Tentativa não autorizada na fixture.' })).rejects.toMatchObject({ code: 'functions/permission-denied' });
      await expect(call('endPlatformDemoTenant', { atelierId: tenantA, reason: 'Tentativa não autorizada na fixture.' })).rejects.toMatchObject({ code: 'functions/permission-denied' });
    }
    await signOut(auth);
    await expect(call('updatePlatformTenantCommercialState', { operation: 'set_status', atelierId: tenantA, subscriptionStatus: 'cancelled', reason: 'Tentativa sem sessão autenticada.' })).rejects.toMatchObject({ code: 'functions/unauthenticated' });
    expect((await adminDb.doc(`ateliers/${tenantA}/commercial/state`).get()).data()).toEqual(stateBefore);
    expect((await adminDb.collection('auditLogs').where('atelierId', '==', tenantA).get()).size).toBe(auditBefore);
  }, 120000);

  it('enforces a positive limit atomically under concurrency and keeps Tenant A/B counters isolated', async () => {
    await signIn(ownerCredentials);
    const feature = await call<{ available: boolean }>('getTenantFeatureAccess', { featureKey: 'test_only.operation_probe' });
    expect(feature.available).toBe(true);
    const outcomes = await Promise.allSettled([
      call('runTestOnlyCommercialOperation'), call('runTestOnlyCommercialOperation'), call('runTestOnlyCommercialOperation'),
    ]);
    expect(outcomes.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((item) => item.status === 'rejected').every((item) => (item as PromiseRejectedResult).reason.code === 'functions/resource-exhausted')).toBe(true);

    await signIn(secondOwnerCredentials);
    const response = await call<{ used: number; limit: number | null }>('runTestOnlyCommercialOperation');
    expect(response).toMatchObject({ used: 1, limit: null });
    const countA = (await adminDb.doc(`ateliers/it-${nonce}-tenant-a/commercialUsage/test-only-operation-probe`).get()).data()?.count;
    const countB = (await adminDb.doc(`ateliers/it-${nonce}-tenant-b/commercialUsage/test-only-operation-probe`).get()).data()?.count;
    expect(countA).toBe(1);
    expect(countB).toBe(1);
  }, 60000);

  it('preserva dados e criações existentes no downgrade acima do limite e restaura capacidade no upgrade', async () => {
    const fixture = await createTenant({ label: 'downgrade-upgrade', planId: 'premium', limit: null });
    const sentinelPaths = [
      `ateliers/${fixture.atelierId}/clients/preserved-client`,
      `ateliers/${fixture.atelierId}/quotes/preserved-quote`,
      `ateliers/${fixture.atelierId}/quotes/preserved-quote/approvedItems/preserved-item`,
      `ateliers/${fixture.atelierId}/orders/preserved-order`,
      `ateliers/${fixture.atelierId}/orders/preserved-order/photos/preserved-photo`,
      `ateliers/${fixture.atelierId}/orders/preserved-order/measurementSnapshot/preserved-measurement`,
      `ateliers/${fixture.atelierId}/orders/preserved-order/statusHistory/preserved-history`,
    ];
    await Promise.all(sentinelPaths.map((path, index) => adminDb.doc(path).set({ synthetic: true, preserved: `sentinel-${index}` })));
    const businessBefore = await Promise.all(sentinelPaths.map(async (path) => (await adminDb.doc(path).get()).data()));
    await signIn(fixture.owner);
    for (let index = 0; index < 3; index += 1) await call('runTestOnlyCommercialOperation');
    const operationsBefore = await adminDb.collection(`ateliers/${fixture.atelierId}/commercialOperations`).get();
    expect(operationsBefore.size).toBe(3);

    await signIn(adminCredentials);
    await call('updatePlatformTenantCommercialState', { operation: 'assign_plan', atelierId: fixture.atelierId, planId: 'essencial', subscriptionStatus: 'active', reason: 'Downgrade sintético sem apagar histórico.' });
    await call('updatePlatformTenantCommercialState', { operation: 'set_limit_override', atelierId: fixture.atelierId, limitKey: 'test_only.operation_count', limit: 2, reason: 'Cota sintética inferior ao uso existente.' });
    await signIn(fixture.owner);
    expect(await call('getTenantCommercialContext')).toMatchObject({ state: { planId: 'essencial', subscriptionStatus: 'active' } });
    await expect(call('runTestOnlyCommercialOperation')).rejects.toMatchObject({ code: 'functions/resource-exhausted' });
    expect(await Promise.all(sentinelPaths.map(async (path) => (await adminDb.doc(path).get()).data()))).toEqual(businessBefore);
    expect((await adminDb.collection(`ateliers/${fixture.atelierId}/commercialOperations`).get()).docs.map((item: { id: string }) => item.id).sort()).toEqual(operationsBefore.docs.map((item: { id: string }) => item.id).sort());
    expect((await adminDb.doc(`ateliers/${fixture.atelierId}/commercialUsage/test-only-operation-probe`).get()).data()?.count).toBe(3);

    await signIn(adminCredentials);
    await call('updatePlatformTenantCommercialState', { operation: 'assign_plan', atelierId: fixture.atelierId, planId: 'premium', subscriptionStatus: 'active', reason: 'Upgrade sintético para restaurar capacidade.' });
    await call('updatePlatformTenantCommercialState', { operation: 'set_limit_override', atelierId: fixture.atelierId, limitKey: 'test_only.operation_count', limit: 4, reason: 'Capacidade sintética adicional autorizada.' });
    await signIn(fixture.owner);
    expect(await call('runTestOnlyCommercialOperation')).toMatchObject({ accepted: true, used: 4, limit: 4 });
    expect(await Promise.all(sentinelPaths.map(async (path) => (await adminDb.doc(path).get()).data()))).toEqual(businessBefore);
    expect((await adminDb.doc(`ateliers/${fixture.atelierId}`).get()).data()?.active).toBe(true);
  }, 60000);

  it('exige ateliê, perfil e membership ativos além da autorização comercial', async () => {
    const suspended = await createTenant({ label: 'operational-suspended', planId: 'premium', limit: null });
    const inactiveMember = await createTenant({ label: 'inactive-membership', planId: 'premium', limit: null });
    const missingMember = await createTenant({ label: 'missing-membership', planId: 'premium', limit: null });
    const inactiveProfile = await createTenant({ label: 'inactive-profile', planId: 'premium', limit: null });
    const restrictedStaff = await createTenant({ label: 'staff-without-permission', planId: 'premium', limit: null });
    await Promise.all([
      adminDb.doc(`ateliers/${suspended.atelierId}`).update({ active: false }),
      adminDb.doc(`ateliers/${inactiveMember.atelierId}/members/${inactiveMember.owner.uid}`).update({ active: false }),
      adminDb.doc(`ateliers/${missingMember.atelierId}/members/${missingMember.owner.uid}`).delete(),
      adminDb.doc(`users/${inactiveProfile.owner.uid}`).update({ active: false }),
      adminDb.doc(`ateliers/${restrictedStaff.atelierId}/members/${restrictedStaff.owner.uid}`).update({ role: 'assistant', permissions: [] }),
    ]);
    await signIn(adminCredentials);
    await call('updatePlatformTenantCommercialState', { operation: 'assign_plan', atelierId: suspended.atelierId, planId: 'premium', subscriptionStatus: 'active', reason: 'Plano não deve reativar suspensão operacional.' });
    expect((await adminDb.doc(`ateliers/${suspended.atelierId}`).get()).data()?.active).toBe(false);
    for (const fixture of [suspended, inactiveMember, missingMember, inactiveProfile, restrictedStaff]) {
      await signIn(fixture.owner);
      await expect(call('getTenantFeatureAccess', { featureKey: 'test_only.operation_probe' })).rejects.toMatchObject({ code: 'functions/permission-denied' });
      await expect(call('runTestOnlyCommercialOperation')).rejects.toMatchObject({ code: 'functions/permission-denied' });
      expect((await adminDb.doc(`ateliers/${fixture.atelierId}/commercialUsage/test-only-operation-probe`).get()).exists).toBe(false);
    }
    await signIn(secondOwnerCredentials);
    await expect(call('updatePlatformTenantCommercialState', { operation: 'set_status', atelierId: suspended.atelierId, subscriptionStatus: 'active', reason: 'Tentativa de outro ateliê sem autorização global.' })).rejects.toMatchObject({ code: 'functions/permission-denied' });
    for (const forged of [
      { atelierId: suspended.atelierId }, { tenantSlug: 'forged-slug' }, { planId: 'premium' }, { role: 'owner' }, { entitlementOverrides: { 'test_only.operation_probe': true } },
    ]) await expect(call('runTestOnlyCommercialOperation', forged)).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    await expect(call('getTenantFeatureAccess', { featureKey: 'test_only.operation_probe', atelierId: suspended.atelierId })).rejects.toMatchObject({ code: 'functions/invalid-argument' });
  }, 60000);

  it('distinguishes zero, explicit null, absent policies, disabled flags and unknown features', async () => {
    const zero = await createTenant({ label: 'zero', limit: 0 });
    const absent = await createTenant({ label: 'absent', limit: 'absent' });
    const disabled = await createTenant({ label: 'disabled', limit: null, entitlement: false });
    const unconfigured = await createTenant({ label: 'unconfigured', limit: null, configured: false });

    await signIn(zero.owner);
    await expect(call('runTestOnlyCommercialOperation')).rejects.toMatchObject({ code: 'functions/resource-exhausted' });
    await signIn(absent.owner);
    await expect(call('runTestOnlyCommercialOperation')).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await signIn(disabled.owner);
    await expect(call('runTestOnlyCommercialOperation')).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await signIn(unconfigured.owner);
    const feature = await call<{ available: boolean; reason: string }>('getTenantFeatureAccess', { featureKey: 'test_only.operation_probe' });
    expect(feature).toMatchObject({ available: false, reason: 'not_configured' });
    await expect(call('runTestOnlyCommercialOperation')).rejects.toMatchObject({ code: 'functions/permission-denied' });
    const unknown = await call<{ reason: string }>('getTenantFeatureAccess', { featureKey: 'test_only.not_registered' });
    expect(unknown.reason).toBe('unknown_feature');
  }, 60000);

  it('applies all commercial statuses and the exact trial deadline on the backend', async () => {
    const expiredTrial = await createTenant({ label: 'expired-trial', status: 'trial', trialUntil: new Date(Date.now() - 1000).toISOString() });
    const activeDemo = await createTenant({ label: 'active-demo', status: 'demo', demoWorkspace: true });
    const restricted = await Promise.all([
      createTenant({ label: 'past-due', status: 'past_due' }),
      createTenant({ label: 'commercial-suspended', status: 'suspended' }),
      createTenant({ label: 'cancelled', status: 'cancelled' }),
    ]);
    await signIn(expiredTrial.owner);
    expect(await call<{ allowed: boolean; reason: string }>('getTenantFeatureAccess', { featureKey: 'test_only.operation_probe' })).toMatchObject({ allowed: false, reason: 'expired' });
    await expect(call('runTestOnlyCommercialOperation')).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await signIn(activeDemo.owner);
    expect((await call<{ accepted: boolean }>('runTestOnlyCommercialOperation')).accepted).toBe(true);
    for (const tenant of restricted) {
      await signIn(tenant.owner);
      expect((await call<{ allowed: boolean }>('getTenantFeatureAccess', { featureKey: 'test_only.operation_probe' })).allowed).toBe(false);
      await expect(call('runTestOnlyCommercialOperation')).rejects.toMatchObject({ code: 'functions/permission-denied' });
    }
  }, 60000);

  it('inicia trial uma única vez e encerra demo sem suspender ou apagar o tenant', async () => {
    const pending = await createTenant({ label: 'trial-grant', status: 'active' });
    await adminDb.doc(`ateliers/${pending.atelierId}/commercial/state`).delete();
    await signIn(adminCredentials);
    const beforeGrant = Date.now();
    const trial = await call<{ state: { subscriptionStatus: string; trialUntil: string } }>('updatePlatformTenantCommercialState', {
      operation: 'start_trial', atelierId: pending.atelierId, reason: 'Trial concedido manualmente para teste.',
    });
    const afterGrant = Date.now();
    expect(trial.state.subscriptionStatus).toBe('trial');
    const trialDurationMs = 14 * 24 * 60 * 60 * 1000;
    expect(trial.state.trialUntil).toMatch(/Z$/);
    expect(Date.parse(trial.state.trialUntil)).toBeGreaterThanOrEqual(beforeGrant + trialDurationMs);
    expect(Date.parse(trial.state.trialUntil)).toBeLessThanOrEqual(afterGrant + trialDurationMs);
    await expect(call('updatePlatformTenantCommercialState', {
      operation: 'start_trial', atelierId: pending.atelierId, reason: 'Tentativa de conceder novamente.',
    })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await call('updatePlatformTenantCommercialState', { operation: 'set_status', atelierId: pending.atelierId, subscriptionStatus: 'active', reason: 'Saída autorizada do trial sintético.' });
    await call('updatePlatformTenantCommercialState', { operation: 'assign_plan', atelierId: pending.atelierId, planId: 'essencial', subscriptionStatus: 'active', reason: 'Atribuição posterior ao trial sintético.' });
    expect((await adminDb.doc(`ateliers/${pending.atelierId}/commercial/state`).get()).data()?.trialUntil).toBe(trial.state.trialUntil);
    await expect(call('updatePlatformTenantCommercialState', {
      operation: 'start_trial', atelierId: pending.atelierId, reason: 'Tentativa de reiniciar após sair do trial.',
    })).rejects.toMatchObject({ code: 'functions/failed-precondition' });

    const demo = await call<{ atelierId: string; slug: string; demoEmail: string; oneTimePassword: string }>('createPlatformDemoTenant', {
      displayName: `Demo ${nonce}`, reason: 'Criação sintética para validar o ciclo demo.',
    });
    createdAteliers.push(demo.atelierId);
    expect(demo.demoEmail).toContain('@example.invalid');
    expect(demo.oneTimePassword.length).toBeGreaterThan(20);
    const demoAtelierRef = adminDb.doc(`ateliers/${demo.atelierId}`);
    const demoAtelier = await demoAtelierRef.get();
    const demoOwnerId = demoAtelier.data()?.ownerId as string;
    createdUids.push(demoOwnerId);
    const publicTenant = await call<{ status: string; tenant?: { quoteRequestsEnabled: boolean } }>('resolvePublicTenant', { tenantSlug: demo.slug });
    expect(publicTenant).toMatchObject({ status: 'available', tenant: { quoteRequestsEnabled: false } });
    await expect(call('createPublicQuoteRequest', {
      tenantSlug: demo.slug, references: [], input: {
        name: 'Pessoa sintética', email: 'sintetica@example.invalid', character: 'Personagem', franchise: 'Obra', category: 'full_cosplay',
        description: 'Solicitação sintética bloqueada no intake da demonstração.', desiredDeliveryDate: '2027-12-01', urgency: 'normal',
      },
    })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await signIn({ email: demo.demoEmail, password: demo.oneTimePassword });
    await expect(call('confirmOrderDeposit', { atelierId: demo.atelierId, orderId: 'demo-order', method: 'pix', reference: 'TEST_ONLY' })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await expect(call('createProductionPhotoUpload', {
      atelierId: demo.atelierId, orderId: 'demo-order', stageId: 'modeling', originalName: 'synthetic.png', contentType: 'image/png', caption: '', visibleToClient: true,
    })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    expect((await adminDb.doc(`ateliers/${demo.atelierId}/commercialUsage/test-only-operation-probe`).get()).exists).toBe(false);
    expect((await adminDb.collection(`ateliers/${demo.atelierId}/orders/demo-order/photos`).get()).size).toBe(0);
    await signIn(adminCredentials);
    await call('endPlatformDemoTenant', { atelierId: demo.atelierId, reason: 'Encerramento sintético da demonstração.' });
    const [endedAtelier, endedState, endedPublic, ownerProfile, preservedOrder, ownerAuth] = await Promise.all([
      demoAtelierRef.get(),
      adminDb.doc(`ateliers/${demo.atelierId}/commercial/state`).get(),
      adminDb.doc(`publicAteliers/${demo.atelierId}`).get(),
      adminDb.doc(`users/${demoOwnerId}`).get(),
      adminDb.doc(`ateliers/${demo.atelierId}/orders/demo-order`).get(),
      adminAuth.getUser(demoOwnerId),
    ]);
    expect(endedAtelier.data()?.active).toBe(true);
    expect(endedState.data()?.subscriptionStatus).toBe('cancelled');
    expect(endedPublic.data()?.published).toBe(false);
    expect(ownerProfile.data()?.active).toBe(false);
    expect(ownerAuth.disabled).toBe(true);
    expect(preservedOrder.exists).toBe(true);
  }, 60000);

  it('nega feature não implementada mesmo com entitlement/config e recusa TEST_ONLY fora do Emulator', async () => {
    const fixture = await createTenant({ label: 'implementation-enforcement', planId: 'premium', limit: null });
    const compiledCatalog = requireFromFunctions('./lib/commercial/catalog.js') as {
      TEST_ONLY_FEATURES: Array<{ implemented: boolean }>;
    };
    const handlers = requireFromFunctions('./lib/commercial/tenant-context.js') as {
      getTenantFeatureAccess: { run(request: unknown): Promise<unknown> };
      runTestOnlyCommercialOperation: { run(request: unknown): Promise<unknown> };
    };
    const feature = compiledCatalog.TEST_ONLY_FEATURES[0];
    const originalImplemented = feature.implemented;
    const originalEmulatorFlag = process.env.FUNCTIONS_EMULATOR;
    try {
      process.env.FUNCTIONS_EMULATOR = 'true';
      feature.implemented = false;
      const authContext = { uid: fixture.owner.uid, token: { email_verified: true } };
      expect(await handlers.getTenantFeatureAccess.run({ auth: authContext, data: { featureKey: 'test_only.operation_probe' } })).toMatchObject({ allowed: false, available: false, implemented: false, configured: true, reason: 'not_implemented' });
      await expect(handlers.runTestOnlyCommercialOperation.run({ auth: authContext, data: {} })).rejects.toMatchObject({ code: 'permission-denied' });
      expect((await adminDb.doc(`ateliers/${fixture.atelierId}/commercialUsage/test-only-operation-probe`).get()).exists).toBe(false);

      feature.implemented = true;
      delete process.env.FUNCTIONS_EMULATOR;
      await expect(handlers.runTestOnlyCommercialOperation.run({ auth: authContext, data: {} })).rejects.toMatchObject({ code: 'unavailable' });
      process.env.FUNCTIONS_EMULATOR = 'false';
      await expect(handlers.runTestOnlyCommercialOperation.run({ auth: authContext, data: {} })).rejects.toMatchObject({ code: 'unavailable' });
    } finally {
      feature.implemented = originalImplemented;
      if (originalEmulatorFlag === undefined) delete process.env.FUNCTIONS_EMULATOR;
      else process.env.FUNCTIONS_EMULATOR = originalEmulatorFlag;
    }
    expect((await adminDb.doc(`ateliers/${fixture.atelierId}/commercialUsage/test-only-operation-probe`).get()).exists).toBe(false);
  }, 60000);

  it('mantém migração dry-run sem escrita, converte apenas campos explícitos e é idempotente', async () => {
    const exactId = `it-${nonce}-legacy-exact`;
    const ambiguousId = `it-${nonce}-legacy-ambiguous`;
    const invalidTrialId = `it-${nonce}-legacy-trial`;
    const dateOnlyTrialId = `it-${nonce}-legacy-date-only-trial`;
    const nonPremiumTrialId = `it-${nonce}-legacy-non-premium-trial`;
    const validTrialId = `it-${nonce}-legacy-utc-trial`;
    const unmarkedDemoId = `it-${nonce}-legacy-unmarked-demo`;
    const invalidDemoDateId = `it-${nonce}-legacy-invalid-demo-date`;
    const nonPremiumDemoId = `it-${nonce}-legacy-non-premium-demo`;
    const validDemoId = `it-${nonce}-legacy-utc-demo`;
    createdAteliers.push(exactId, ambiguousId, invalidTrialId, dateOnlyTrialId, nonPremiumTrialId, validTrialId, unmarkedDemoId, invalidDemoDateId, nonPremiumDemoId, validDemoId);
    await Promise.all([
      adminDb.doc(`ateliers/${exactId}`).set({ name: 'Nome sintético privado', plan: 'pro', subscriptionStatus: 'active' }),
      adminDb.doc(`ateliers/${ambiguousId}`).set({ name: 'Nome ambíguo privado', plan: 'essencial', status: 'active' }),
      adminDb.doc(`ateliers/${invalidTrialId}`).set({ name: 'Trial sem prazo', plan: 'premium', subscriptionStatus: 'trial' }),
      adminDb.doc(`ateliers/${dateOnlyTrialId}`).set({ plan: 'premium', subscriptionStatus: 'trial', trialUntil: '2027-12-01' }),
      adminDb.doc(`ateliers/${nonPremiumTrialId}`).set({ plan: 'pro', subscriptionStatus: 'trial', trialUntil: '2027-12-01T03:00:00+03:00' }),
      adminDb.doc(`ateliers/${validTrialId}`).set({ plan: 'premium', subscriptionStatus: 'trial', trialUntil: '2027-12-01T03:00:00+03:00' }),
      adminDb.doc(`ateliers/${unmarkedDemoId}`).set({ plan: 'premium', subscriptionStatus: 'demo' }),
      adminDb.doc(`ateliers/${invalidDemoDateId}`).set({ plan: 'premium', subscriptionStatus: 'demo', demoWorkspace: true, trialUntil: 'not-a-date' }),
      adminDb.doc(`ateliers/${nonPremiumDemoId}`).set({ plan: 'essencial', subscriptionStatus: 'demo', demoWorkspace: true }),
      adminDb.doc(`ateliers/${validDemoId}`).set({ plan: 'premium', subscriptionStatus: 'demo', demoWorkspace: true, trialUntil: '2027-12-01T03:00:00+03:00' }),
    ]);

    function runMigration(args: string[]) {
      return spawnSync(process.execPath, ['scripts/migrate-commercial-state.mjs', ...args], {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 20000,
        env: { ...process.env, FIREBASE_ADMIN_PROJECT_ID: projectId },
      });
    }

    const dryRun = runMigration([]);
    expect(dryRun.status).toBe(0);
    expect(dryRun.stdout).not.toContain('Nome sintético privado');
    expect((await adminDb.doc(`ateliers/${exactId}/commercial/state`).get()).exists).toBe(false);

    const apply = runMigration(['--apply', `--confirm-project=${projectId}`]);
    expect(apply.status).toBe(0);
    expect((await adminDb.doc(`ateliers/${exactId}/commercial/state`).get()).data()).toMatchObject({ planId: 'pro', subscriptionStatus: 'active' });
    expect((await adminDb.doc(`ateliers/${ambiguousId}/commercial/state`).get()).exists).toBe(false);
    expect((await adminDb.doc(`ateliers/${invalidTrialId}/commercial/state`).get()).exists).toBe(false);
    for (const unchangedId of [dateOnlyTrialId, nonPremiumTrialId, unmarkedDemoId, invalidDemoDateId, nonPremiumDemoId]) {
      expect((await adminDb.doc(`ateliers/${unchangedId}/commercial/state`).get()).exists).toBe(false);
    }
    expect((await adminDb.doc(`ateliers/${validTrialId}/commercial/state`).get()).data()).toMatchObject({ planId: 'premium', subscriptionStatus: 'trial', trialUntil: '2027-12-01T00:00:00.000Z' });
    expect((await adminDb.doc(`ateliers/${validDemoId}/commercial/state`).get()).data()).toMatchObject({ planId: 'premium', subscriptionStatus: 'demo', trialUntil: '2027-12-01T00:00:00.000Z' });

    const repeat = runMigration(['--apply', `--confirm-project=${projectId}`]);
    expect(repeat.status).toBe(0);
    expect(JSON.parse(repeat.stdout).alreadyAssigned).toBeGreaterThanOrEqual(1);
    const wrongProject = runMigration(['--apply', '--confirm-project=wrong-project']);
    expect(wrongProject.status).not.toBe(0);
  }, 60000);
});
