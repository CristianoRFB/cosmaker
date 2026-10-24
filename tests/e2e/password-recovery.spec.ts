import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

test('recuperação usa Auth Emulator, link único, senha nova e recibo sem revelar cadastro', async ({ page, request }) => {
  test.setTimeout(120_000);
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '';
  for (const value of [authHost, process.env.FIRESTORE_EMULATOR_HOST || '']) if (!/^127\.0\.0\.1:\d+$/.test(value)) throw new Error('Recuperação exclusivamente em demo-cosmaker local.');
  const requireFunctions = createRequire(resolve('functions/package.json'));
  const { initializeApp, deleteApp } = requireFunctions('firebase-admin/app');
  const { getAuth } = requireFunctions('firebase-admin/auth'); const { getFirestore } = requireFunctions('firebase-admin/firestore');
  const nonce = randomUUID().slice(0, 8); const app = initializeApp({ projectId: 'demo-cosmaker' }, `recovery-ui-${nonce}`);
  const auth = getAuth(app); const db = getFirestore(app); const email = `reset-${nonce}@cosmaker.test`;
  const password = `Before!${nonce}aA1`; const nextPassword = `After!${nonce}aA1`;
  const user = await auth.createUser({ email, password, emailVerified: true }); const profile = db.doc(`users/${user.uid}`);
  const receipt = 'Se este endereço estiver cadastrado, você receberá um link para redefinir sua senha.';
  const authApi = `http://${authHost}/identitytoolkit.googleapis.com/v1`;
  try {
    await profile.set({ name: 'Cliente recuperação', email, active: true, accountType: 'client', role: 'client', permissions: [], createdAt: new Date() });
    const before = (await profile.get()).data();
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await page.goto('/recuperar-senha');
      await expect(page.locator('meta[name="cosmaker-firebase-mode"]')).toHaveAttribute('content', 'emulator');
      await page.getByLabel('E-mail', { exact: true }).fill(email);
      await page.getByRole('button', { name: 'Enviar link de recuperação', exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: receipt })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    const records = await request.get(`http://${authHost}/emulator/v1/projects/demo-cosmaker/oobCodes`); expect(records.status()).toBe(200);
    const codes = (await records.json()).oobCodes.filter((code: { email: string; requestType: string }) => code.email === email && code.requestType === 'PASSWORD_RESET');
    expect(codes.length).toBeGreaterThan(0); const code = codes.at(-1).oobCode;
    const reset = await request.post(`${authApi}/accounts:resetPassword?key=emulator-only-key`, { data: { oobCode: code, newPassword: nextPassword } }); expect(reset.status()).toBe(200);
    const replay = await request.post(`${authApi}/accounts:resetPassword?key=emulator-only-key`, { data: { oobCode: code, newPassword: 'ReplayMustNotApply!123' } }); expect(replay.status()).toBe(400);
    const invalid = await request.post(`${authApi}/accounts:resetPassword?key=emulator-only-key`, { data: { oobCode: 'invalid-synthetic-code', newPassword: 'MustNotApply!123' } }); expect(invalid.status()).toBe(400);
    const oldLogin = await request.post(`${authApi}/accounts:signInWithPassword?key=emulator-only-key`, { data: { email, password, returnSecureToken: true } }); expect(oldLogin.status()).toBe(400);
    await page.goto('/login?next=%2Fcliente'); await page.locator('#email').fill(email); await page.locator('#password').fill(nextPassword);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click(); await expect(page).toHaveURL(/\/cliente$/);
    expect((await auth.getUserByEmail(email)).uid).toBe(user.uid); expect((await profile.get()).data()).toEqual(before);
    await page.goto('/logout'); await expect(page).toHaveURL(/\/login$/);
    await page.locator('#email').fill(`unknown-login-${nonce}@cosmaker.test`); await page.locator('#password').fill(nextPassword);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos.' })).toBeVisible();
    await page.goto('/recuperar-senha'); await page.getByLabel('E-mail', { exact: true }).fill(`unknown-reset-${nonce}@cosmaker.test`);
    await page.getByRole('button', { name: 'Enviar link de recuperação', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: receipt })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('alert').filter({ hasText: /conta com esse e-mail/ })).toHaveCount(0);
    await page.goto('/recuperar-senha'); await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page.route('**/accounts:sendOobCode*', route => route.abort());
    await page.getByRole('button', { name: 'Enviar link de recuperação', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: /Não foi possível concluir/ })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: receipt })).toHaveCount(0);
    await page.unroute('**/accounts:sendOobCode*');
    await page.getByRole('button', { name: 'Enviar link de recuperação', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: receipt })).toBeVisible();
  } finally { await profile.delete(); await auth.deleteUser(user.uid); await deleteApp(app); }
});
