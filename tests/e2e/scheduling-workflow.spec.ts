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
const adminApp = initializeAdminApp({ projectId }, `scheduling-e2e-${randomUUID()}`);
const adminAuth = getAdminAuth(adminApp);
const adminDb = getFirestore(adminApp);
test.use({ timezoneId: 'UTC' });

test('configura capacidade, planeja produção e registra/cancela bloqueio e evento na interface', async ({ page }) => {
  test.setTimeout(180_000);
  const nonce = randomUUID().slice(0, 8);
  const atelierId = `schedule-e2e-${nonce}`;
  const email = `owner-${nonce}@cosmaker.test`;
  const password = `Local!${randomUUID().slice(0, 14)}aA1`;
  let uid: string | null = null;
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  try {
    const user = await adminAuth.createUser({ email, password, displayName: `Titular agenda ${nonce}`, emailVerified: true });
    uid = user.uid;
    await Promise.all([
      adminDb.doc(`users/${uid}`).set({ id: uid, email, name: `Titular agenda ${nonce}`, accountType: 'atelier_member', atelierId, role: 'owner', permissions: [], active: true }),
      adminDb.doc(`ateliers/${atelierId}`).set({ id: atelierId, name: `Ateliê agenda ${nonce}`, ownerId: uid, active: true, timezone: 'America/Sao_Paulo' }),
      adminDb.doc(`ateliers/${atelierId}/members/${uid}`).set({ userId: uid, role: 'owner', permissions: [], active: true }),
      adminDb.doc(`ateliers/${atelierId}/orders/order-e2e`).set({
        atelierId, status: 'confirmed', character: 'Elmo Eclipse', clientName: 'Cliente fictícia',
        expectedDeliveryDate: tomorrow, eventDate: tomorrow, amountRemaining: 0,
      }),
      adminDb.doc(`ateliers/${atelierId}/orders/order-e2e/productionStages/stage-e2e`).set({
        atelierId, orderId: 'order-e2e', name: 'Modelagem', order: 1, status: 'pending', progress: 0, assignedTo: null,
      }),
    ]);

    await page.goto('/login?next=%2Fatelier%2Fagenda%2Fcapacidade', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('meta[name="cosmaker-firebase-mode"]')).toHaveAttribute('content', 'emulator');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/atelier\/agenda\/capacidade$/);

    for (const day of ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']) {
      await page.getByLabel(`${day}: horas semanais`).fill('4');
    }
    await page.getByLabel('Início do expediente').fill('08:00');
    await page.getByLabel('Fim do expediente').fill('17:00');
    await page.getByLabel('Fuso horário').fill('America/Sao_Paulo');
    await page.getByRole('button', { name: 'Salvar capacidade' }).click();
    await expect(page.getByText('Capacidade salva e validada com as alocações futuras.')).toBeVisible();
    expect((await adminDb.doc(`ateliers/${atelierId}/teamCapacity/${uid}`).get()).data()?.weeklyHoursByWeekday)
      .toMatchObject({ '0': 4, '1': 4, '2': 4, '3': 4, '4': 4, '5': 4, '6': 4 });

    await page.getByRole('link', { name: 'Agenda', exact: true }).click();
    await expect(page).toHaveURL(/\/atelier\/agenda$/);
    await page.getByLabel('Etapa do pedido').selectOption('order-e2e|stage-e2e');
    await page.getByLabel('Responsável').selectOption(uid);
    await expect(page.getByText('Horários da alocação no fuso do responsável: America/Sao_Paulo.')).toBeVisible();
    await page.getByLabel('Início').fill(`${tomorrow}T06:00`);
    await page.getByLabel('Fim').fill(`${tomorrow}T08:00`);
    await page.getByLabel('Prazo da etapa').fill(tomorrow);
    await page.getByRole('button', { name: 'Alocar no cronograma' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'A alocação precisa caber no expediente' })).toBeVisible();
    await expect(page.getByLabel('Início')).toHaveValue(`${tomorrow}T06:00`);
    await expect(page.getByLabel('Prazo da etapa')).toHaveValue(tomorrow);
    expect((await adminDb.collection(`ateliers/${atelierId}/productionSlots`).get()).size).toBe(0);
    await page.getByLabel('Início').fill(`${tomorrow}T09:00`);
    await page.getByLabel('Fim').fill(`${tomorrow}T11:00`);
    await page.getByLabel('Prazo da etapa').fill(tomorrow);
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole('button', { name: 'Alocar no cronograma' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.getByRole('button', { name: 'Alocar no cronograma' }).click();
    await expect(page.getByText('Horas alocadas no cronograma.')).toBeVisible();
    await expect(page.getByText('Modelagem · 2 h')).toBeVisible();
    await expect(page.getByText(/09:00–11:00 · America\/Sao_Paulo/)).toBeVisible();
    const slots = await adminDb.collection(`ateliers/${atelierId}/productionSlots`).get();
    expect(slots.docs).toHaveLength(1);
    expect(slots.docs[0].data()).toMatchObject({ status: 'scheduled', orderId: 'order-e2e', assignedTo: uid, date: tomorrow });
    expect(slots.docs[0].data().startAt.toDate().toISOString()).toBe(`${tomorrow}T12:00:00.000Z`);

    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByText('Alocação cancelada e capacidade liberada.')).toBeVisible();
    expect((await adminDb.doc(`ateliers/${atelierId}/productionSlots/${slots.docs[0].id}`).get()).data()?.status).toBe('cancelled');

    await page.getByRole('link', { name: 'Bloqueios', exact: true }).click();
    await expect(page).toHaveURL(/\/atelier\/agenda\/bloqueios$/);
    await page.getByLabel('Título').fill('Pausa de teste');
    await page.getByLabel('Data inicial').fill(today);
    await page.getByLabel('Data final').fill(today);
    await page.getByLabel('Início').fill('13:00');
    await page.getByLabel('Fim').fill('14:00');
    await page.getByRole('button', { name: 'Registrar bloqueio' }).click();
    await expect(page.getByText('Bloqueio registrado na agenda.')).toBeVisible();
    await expect(page.getByText('Pausa de teste')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar Pausa de teste' }).click();
    await expect(page.getByText('Bloqueio cancelado.')).toBeVisible();

    await page.getByRole('link', { name: 'Eventos', exact: true }).click();
    await expect(page).toHaveURL(/\/atelier\/eventos$/);
    await page.getByLabel('Título').fill('Convenção de teste');
    await page.getByLabel('Tipo').selectOption('convention');
    await page.getByLabel('Início').fill(tomorrow);
    await page.getByLabel('Fim').fill(tomorrow);
    await page.getByLabel('Observações').fill('Evento fictício para validar o fluxo.');
    await page.getByRole('button', { name: 'Registrar evento' }).click();
    await expect(page.getByText('Evento registrado.')).toBeVisible();
    await expect(page.getByText('Convenção de teste')).toBeVisible();
    expect((await adminDb.collection(`ateliers/${atelierId}/events`).get()).docs[0].data()).toMatchObject({ status: 'active', type: 'convention' });
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
