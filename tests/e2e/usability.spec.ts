import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
const requireAdmin = createRequire(resolve('functions/package.json'));
const { initializeApp } = requireAdmin('firebase-admin/app');
const { getAuth } = requireAdmin('firebase-admin/auth');
const { getFirestore } = requireAdmin('firebase-admin/firestore');
if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:19099' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18080') throw new Error('Use somente Auth/Firestore Emulator de demo-cosmaker.');
const app = initializeApp({ projectId: 'demo-cosmaker' }, `ux-${randomUUID()}`);
const auth = getAuth(app); const db = getFirestore(app);
test.use({ ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } } : {}), screenshot: 'only-on-failure', trace: 'retain-on-failure' });
const password = 'CosmakerLocal!2026';
const accounts: { uid: string; email: string; kind: string; path: string }[] = [];
const tenant = `ux-${randomUUID()}`;
test.beforeAll(async () => {
  await db.doc(`ateliers/${tenant}`).set({ name: 'Ateliê sintético de usabilidade', active: true, status: 'active' });
  for (const [kind, accountType, role, path] of [
    ['client', 'client', 'client', '/cliente'], ['owner', 'atelier_member', 'owner', '/atelier'],
    ['staff', 'atelier_member', 'assistant', '/atelier'], ['admin', 'platform_admin', 'platform_admin', '/admin'],
  ]) {
    const email = `ux-${kind}-${randomUUID()}@cosmaker.test`;
    const user = await auth.createUser({ email, password, emailVerified: true });
    if (kind === 'admin') await auth.setCustomUserClaims(user.uid, { platformAdmin: true });
    await db.doc(`users/${user.uid}`).set({ name: `Conta ${kind}`, email, accountType, role, active: true, ...(accountType === 'atelier_member' ? { atelierId: tenant } : {}), permissions: [] });
    if (accountType === 'atelier_member') await db.doc(`ateliers/${tenant}/members/${user.uid}`).set({ active: true, role, permissions: kind === 'staff' ? ['quotes:read'] : [] });
    accounts.push({ uid: user.uid, email, kind, path });
  }
});
test.afterAll(async () => {
  for (const user of accounts) { await db.doc(`users/${user.uid}`).delete(); await auth.deleteUser(user.uid); }
  await db.recursiveDelete(db.doc(`ateliers/${tenant}`)); await app.delete();
});

for (const kind of ['client', 'owner', 'staff', 'admin']) test(`orientação, menu e conta ${kind}`, async ({ page }, info) => {
  test.setTimeout(100_000);
  const account = accounts.find((entry) => entry.kind === kind)!;
  await page.goto('/login'); await expect(page.locator('meta[name="cosmaker-firebase-mode"]')).toHaveAttribute('content', 'emulator'); await expect(page.locator('meta[name="cosmaker-firebase-project"]')).toHaveAttribute('content', 'demo-cosmaker'); await page.locator('#email').fill(account.email); await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${account.path}$`));
  await expect(page.getByRole('button', { name: 'Como usar esta área' })).toBeVisible();
  if (kind === 'staff') {
    await expect(page.locator('main a[href="/atelier/pedidos"]')).toHaveCount(0);
    await expect(page.locator('main a[href="/atelier/clientes"]')).toHaveCount(0);
  }
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    if (width < 1024) {
      const trigger = page.getByRole('button', { name: 'Abrir menu de navegação' }); await trigger.click();
      const dialog = page.getByRole('dialog', { name: 'Navegação' }); await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('link', { name: /Início|Visão geral/ })).toHaveAttribute('aria-current', 'page');
      if (kind === 'staff') {
        await expect(dialog.getByRole('link', { name: /Financeiro|Configurações|Estoque/ })).toHaveCount(0);
        await dialog.getByRole('searchbox').fill('financeiro'); await expect(dialog.getByText('Nenhuma área encontrada')).toBeVisible();
      } else {
        await dialog.getByRole('searchbox').fill(kind === 'admin' ? 'auditoria' : 'orcamento');
        await expect(dialog.getByRole('link', { name: kind === 'admin' ? /Auditoria/ : /Orçamentos/ })).toBeVisible();
      }
      await page.screenshot({ path: info.outputPath(`${kind}-${width}.png`) });
      await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
      await trigger.click(); await expect(dialog.getByRole('searchbox')).toHaveValue('');
      await expect(dialog.getByRole('link', { name: 'Sair da conta' })).toBeVisible();
      await dialog.getByRole('button', { name: 'Fechar' }).click();
    } else {
      const nav = page.getByRole('navigation', { name: 'Navegação da área', exact: true }); await expect(nav).toBeVisible();
      await expect(nav.getByRole('link', { name: /Início|Visão geral/ })).toHaveAttribute('aria-current', 'page');
      await page.screenshot({ path: info.outputPath(`${kind}-${width}.png`) });
    }
    const notice = await page.getByText('AMBIENTE LOCAL · dados fictícios nos emuladores Firebase', { exact: true }).boundingBox();
    expect(notice!.height).toBeLessThanOrEqual(64);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: 'Como usar esta área' }).click();
  const help = page.getByRole('dialog', { name: 'Como usar esta área' }); await expect(help).toBeVisible();
  if (kind === 'staff') await expect(help.getByRole('link', { name: /Financeiro|Estoque|Configurações/ })).toHaveCount(0);
  const target = kind === 'admin' ? '/admin/logs' : kind === 'client' ? '/cliente/orcamentos' : '/atelier/orcamentos';
  await help.locator(`a[href="${target}"]`).click(); await expect(help).not.toBeVisible(); await expect(page).toHaveURL(new RegExp(`${target}$`));
  await expect(page.getByRole('banner').getByText(kind === 'admin' ? 'Auditoria' : 'Orçamentos', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Abrir minha área', exact: true })).toHaveAttribute('href', kind === 'client' ? '/cliente/perfil' : kind === 'owner' ? '/atelier/configuracoes' : account.path);
  expect(await page.evaluate(() => { const ids = [...document.querySelectorAll('[id]')].map((item) => item.id); return new Set(ids).size === ids.length; })).toBe(true);
});

test('visitante encontra navegação mobile com teclado e retorno de foco', async ({ page }, info) => {
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto('/');
    if (width < 768) {
      const trigger = page.getByRole('button', { name: 'Abrir menu do site' }); await trigger.click();
      const dialog = page.getByRole('dialog', { name: 'Explorar o Cosmaker' }); await expect(dialog.getByRole('link', { name: 'Portfólio', exact: true })).toBeVisible();
      await page.screenshot({ path: info.outputPath(`public-${width}.png`) });
      await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
      await trigger.click(); await dialog.getByRole('link', { name: 'Serviços', exact: true }).click(); await expect(dialog).not.toBeVisible(); await expect(page).toHaveURL(/\/servicos$/);
    } else await expect(page.getByRole('navigation', { name: 'Navegação principal', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('formulário identifica, anuncia e foca o primeiro erro', async ({ page }) => {
  await page.goto('/login'); await expect(page.locator('meta[name="cosmaker-firebase-mode"]')).toHaveAttribute('content', 'emulator'); await expect(page.locator('meta[name="cosmaker-firebase-project"]')).toHaveAttribute('content', 'demo-cosmaker'); await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('#email')).toHaveAttribute('aria-invalid', 'true'); await expect(page.locator('#email')).toBeFocused();
  await expect(page.locator('#email')).toHaveAttribute('aria-describedby', 'email-error');
  await expect(page.locator('#email-error')).toBeVisible();
  const toggle = page.getByRole('button', { name: 'Mostrar senha' }); await toggle.click();
  await expect(page.locator('#password')).toHaveAttribute('type', 'text'); await expect(page.getByRole('button', { name: 'Ocultar senha' })).toHaveAttribute('aria-pressed', 'true');
});


test('cliente continua sem acesso ao painel administrativo após login', async ({ page }) => {
  const account = accounts.find((entry) => entry.kind === 'client')!;
  await page.goto('/login?next=%2Fadmin');
  await expect(page.locator('meta[name="cosmaker-firebase-mode"]')).toHaveAttribute('content', 'emulator');
  await expect(page.locator('meta[name="cosmaker-firebase-project"]')).toHaveAttribute('content', 'demo-cosmaker');
  await page.locator('#email').fill(account.email); await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Acesso não permitido' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegação da área', exact: true })).toHaveCount(0);
});
