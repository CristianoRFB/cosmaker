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
const adminApp = initializeAdminApp({ projectId }, `team-invitation-e2e-${randomUUID()}`);
const adminAuth = getAdminAuth(adminApp);
const adminDb = getFirestore(adminApp);

test('titular cria convite pela tela e a pessoa aceita com conta verificada no Emulator', async ({ page }) => {
  test.setTimeout(180_000);
  const nonce = randomUUID().slice(0, 8);
  const atelierId = `team-e2e-${nonce}`;
  const ownerEmail = `owner-${nonce}@cosmaker.test`;
  const ownerPassword = `Local!${randomUUID().slice(0, 14)}aA1`;
  const invitedEmail = `invited-${nonce}@cosmaker.test`;
  const invitedPassword = `Local!${randomUUID().slice(0, 14)}aA1`;
  const createdUids: string[] = [];

  try {
    const owner = await adminAuth.createUser({ email: ownerEmail, password: ownerPassword, emailVerified: true });
    createdUids.push(owner.uid);
    const invited = await adminAuth.createUser({ email: invitedEmail, password: invitedPassword, emailVerified: true });
    createdUids.push(invited.uid);
    await Promise.all([
      adminDb.doc(`users/${owner.uid}`).set({
        id: owner.uid, email: ownerEmail, name: `Titular ${nonce}`,
        accountType: 'atelier_member', atelierId, role: 'owner', permissions: [], active: true,
      }),
      adminDb.doc(`ateliers/${atelierId}`).set({ id: atelierId, name: `Ateliê E2E ${nonce}`, ownerId: owner.uid, active: true }),
      adminDb.doc(`ateliers/${atelierId}/members/${owner.uid}`).set({ userId: owner.uid, role: 'owner', permissions: [], active: true }),
      adminDb.doc(`users/${invited.uid}`).set({ id: invited.uid, email: invitedEmail, name: `Pessoa ${nonce}`, accountType: 'client', active: true }),
    ]);

    await page.goto('/login?next=%2Fatelier%2Fequipe%2Fconvites', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('meta[name="cosmaker-firebase-mode"]')).toHaveAttribute('content', 'emulator');
    await page.locator('#email').fill(ownerEmail);
    await page.locator('#password').fill(ownerPassword);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/atelier\/equipe\/convites$/);

    await page.getByLabel('E-mail da pessoa').fill(invitedEmail);
    await page.getByRole('button', { name: 'Criar convite' }).click();
    await expect(page.getByLabel('Link do convite')).toBeVisible();
    const invitationUrl = await page.getByLabel('Link do convite').inputValue();
    expect(invitationUrl).toContain('/convite?');
    expect(new URL(invitationUrl).searchParams.has('token')).toBe(false);
    expect(new URLSearchParams(new URL(invitationUrl).hash.slice(1)).get('token')).toMatch(/^[a-f0-9]{64}$/);

    const recipientContext = await page.context().browser()!.newContext();
    const recipientPage = await recipientContext.newPage();
    try {
      await recipientPage.goto(invitationUrl, { waitUntil: 'domcontentloaded' });
      await recipientPage.getByRole('link', { name: 'Entrar na minha conta' }).click();
      const authNext = new URL(recipientPage.url()).searchParams.get('next') ?? '';
      expect(authNext).not.toContain('token');
      await recipientPage.locator('#email').fill(invitedEmail);
      await recipientPage.locator('#password').fill(invitedPassword);
      await recipientPage.getByRole('button', { name: 'Entrar' }).click();
      await expect(recipientPage).toHaveURL(/\/convite\?/);
      await recipientPage.getByRole('button', { name: 'Aceitar convite' }).click();
      await expect(recipientPage).toHaveURL(/\/atelier$/);
      await expect(recipientPage.getByText('Seu espaço de trabalho')).toBeVisible();
    } finally {
      await recipientContext.close();
    }

    const [invitationSnapshot, memberSnapshot, profileSnapshot] = await Promise.all([
      adminDb.collection(`ateliers/${atelierId}/teamInvitations`).get(),
      adminDb.doc(`ateliers/${atelierId}/members/${invited.uid}`).get(),
      adminDb.doc(`users/${invited.uid}`).get(),
    ]);
    expect(invitationSnapshot.docs).toHaveLength(1);
    expect(invitationSnapshot.docs[0].data().status).toBe('accepted');
    expect(memberSnapshot.data()).toMatchObject({ active: true, role: 'assistant' });
    expect(profileSnapshot.data()).toMatchObject({ accountType: 'atelier_member', atelierId, role: 'assistant' });

    await page.goto('/atelier/equipe');
    const memberCard = page.getByText(invitedEmail, { exact: true }).locator('..').locator('..');
    await memberCard.getByRole('button', { name: 'Alterar acesso', exact: true }).click();
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await expect(page.getByRole('combobox', { name: 'Papel', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.getByRole('combobox', { name: 'Papel', exact: true }).selectOption('cosmaker');
    await page.locator('label').filter({ hasText: 'orders:read' }).getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Salvar acesso', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Vínculo e permissões atualizados.' })).toBeVisible();
    await expect.poll(async () => (await adminDb.doc(`ateliers/${atelierId}/members/${invited.uid}`).get()).data()).toMatchObject({ role: 'cosmaker', permissions: expect.arrayContaining(['orders:read']), active: true });
    for (const active of [false, true]) {
      await memberCard.getByRole('button', { name: 'Alterar acesso', exact: true }).click();
      await page.getByLabel('Vínculo ativo', { exact: true }).setChecked(active);
      await page.getByRole('button', { name: 'Salvar acesso', exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Vínculo e permissões atualizados.' })).toBeVisible();
      await expect.poll(async () => (await adminDb.doc(`ateliers/${atelierId}/members/${invited.uid}`).get()).get('active')).toBe(active);
      expect((await adminDb.doc(`users/${invited.uid}`).get()).get('active')).toBe(true);
      if (!active) {
        const blockedContext = await page.context().browser()!.newContext();
        try {
          const blocked = await blockedContext.newPage(); await blocked.goto('/login?next=%2Fatelier%2Fpedidos');
          await blocked.locator('#email').fill(invitedEmail); await blocked.locator('#password').fill(invitedPassword);
          await blocked.getByRole('button', { name: 'Entrar', exact: true }).click();
          await expect(blocked.getByRole('heading', { name: 'Ateliê não vinculado', exact: true })).toBeVisible();
        } finally { await blockedContext.close(); }
      }
    }
    await memberCard.getByRole('button', { name: 'Transferir titularidade', exact: true }).click();
    const confirm = page.getByRole('dialog', { name: 'Confirmar transferência', exact: true });
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await expect(confirm).toBeVisible();
      expect(await confirm.evaluate(element => element.getBoundingClientRect().width <= innerWidth)).toBe(true);
    }
    await confirm.getByRole('button', { name: 'Transferir titularidade', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Titularidade transferida. Sua conta agora é administradora.' })).toBeVisible();
    expect((await adminDb.doc(`ateliers/${atelierId}`).get()).get('ownerId')).toBe(invited.uid);
    const owners = await adminDb.collection(`ateliers/${atelierId}/members`).where('role', '==', 'owner').get();
    expect(owners.docs.map((member: { id: string }) => member.id)).toEqual([invited.uid]);
    expect((await adminDb.doc(`users/${owner.uid}`).get()).get('role')).toBe('admin');
    await expect(page.getByRole('heading', { name: 'Membros do ateliê', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Transferir titularidade', exact: true })).toHaveCount(0);
  } finally {
    await adminDb.recursiveDelete(adminDb.doc(`ateliers/${atelierId}`)).catch(() => undefined);
    const audits = await adminDb.collection('auditLogs').where('atelierId', '==', atelierId).get().catch(() => null);
    await Promise.all(audits?.docs.map((document: { ref: { delete(): Promise<unknown> } }) => document.ref.delete()) ?? []);
    await Promise.all(createdUids.map((uid) => adminDb.doc(`users/${uid}`).delete().catch(() => undefined)));
    await Promise.all(createdUids.map((uid) => adminAuth.deleteUser(uid).catch(() => undefined)));
    await adminApp.delete().catch(() => undefined);
  }
});
