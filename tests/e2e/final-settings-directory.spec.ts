import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const requireFunctions = createRequire(resolve('functions/package.json'));
const { initializeApp, deleteApp } = requireFunctions('firebase-admin/app');
const { getFirestore } = requireFunctions('firebase-admin/firestore');
const password = 'CosmakerLocal!2026';
async function signIn(page: Page, email: string, route: string) {
  await page.goto(`/login?next=${encodeURIComponent(route)}`); await page.locator('#email').fill(email); await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(route + '$'));
}
function localOnly() {
  for (const name of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env[name] || '')) throw new Error('Teste exclusivo dos emuladores de demo-cosmaker.');
}

test('Platform Owner consulta e pagina perfis reais e diferencia Auth ausente; owner não acessa o diretório', async ({ page }, info) => {
  localOnly(); test.setTimeout(120_000);
  const nonce = randomUUID().slice(0, 8); const app = initializeApp({ projectId: 'demo-cosmaker' }, `directory-ui-${nonce}`); const db = getFirestore(app);
  const ids = Array.from({ length: 51 }, (_, index) => `000-directory-${nonce}-${String(index).padStart(2, '0')}`);
  try {
    const batch = db.batch(); ids.forEach((id, index) => batch.set(db.doc(`users/${id}`), { name: `Perfil sintético ${nonce} ${index}`, email: `${id}@cosmaker.test`, accountType: 'client', active: true, privateSecret: 'PRIVATE-DIRECTORY-SECRET' })); await batch.commit();
    await signIn(page, 'plataforma@cosmaker.test', '/admin/usuarios');
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await page.goto('/admin/usuarios');
      await expect(page.getByRole('heading', { name: 'Perfis de acesso', exact: true })).toBeVisible();
      const row = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: `Perfil sintético ${nonce} 0`, exact: true }) });
      await expect(row.getByText('Conta de autenticação ausente', { exact: true })).toBeVisible();
      await expect(page.getByText('PRIVATE-DIRECTORY-SECRET')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`directory-${width}.png`) });
    }
    await page.getByRole('button', { name: 'Carregar mais perfis', exact: true }).click();
    await expect(page.getByRole('heading', { name: `Perfil sintético ${nonce} 50`, exact: true })).toBeVisible();
    await page.goto('/logout'); await expect(page).toHaveURL(/\/login$/);
    await signIn(page, 'atelie@cosmaker.test', '/atelier'); await page.goto('/admin/usuarios');
    await expect(page.getByRole('heading', { name: 'Acesso não permitido', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Perfis de acesso', exact: true })).toHaveCount(0);
  } finally { const cleanup = db.batch(); ids.forEach(id => cleanup.delete(db.doc(`users/${id}`))); await cleanup.commit(); await deleteApp(app); }
});

test('assinatura, comunicação e entrega usam os fluxos existentes em quatro larguras', async ({ page }) => {
  localOnly(); test.setTimeout(120_000);
  await signIn(page, 'atelie@cosmaker.test', '/atelier/configuracoes/assinatura');
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto('/atelier/configuracoes/assinatura');
    await expect(page.getByRole('heading', { name: 'Assinatura do ateliê', exact: true })).toBeVisible();
    await expect(page.getByText('Carregando situação comercial…')).not.toBeVisible();
    await expect(page.getByText(/R\$\s*59,90/).first()).toBeVisible(); await expect(page.getByText(/R\$\s*119,90/).first()).toBeVisible(); await expect(page.getByText(/R\$\s*199,90/).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto('/atelier/configuracoes/integracoes'); await expect(page.getByRole('link', { name: 'Abrir mensagens internas', exact: true })).toBeVisible();
    await expect(page.getByText(/não estão habilitados/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.goto('/logout'); await expect(page).toHaveURL(/\/login$/);
  await signIn(page, 'cliente@cosmaker.test', '/cliente/enderecos');
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto('/cliente/enderecos');
    await expect(page.getByRole('heading', { name: 'Dados de entrega', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Combinar entrega com o ateliê', exact: true })).toHaveAttribute('href', '/cliente/mensagens');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
