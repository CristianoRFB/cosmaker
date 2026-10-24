import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

test('páginas públicas e menu funcionam sem conteúdo demonstrativo em quatro larguras', async ({ page }, info) => {
  test.setTimeout(120_000);
  const routes = ['/servicos', '/portfolio', '/portfolio/projeto-legado', '/agenda', '/contato', '/sobre', '/privacidade', '/termos'];
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.getByText('Tela estrutural inicial')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (route === '/privacidade' || route === '/termos') await expect(page.getByText(/Versão em homologação/)).toBeVisible();
    }
    if (width < 1024) {
      const trigger = page.getByRole('button', { name: 'Abrir menu do site' });
      await trigger.click(); await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Escape'); await expect(trigger).toBeFocused(); await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await trigger.click(); await page.getByRole('navigation', { name: 'Navegação pública', exact: true }).getByRole('link', { name: 'Serviços', exact: true }).click();
      await expect(page).toHaveURL(/\/servicos$/); await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      if (width === 320) await page.screenshot({ path: info.outputPath('public-320.png'), fullPage: true });
    } else {
      await expect(page.getByRole('navigation', { name: 'Navegação principal', exact: true })).toBeVisible();
      await page.screenshot({ path: info.outputPath('public-1440.png'), fullPage: true });
    }
  }
  await page.goto('/rota/que-nao-existe');
  await expect(page.getByRole('heading', { name: 'Página não encontrada', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Voltar ao início', exact: true }).click(); await expect(page).toHaveURL('/');
});

test('entradas globais usam somente slug explícito e resolver existente, com erros recuperáveis', async ({ page }) => {
  test.setTimeout(90_000);
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Exclusivo do Emulator demo-cosmaker.');
  const requireFunctions = createRequire(resolve('functions/package.json'));
  const { initializeApp, deleteApp } = requireFunctions('firebase-admin/app');
  const { getFirestore } = requireFunctions('firebase-admin/firestore');
  const app = initializeApp({ projectId: 'demo-cosmaker' }, `public-navigation-${Date.now()}`); const db = getFirestore(app);
  const config = db.doc('publicAteliers/atelier-luna'); const previous = await config.get();
  const submit = async (route: string, slug: string) => { await page.goto(route); await page.getByLabel('Endereço do ateliê', { exact: true }).fill(slug); await page.getByRole('button', { name: 'Abrir ateliê', exact: true }).click(); };
  try {
    await submit('/servicos', ' AURORA-COSPLAY '); await expect(page).toHaveURL(/\/aurora-cosplay#servicos$/); await expect(page.locator('h1')).toContainText('Ateliê Aurora Cosplay');
    await submit('/portfolio', 'luna-cosplay'); await expect(page).toHaveURL(/\/luna-cosplay#portfolio$/); await expect(page.locator('h1')).toContainText('Ateliê Luna Cosplay');
    await submit('/agenda', 'aurora-cosplay'); await expect(page).toHaveURL(/\/aurora-cosplay\/orcamento$/); await expect(page.getByLabel('Data de entrega desejada')).toBeVisible();
    for (const slug of ['atelier-nao-publicado-teste', 'atelier-suspenso-teste', 'slug-inexistente-teste']) {
      await submit('/contato', slug); await expect(page.getByRole('alert').filter({ hasText: 'Este endereço não está disponível.' })).toBeVisible(); await expect(page).toHaveURL(/\/contato$/);
      await expect(page.getByRole('link', { name: 'Ver página pública do ateliê' })).toHaveCount(0);
    }
    await submit('/servicos', 'nao/valido'); await expect(page.getByRole('alert').filter({ hasText: 'Informe o identificador' })).toBeVisible();
    await config.update({ quoteRequestsEnabled: false }); await submit('/contato', 'luna-cosplay');
    await expect(page.getByRole('alert').filter({ hasText: 'temporariamente fechadas' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver página pública do ateliê', exact: true })).toHaveAttribute('href', '/luna-cosplay');
    await page.route('**/resolvePublicTenant', route => route.abort()); await submit('/servicos', 'aurora-cosplay');
    await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível consultar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Abrir ateliê', exact: true })).toBeEnabled();
    await page.unroute('**/resolvePublicTenant'); await page.getByRole('button', { name: 'Abrir ateliê', exact: true }).click(); await expect(page).toHaveURL(/\/aurora-cosplay#servicos$/);
  } finally { await config.update({ quoteRequestsEnabled: previous.get('quoteRequestsEnabled') }); await deleteApp(app); }
});
