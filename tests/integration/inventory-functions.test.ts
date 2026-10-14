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
const adminApp = initializeAdminApp({ projectId }, `inventory-tests-${nonce}`);
const adminAuth = getAdminAuth(adminApp);
const adminDb = getFirestore(adminApp);
const clientApp = initializeApp({ apiKey: 'emulator-only-key', authDomain: `${projectId}.firebaseapp.com`, projectId, appId: 'emulator-only-app' }, `inventory-client-${nonce}`);
const auth = getAuth(clientApp);
const functions = getFunctions(clientApp, 'us-central1');
const emulatorHost = process.env.FIREBASE_EMULATOR_HOST || '127.0.0.1';
connectAuthEmulator(auth, `http://${emulatorHost}:${process.env.COSMAKER_AUTH_EMULATOR_PORT || '19099'}`, { disableWarnings: true });
connectFunctionsEmulator(functions, emulatorHost, Number(process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || 15001));

type Identity = { uid: string; email: string; password: string };
const createdUids: string[] = [];
const atelierIds = [`inventory-${nonce}-a`, `inventory-${nonce}-b`];
const newId = () => randomUUID();
let ownerA: Identity;
let ownerB: Identity;
let noInventoryAccess: Identity;

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

function quantityCall(materialId: string, kind: string, quantity: number, extras: Record<string, unknown> = {}, request: string = newId()) {
  return call<{ movementId: string; reservationId: string | null; alreadyApplied: boolean }>('applyInventoryMovement', {
    requestId: request, materialId, kind, quantity, ...extras,
  });
}

async function createMaterial(name: string, sku = `${nonce}-${name}`) {
  return call<{ materialId: string; alreadyApplied: boolean }>('saveInventoryMaterial', {
    requestId: newId(), name, sku, description: '', unit: 'un', unitCostCents: 1250,
    supplierId: null, reorderPoint: 0, active: true,
  });
}

beforeAll(async () => {
  ownerA = await createIdentity('owner-inventory-a');
  ownerB = await createIdentity('owner-inventory-b');
  noInventoryAccess = await createIdentity('reader-inventory-a');
  await Promise.all([seedAtelier(atelierIds[0], ownerA), seedAtelier(atelierIds[1], ownerB)]);
  await Promise.all([
    adminDb.doc(`users/${noInventoryAccess.uid}`).set({ id: noInventoryAccess.uid, email: noInventoryAccess.email, name: 'Leitor sem estoque', accountType: 'atelier_member', atelierId: atelierIds[0], role: 'assistant', permissions: [], active: true }),
    adminDb.doc(`ateliers/${atelierIds[0]}/members/${noInventoryAccess.uid}`).set({ userId: noInventoryAccess.uid, role: 'assistant', permissions: [], active: true }),
  ]);
  await adminDb.doc(`ateliers/${atelierIds[0]}/orders/order-${nonce}`).set({ atelierId: atelierIds[0], status: 'confirmed', character: 'Projeto fictício', updatedAt: new Date() });
  await signIn(ownerA);
});

afterAll(async () => {
  for (const atelierId of atelierIds) {
    const collections = ['materials', 'suppliers', 'inventoryMovements', 'inventoryReservations', 'inventorySkuIndex', 'members'];
    for (const collectionName of collections) {
      const snapshot = await adminDb.collection(`ateliers/${atelierId}/${collectionName}`).get();
      for (const document of snapshot.docs) await document.ref.delete();
    }
    const requirements = await adminDb.collection(`ateliers/${atelierId}/orders/order-${nonce}/materialRequirements`).get();
    for (const requirement of requirements.docs) await requirement.ref.delete();
    await adminDb.doc(`ateliers/${atelierId}/orders/order-${nonce}`).delete().catch(() => undefined);
    await adminDb.doc(`ateliers/${atelierId}`).delete();
  }
  for (const uid of createdUids) {
    await adminAuth.deleteUser(uid).catch(() => undefined);
    await adminDb.doc(`users/${uid}`).delete().catch(() => undefined);
  }
  await deleteApp(clientApp);
  await deleteApp(adminApp);
});

describe('Inventory Functions em Firebase Emulator', () => {
  it('cria materiais e fornecedores com unicidade de SKU, idempotência e isolamento por tenant', async () => {
    const supplierId = newId();
    const supplier = await call<{ supplierId: string; alreadyApplied: boolean }>('saveInventorySupplier', {
      requestId: supplierId, name: 'Tecidos Sintéticos', email: 'compras@example.test', phone: '', website: '', notes: '', active: true,
    });
    expect(supplier).toMatchObject({ supplierId, alreadyApplied: false });
    const materialId = newId();
    const materialInput = {
      requestId: materialId, name: 'Lona violeta', sku: `LONA-${nonce}`, description: 'Material sintético',
      unit: 'm', unitCostCents: 2750, supplierId, reorderPoint: 3, active: true,
    };
    const saved = await call<{ materialId: string; alreadyApplied: boolean }>('saveInventoryMaterial', materialInput);
    expect(saved).toMatchObject({ materialId, alreadyApplied: false });
    expect(await call('saveInventoryMaterial', materialInput)).toMatchObject({ materialId, alreadyApplied: true });
    await expect(call('saveInventoryMaterial', { ...materialInput, requestId: newId(), name: 'Outra lona' }))
      .rejects.toMatchObject({ code: 'functions/already-exists' });

    const workspace = await call<{ materials: Array<{ id: string; supplierName: string; available: number }> }>('listInventoryWorkspace');
    expect(workspace.materials).toEqual(expect.arrayContaining([expect.objectContaining({ id: materialId, supplierName: 'Tecidos Sintéticos', available: 0 })]));
    const updatedMaterial = await call<{ materialId: string }>('saveInventoryMaterial', {
      ...materialInput, requestId: newId(), materialId, name: 'Lona azul', sku: `LONAB-${nonce}`,
      supplierId: null, unitCostCents: 3000,
    });
    expect(updatedMaterial.materialId).toBe(materialId);
    expect((await adminDb.doc(`ateliers/${atelierIds[0]}/materials/${materialId}`).get()).data())
      .toMatchObject({ name: 'Lona azul', sku: `LONAB-${nonce}`.toUpperCase(), supplierId: null, supplierName: null, unitCostCents: 3000 });
    expect((await adminDb.doc(`ateliers/${atelierIds[0]}/inventorySkuIndex/${`lona-${nonce}`.toLowerCase()}`).get()).exists).toBe(false);
    await call('saveInventoryMaterial', {
      ...materialInput, requestId: newId(), materialId, name: 'Lona azul', sku: `LONAB-${nonce}`,
      supplierId: null, unitCostCents: 3000, active: false,
    });
    expect((await adminDb.doc(`ateliers/${atelierIds[0]}/materials/${materialId}`).get()).data()?.active).toBe(false);
    await call('saveInventorySupplier', {
      requestId: newId(), supplierId, name: 'Tecidos Sintéticos', email: 'compras@example.test',
      phone: '', website: '', notes: 'Contato manual', active: false,
    });
    expect((await adminDb.doc(`ateliers/${atelierIds[0]}/suppliers/${supplierId}`).get()).data()?.active).toBe(false);
    await signIn(ownerB);
    const otherTenant = await call<{ materials: unknown[]; suppliers: unknown[] }>('listInventoryWorkspace');
    expect(otherTenant.materials).toEqual([]);
    expect(otherTenant.suppliers).toEqual([]);
    await signIn(noInventoryAccess);
    await expect(call('listInventoryWorkspace')).rejects.toMatchObject({ code: 'functions/permission-denied' });
  }, 45_000);

  it('registra entradas, reservas, consumo e liberação sem duplicar ledger ou permitir saldo negativo', async () => {
    await signIn(ownerA);
    const { materialId } = await createMaterial('Espuma', `ESP-${nonce}`);
    const received = await quantityCall(materialId, 'receive', 10, {}, `receive-${nonce}`);
    const retried = await quantityCall(materialId, 'receive', 10, {}, `receive-${nonce}`);
    expect(received.movementId).toBe(retried.movementId);
    expect(retried.alreadyApplied).toBe(true);
    await expect(call('saveInventoryMaterial', {
      requestId: newId(), materialId, name: 'Espuma', sku: `ESP-${nonce}`, description: '',
      unit: 'kg', unitCostCents: 1250, supplierId: null, reorderPoint: 0, active: true,
    })).rejects.toMatchObject({ code: 'functions/failed-precondition' });

    const orderId = `order-${nonce}`;
    const requirementRef = adminDb.doc(`ateliers/${atelierIds[0]}/orders/${orderId}/materialRequirements/${materialId}`);
    const reservationA = await quantityCall(materialId, 'reserve', 6, { orderId, plannedQuantity: 10 }, `reserve-a-${nonce}`);
    expect((await requirementRef.get()).data()).toMatchObject({ plannedMilli: 10_000, reservedMilli: 6_000, consumedMilli: 0 });
    await quantityCall(materialId, 'reserve', 4, { orderId, plannedQuantity: 10 }, `reserve-b-${nonce}`);
    expect((await requirementRef.get()).data()).toMatchObject({ plannedMilli: 10_000, reservedMilli: 10_000, consumedMilli: 0 });
    await quantityCall(materialId, 'release', 2, { reservationId: reservationA.reservationId }, `release-${nonce}`);
    expect((await requirementRef.get()).data()).toMatchObject({ reservedMilli: 8_000, consumedMilli: 0 });
    await quantityCall(materialId, 'issue', 4, { reservationId: reservationA.reservationId }, `issue-${nonce}`);
    await expect(quantityCall(materialId, 'issue', 3)).rejects.toMatchObject({ code: 'functions/failed-precondition' });

    const workspace = await call<{ materials: Array<{ id: string; onHand: number; reserved: number; available: number }>; reservations: Array<{ id: string; remaining: number }> }>('listInventoryWorkspace');
    expect(workspace.materials).toEqual(expect.arrayContaining([expect.objectContaining({ id: materialId, onHand: 6, reserved: 4, available: 2 })]));
    expect(workspace.reservations).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'reserve-b-' + nonce, remaining: 4 })]));
    const history = await call<{ movements: Array<{ id: string }> }>('listInventoryMovements', { materialId });
    expect(history.movements).toHaveLength(5);
    expect(history.movements.filter((movement) => movement.id === `receive-${nonce}`)).toHaveLength(1);
    const requirement = await requirementRef.get();
    expect(requirement.data()).toMatchObject({ plannedMilli: 10_000, reservedMilli: 4_000, consumedMilli: 4_000 });
    const audit = await adminDb.collection('auditLogs').where('atelierId', '==', atelierIds[0]).where('entity', '==', 'inventory_movement').get();
    expect(audit.size).toBe(5);
  }, 30_000);

  it('serializa saídas concorrentes no mesmo material e aplica somente uma que cabe no saldo', async () => {
    await signIn(ownerA);
    const { materialId } = await createMaterial('Tinta', `TINTA-${nonce}`);
    await quantityCall(materialId, 'receive', 5);
    const attempts = await Promise.allSettled([
      quantityCall(materialId, 'issue', 4),
      quantityCall(materialId, 'issue', 4),
    ]);
    expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const workspace = await call<{ materials: Array<{ id: string; onHand: number; available: number }> }>('listInventoryWorkspace');
    expect(workspace.materials).toEqual(expect.arrayContaining([expect.objectContaining({ id: materialId, onHand: 1, available: 1 })]));
  }, 30_000);
});
