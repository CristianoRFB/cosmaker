import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
const requireFromFunctions = createRequire(resolve(process.cwd(), 'functions/package.json'));
const { initializeApp } = requireFromFunctions('firebase-admin/app');
const { getAuth } = requireFromFunctions('firebase-admin/auth');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18080' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:19099') throw new Error('Use somente os emuladores locais de demo-cosmaker.');
const app = initializeApp({ projectId: 'demo-cosmaker' }, `reports-e2e-${randomUUID()}`);
const auth = getAuth(app); const db = getFirestore(app);

test('preferências persistidas e indicadores reais funcionam em 320, 375, 768 e 1440px', async ({ page }, info) => {
  test.setTimeout(180_000);
  const nonce = randomUUID().slice(0, 8); const atelierId = `reports-e2e-${nonce}`;
  const email = `reports-${nonce}@cosmaker.test`; const password = `Local!${nonce}aA1`;
  const user = await auth.createUser({ email, password, emailVerified: true });
  try {
    await Promise.all([
      db.doc(`users/${user.uid}`).set({ id: user.uid, email, name: 'Relatórios sintéticos', accountType: 'atelier_member', atelierId, role: 'owner', active: true }),
      db.doc(`ateliers/${atelierId}`).set({ active: true, ownerId: user.uid, name: 'Ateliê sintético', timezone: 'UTC' }),
      db.doc(`ateliers/${atelierId}/members/${user.uid}`).set({ active: true, role: 'owner', permissions: [] }),
      db.doc(`ateliers/${atelierId}/orders/report-order`).set({ quoteId: 'synthetic-report-quote', description: 'Armadura sintética', status: 'in_production', character: 'Armadura sintética', progress: 50, createdAt: new Date(), expectedDeliveryDate: '2027-01-10', approvedQuoteSnapshot: { total: 1000, depositAmount: 300 }, amountPaid: 300, amountPaidCents: 30000, amountRemaining: 700, amountRemainingCents: 70000 }),
    ]);
    await page.goto('/aurora-cosplay');
    await expect(page.locator('h1')).toContainText('Ateliê Aurora Cosplay');
    await page.goto('/login?next=%2Fatelier%2Fconfiguracoes');
    await expect(page.locator('meta[name="cosmaker-firebase-mode"]')).toHaveAttribute('content', 'emulator');
    await page.locator('#email').fill(email); await page.locator('#password').fill(password); await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByLabel('Fuso horário', { exact: true })).toHaveValue('UTC');
    await page.getByLabel('Dias do período padrão').fill('7');
    await page.getByRole('button', { name: 'Salvar preferências', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Preferências operacionais salvas.' })).toBeVisible();
    await page.reload(); await expect(page.getByLabel('Dias do período padrão')).toHaveValue('7');
    expect((await db.doc(`ateliers/${atelierId}/preferences/operations`).get()).data()).toMatchObject({ version: 1, timezone: 'UTC', defaultReportDays: 7 });
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/atelier/relatorios');
      const metric = page.getByText('Pedidos criados no período', { exact: true }).locator('..');
      await expect(metric.getByText('1', { exact: true })).toBeVisible();
      await expect(page.getByText('50%', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`reports-${width}.png`), fullPage: true });
      await page.getByLabel('Desde', { exact: true }).fill('2000-01-01'); await page.getByLabel('Até', { exact: true }).fill('2000-01-01');
      await page.getByRole('button', { name: 'Aplicar período', exact: true }).click();
      await expect(metric.getByText('0', { exact: true })).toBeVisible();
      await expect(page.getByText('Recebimentos na posição atual', { exact: true }).locator('..')).toContainText('300,00');
      await page.goto('/atelier/configuracoes/geral');
      await expect(page.getByLabel('Dias do período padrão')).toHaveValue('7');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`settings-${width}.png`), fullPage: true });
    }
  } finally {
    await db.recursiveDelete(db.doc(`ateliers/${atelierId}`));
    const logs = await db.collection('auditLogs').where('atelierId', '==', atelierId).get(); await Promise.all(logs.docs.map((doc: { ref: { delete(): Promise<unknown> } }) => doc.ref.delete()));
    await db.doc(`users/${user.uid}`).delete(); await auth.deleteUser(user.uid);
  }
});

test('Platform Owner consulta métricas reais e controles globais em desktop e mobile', async ({ page }, info) => {
  test.setTimeout(90_000);
  const nonce = randomUUID().slice(0, 8); const email = `platform-${nonce}@cosmaker.test`; const password = `Local!${nonce}aA1`;
  const user = await auth.createUser({ email, password, emailVerified: true });
  try {
    await auth.setCustomUserClaims(user.uid, { platformAdmin: true });
    await db.doc(`users/${user.uid}`).set({ active: true, accountType: 'platform_admin', id: user.uid, email, name: 'Administração sintética' });
    const total = (await db.collection('ateliers').count().get()).data().count;
    await page.goto('/login?next=%2Fadmin%2Fmetricas'); await page.locator('#email').fill(email); await page.locator('#password').fill(password); await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await page.goto('/admin/metricas');
      await expect(page.getByText('Ateliês cadastrados', { exact: true }).locator('..')).toContainText(String(total));
      await expect(page.getByText('Ateliês com plano ativo', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.goto('/admin/configuracoes'); await expect(page.getByRole('heading', { name: 'Controles da plataforma' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Abrir controle →', exact: true })).toHaveCount(4);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`platform-settings-${width}.png`), fullPage: true });
    }
  } finally { await db.doc(`users/${user.uid}`).delete(); await auth.deleteUser(user.uid); }
});
test.afterAll(async () => { await app.delete(); });
