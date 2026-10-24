import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

test('Google usa identidade fictícia no popup local e cria somente perfil cliente', async ({ page }) => {
  test.setTimeout(90_000);
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '';
  for (const value of [authHost, process.env.FIRESTORE_EMULATOR_HOST || '']) if (!/^127\.0\.0\.1:\d+$/.test(value)) throw new Error('OAuth fictício exclusivo do Emulator demo-cosmaker.');
  const requireFunctions = createRequire(resolve('functions/package.json'));
  const { initializeApp, deleteApp } = requireFunctions('firebase-admin/app');
  const { getAuth } = requireFunctions('firebase-admin/auth'); const { getFirestore } = requireFunctions('firebase-admin/firestore');
  const nonce = randomUUID().slice(0, 8); const app = initializeApp({ projectId: 'demo-cosmaker' }, `google-ui-${nonce}`);
  const auth = getAuth(app); const db = getFirestore(app); const email = `google-local-${nonce}@cosmaker.test`;
  try {
    await page.goto('/login?next=%2Fcliente');
    await expect(page.locator('meta[name="cosmaker-firebase-mode"]')).toHaveAttribute('content', 'emulator');
    const unavailable = new Promise<null>(resolveBlocked => page.on('requestfailed', failed => {
      const url = new URL(failed.url());
      if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js'
        && failed.failure()?.errorText === 'net::ERR_TUNNEL_CONNECTION_FAILED') resolveBlocked(null);
    }));
    const opened = page.waitForEvent('popup', { timeout: 15_000 });
    const outcome = Promise.race([opened, unavailable]);
    await page.getByRole('button', { name: 'Google', exact: true }).click();
    const popup = await outcome;
    test.skip(popup === null, 'BLOCKED_EXTERNAMENTE: proxy do Cloud recusa apis.google.com/js/api.js; nenhum login Google real foi usado.');
    if (!popup) return;
    await popup.waitForURL(url => url.origin === `http://${authHost}`, { timeout: 15_000 });
    expect(new URL(popup.url()).origin).toBe(`http://${authHost}`);
    await popup.locator('#add-account-button').click();
    await popup.locator('#email-input').fill(email); await popup.locator('#display-name-input').fill('Cliente Google sintético');
    await popup.locator('#sign-in').click();
    await expect(page).toHaveURL(/\/cliente$/);
    const identity = await auth.getUserByEmail(email); expect(identity.emailVerified).toBe(true);
    expect(identity.providerData.map((provider: { providerId: string }) => provider.providerId)).toContain('google.com');
    const profile = (await db.doc(`users/${identity.uid}`).get()).data();
    expect(profile).toMatchObject({ name: 'Cliente Google sintético', email, accountType: 'client', role: 'client', permissions: [], active: true });
    expect(profile.atelierId).toBeUndefined(); expect(profile.platformAdmin).toBeUndefined();
    await page.goto('/logout'); await expect(page).toHaveURL(/\/login$/);
  } finally {
    const identity = await auth.getUserByEmail(email).catch(() => null);
    if (identity) { await db.doc(`users/${identity.uid}`).delete(); await auth.deleteUser(identity.uid); }
    await deleteApp(app);
  }
});
