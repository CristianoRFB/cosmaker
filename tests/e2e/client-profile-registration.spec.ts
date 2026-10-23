import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const requireFromFunctions = createRequire(resolve(process.cwd(), 'functions/package.json'));
const { initializeApp, deleteApp } = requireFromFunctions('firebase-admin/app');
const { getAuth } = requireFromFunctions('firebase-admin/auth');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');

test('cadastro cria perfil cliente limitado antes da verificação e acessa o portal após confirmação fictícia', async ({ page }) => {
  for (const name of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env[name] ?? '')) throw new Error('Cadastro de teste exclusivo do Emulator local.');
  const nonce = randomUUID().slice(0, 8); const app = initializeApp({ projectId: 'demo-cosmaker' }, `registration-${nonce}`); const auth = getAuth(app); const db = getFirestore(app);
  const email = `registration-${nonce}@cosmaker.test`; const password = `Local!${nonce}aA1`;
  try {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto('/cadastro?next=%2Fcliente%2Forcamentos');
    await expect(page.locator('meta[name="cosmaker-firebase-mode"]')).toHaveAttribute('content', 'emulator');
    await page.locator('#name').fill('Cliente sintético'); await page.locator('#email').fill(email);
    await page.locator('#password').fill(password); await page.locator('#confirmPassword').fill(password);
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await expect(page).toHaveURL(/\/verificar-email/);
    const identity = await auth.getUserByEmail(email); expect(identity.emailVerified).toBe(false);
    const profile = (await db.doc(`users/${identity.uid}`).get()).data();
    expect(profile).toMatchObject({ name: 'Cliente sintético', email, accountType: 'client', role: 'client', permissions: [], active: true });
    expect(profile.atelierId).toBeUndefined(); expect(profile.platformAdmin).toBeUndefined();
    expect(profile.createdAt.toMillis()).toBeGreaterThan(0);
    await auth.updateUser(identity.uid, { emailVerified: true });
    await page.getByRole('button', { name: 'Já confirmei', exact: true }).click();
    await expect(page).toHaveURL(/\/cliente\/orcamentos$/);
    await expect(page.getByRole('heading', { name: 'Nenhum orçamento disponível' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    const identity = await auth.getUserByEmail(email).catch(() => null);
    if (identity) { await db.doc(`users/${identity.uid}`).delete(); await auth.deleteUser(identity.uid); }
    await deleteApp(app);
  }
});
