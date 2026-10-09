import { expect, test, type Page } from '@playwright/test';

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const atelierId = process.env.E2E_ATELIER_ID || 'atelier-aurora';

async function signInAsPlatformAdmin(page: Page) {
  if (!email || !password) throw new Error('Defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD para os testes autenticados do Emulator.');
  await page.goto('/login');
  await expect(page.locator('meta[name="cosmaker-firebase-mode"]')).toHaveAttribute('content', 'emulator');
  await page.goto('/login?next=%2Fadmin', { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test('mostra métricas reais da plataforma e a lista de ateliês', async ({ page }) => {
  test.setTimeout(60_000);
  await signInAsPlatformAdmin(page);
  await expect(page.getByText('Ateliês cadastrados')).toBeVisible();
  await page.goto('/admin/ateliers');
  await expect(page.getByRole('heading', { name: 'Ateliês', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Ateliê Aurora Cosplay/ }).first()).toBeVisible();
  await expect(page.getByText('atelie@cosmaker.test')).toBeVisible();
});

test('suspende e reativa um ateliê com confirmação', async ({ page }) => {
  test.setTimeout(60_000);
  await signInAsPlatformAdmin(page);
  await page.goto(`/admin/ateliers/${encodeURIComponent(atelierId)}`);
  await expect(page.getByRole('heading', { name: 'Ateliê Aurora Cosplay' })).toBeVisible();

  await page.getByRole('button', { name: 'Suspender ateliê' }).click();
  await page.getByRole('button', { name: 'Suspender acesso' }).click();
  await expect(page.locator('span').filter({ hasText: /^Suspenso$/ })).toBeVisible();

  await page.getByRole('button', { name: 'Reativar ateliê' }).click();
  await page.getByRole('button', { name: 'Reativar acesso' }).click();
  await expect(page.locator('span').filter({ hasText: /^Ativo$/ })).toBeVisible();

  await page.goto('/admin/logs');
  await expect(page.getByRole('heading', { name: 'Ateliê suspenso pela plataforma' }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ateliê reativado pela plataforma' }).first()).toBeVisible();
});
