import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const host = process.env.FIREBASE_EMULATOR_HOST || '127.0.0.1';
const authPort = process.env.COSMAKER_AUTH_EMULATOR_PORT || '19099';
const firestorePort = process.env.COSMAKER_FIRESTORE_EMULATOR_PORT || '18080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= `${host}:${authPort}`;
process.env.FIRESTORE_EMULATOR_HOST ||= `${host}:${firestorePort}`;

const requireFromFunctions = createRequire(resolve(process.cwd(), 'functions/package.json'));
const { initializeApp: initializeAdminApp } = requireFromFunctions('firebase-admin/app');
const { getAuth: getAdminAuth } = requireFromFunctions('firebase-admin/auth');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');
const projectId = 'demo-cosmaker';
const adminApp = initializeAdminApp({ projectId }, `inventory-e2e-${randomUUID()}`);
const adminAuth = getAdminAuth(adminApp);
const adminDb = getFirestore(adminApp);

test('cadastra materiais e fornecedor, movimenta saldo e consome reserva ligada a pedido', async ({ page }) => {
  test.setTimeout(180_000);
  const nonce = randomUUID().slice(0, 8);
  const atelierId = `inventory-e2e-${nonce}`;
  const email = `owner-${nonce}@cosmaker.test`;
  const password = `Local!${randomUUID().slice(0, 14)}aA1`;
  let uid: string | null = null;

  try {
    const user = await adminAuth.createUser({ email, password, displayName: `Titular estoque ${nonce}`, emailVerified: true });
    uid = user.uid;
    await Promise.all([
      adminDb.doc(`users/${uid}`).set({ id: uid, email, name: `Titular estoque ${nonce}`, accountType: 'atelier_member', atelierId, role: 'owner', permissions: [], active: true }),
      adminDb.doc(`ateliers/${atelierId}`).set({ id: atelierId, name: `Ateliê estoque ${nonce}`, ownerId: uid, active: true }),
      adminDb.doc(`ateliers/${atelierId}/members/${uid}`).set({ userId: uid, role: 'owner', permissions: [], active: true }),
      adminDb.doc(`ateliers/${atelierId}/orders/order-e2e`).set({ atelierId, status: 'confirmed', character: 'Projeto fictício', updatedAt: new Date() }),
    ]);

    await page.goto('/login?next=%2Fatelier%2Festoque%2Ffornecedores', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('meta[name="cosmaker-firebase-mode"]')).toHaveAttribute('content', 'emulator');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/atelier\/estoque\/fornecedores$/);

    await page.getByRole('button', { name: 'Novo fornecedor' }).click();
    const supplierDialog = page.getByRole('dialog');
    await supplierDialog.getByLabel('Nome do fornecedor').fill(`Tecidos ${nonce}`);
    await supplierDialog.getByLabel('E-mail').fill(`compras-${nonce}@example.test`);
    await supplierDialog.getByRole('button', { name: 'Cadastrar fornecedor' }).click();
    await expect(page.getByText('Fornecedor cadastrado.')).toBeVisible();
    const supplierSnapshot = await adminDb.collection(`ateliers/${atelierId}/suppliers`).get();
    expect(supplierSnapshot.docs).toHaveLength(1);
    const supplierId = supplierSnapshot.docs[0].id;

    await page.getByRole('link', { name: 'Materiais', exact: true }).click();
    await expect(page).toHaveURL(/\/atelier\/estoque\/materiais$/);
    await page.getByRole('button', { name: 'Novo material' }).click();
    const materialDialog = page.getByRole('dialog');
    await materialDialog.getByLabel('Nome').fill(`Espuma ${nonce}`);
    await materialDialog.getByLabel('Código / SKU').fill(`ESP-${nonce}`);
    await materialDialog.getByLabel('Unidade', { exact: true }).selectOption('un');
    await materialDialog.getByLabel('Custo por unidade (R$)').fill('12.50');
    await materialDialog.getByLabel('Fornecedor').selectOption(supplierId);
    await materialDialog.getByLabel('Avisar em saldo disponível').fill('1');
    await materialDialog.getByRole('button', { name: 'Cadastrar material' }).click();
    await expect(page.getByText(`Material cadastrado.`)).toBeVisible();
    const materialSnapshot = await adminDb.collection(`ateliers/${atelierId}/materials`).get();
    expect(materialSnapshot.docs).toHaveLength(1);
    const materialId = materialSnapshot.docs[0].id;
    expect(materialSnapshot.docs[0].data()).toMatchObject({ supplierId, unitCostCents: 1250, onHandMilli: 0, active: true });

    await page.getByRole('link', { name: 'Movimentações', exact: true }).click();
    await expect(page).toHaveURL(/\/atelier\/estoque\/movimentacoes$/);
    await page.getByRole('button', { name: 'Nova movimentação' }).click();
    let movementDialog = page.getByRole('dialog');
    await movementDialog.getByLabel('Material').selectOption(materialId);
    await movementDialog.getByLabel('Quantidade').fill('4');
    await movementDialog.getByRole('button', { name: 'Registrar movimentação' }).click();
    await expect(page.getByText('Movimentação registrada e saldo atualizado.')).toBeVisible();
    expect((await adminDb.doc(`ateliers/${atelierId}/materials/${materialId}`).get()).data()?.onHandMilli).toBe(4000);

    await page.getByRole('button', { name: 'Nova movimentação' }).click();
    movementDialog = page.getByRole('dialog');
    await movementDialog.getByLabel('Material').selectOption(materialId);
    await movementDialog.getByLabel('Ação').selectOption('reserve');
    await movementDialog.getByLabel('Quantidade').fill('3');
    await movementDialog.getByLabel('ID do pedido').fill('order-e2e');
    await movementDialog.getByLabel('Total planejado para este material').fill('3');
    await movementDialog.getByRole('button', { name: 'Registrar movimentação' }).click();
    await expect(page.getByText('Movimentação registrada e saldo atualizado.')).toBeVisible();
    await expect(page.getByText('Pedido order-e2e · restante 3 un', { exact: true })).toBeVisible();
    const requirement = await adminDb.doc(`ateliers/${atelierId}/orders/order-e2e/materialRequirements/${materialId}`).get();
    expect(requirement.data()).toMatchObject({ plannedMilli: 3000, reservedMilli: 3000, consumedMilli: 0 });

    await page.getByRole('button', { name: 'Consumir' }).click();
    movementDialog = page.getByRole('dialog');
    await movementDialog.getByRole('button', { name: 'Registrar movimentação' }).click();
    await expect(page.getByText('Movimentação registrada e saldo atualizado.')).toBeVisible();
    const finalMaterial = (await adminDb.doc(`ateliers/${atelierId}/materials/${materialId}`).get()).data();
    expect(finalMaterial).toMatchObject({ onHandMilli: 1000, reservedMilli: 0 });
    expect((await adminDb.collection(`ateliers/${atelierId}/inventoryMovements`).get()).size).toBe(3);
  } finally {
    await adminDb.recursiveDelete(adminDb.doc(`ateliers/${atelierId}`)).catch(() => undefined);
    const audits = await adminDb.collection('auditLogs').where('atelierId', '==', atelierId).get().catch(() => null);
    await Promise.all(audits?.docs.map((document: { ref: { delete(): Promise<unknown> } }) => document.ref.delete()) ?? []);
    if (uid) {
      await adminDb.doc(`users/${uid}`).delete().catch(() => undefined);
      await adminAuth.deleteUser(uid).catch(() => undefined);
    }
    await adminApp.delete().catch(() => undefined);
  }
});
