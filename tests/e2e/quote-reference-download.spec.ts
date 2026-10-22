import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
const requireFromFunctions = createRequire(resolve(process.cwd(), 'functions/package.json'));
const { initializeApp } = requireFromFunctions('firebase-admin/app');
const { getAuth } = requireFromFunctions('firebase-admin/auth');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18080' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:19099') throw new Error('Use somente os emuladores locais de demo-cosmaker.');
const app = initializeApp({ projectId: 'demo-cosmaker' }, `references-e2e-${randomUUID()}`);
const auth = getAuth(app); const db = getFirestore(app);

test('referência pública permanece privada e é baixada por bytes autenticados pela equipe em desktop/mobile', async ({ page }, info) => {
  test.setTimeout(150_000);
  const nonce = randomUUID().slice(0, 8); const atelierId = `references-e2e-${nonce}`; const slug = `references-${nonce}`; const email = `references-${nonce}@cosmaker.test`; const password = `Local!${nonce}aA1`;
  const owner = await auth.createUser({ email, password, emailVerified: true });
  const { getStorage } = requireFromFunctions('firebase-admin/storage'); const bucket = getStorage(app).bucket('demo-cosmaker.appspot.com'); const png = readFileSync(resolve('tests/fixtures/production-progress.png'));
  const externalFileUrls: string[] = []; page.on('request', (request) => { if (request.url().includes('alt=media&token=')) externalFileUrls.push(request.url()); });
  try {
    await Promise.all([
      db.doc(`users/${owner.uid}`).set({ active: true, id: owner.uid, email, name: 'Equipe sintética', accountType: 'atelier_member', atelierId, role: 'owner' }),
      db.doc(`ateliers/${atelierId}`).set({ active: true, ownerId: owner.uid, name: 'Referências sintéticas' }),
      db.doc(`ateliers/${atelierId}/members/${owner.uid}`).set({ active: true, role: 'owner', permissions: [] }),
      db.doc(`publicAteliers/${atelierId}`).set({ slug, name: 'Referências sintéticas', published: true, quoteRequestsEnabled: true }),
      db.doc(`publicAtelierSlugs/${slug}`).set({ atelierId, slug }),
    ]);
    await page.setViewportSize({ width: 375, height: 900 }); await page.goto(`/${slug}/orcamento`);
    const submit = page.getByRole('button', { name: 'Enviar solicitação' }); await expect(submit).toBeEnabled();
    await page.getByRole('textbox', { name: 'Personagem', exact: true }).fill('Armadura sintética'); await page.getByLabel('Obra ou franquia').fill('Obra sintética'); await page.getByLabel('Categoria do projeto').selectOption('full_cosplay');
    await page.locator('#description').fill('Solicitação fictícia para verificar os bytes privados de referência.'); await page.getByLabel('Data de entrega desejada').fill('2027-12-01'); await page.getByLabel('Seu nome').fill('Cliente sintético'); await page.getByLabel('E-mail').fill(`client-${nonce}@cosmaker.test`);
    await page.locator('input[type="file"]').setInputFiles({ name: 'referencia.png', mimeType: 'image/png', buffer: png }); await submit.click();
    await expect(page.getByText('Solicitação registrada', { exact: true })).toBeVisible(); const requestId = new URL(page.url()).searchParams.get('protocolo')!; expect(requestId).toBeTruthy();
    const refs = await db.collection(`ateliers/${atelierId}/quoteRequests/${requestId}/references`).get(); expect(refs.size).toBe(1); expect(refs.docs[0].data()).toMatchObject({ uploadStatus: 'ready' });
    await page.goto(`/login?next=${encodeURIComponent(`/atelier/solicitacoes/${requestId}`)}`); await page.locator('#email').fill(email); await page.locator('#password').fill(password); await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await expect(page.getByRole('button', { name: 'Baixar referência', exact: true })).toBeVisible();
      const waiting = page.waitForEvent('download'); await page.getByRole('button', { name: 'Baixar referência', exact: true }).click(); const download = await waiting;
      expect(download.suggestedFilename()).toBe('referencia.png'); expect(readFileSync((await download.path())!)).toEqual(png);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`reference-${width}.png`), fullPage: true }); await page.reload();
    }
    expect(externalFileUrls).toEqual([]);
  } finally {
    await bucket.deleteFiles({ prefix: `ateliers/${atelierId}/` }); await db.recursiveDelete(db.doc(`ateliers/${atelierId}`)); await db.doc(`publicAteliers/${atelierId}`).delete(); await db.doc(`publicAtelierSlugs/${slug}`).delete(); await db.doc(`users/${owner.uid}`).delete(); await auth.deleteUser(owner.uid); await app.delete();
  }
});
