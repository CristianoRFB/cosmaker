import { expect, test, type Page } from '@playwright/test';

const email = process.env.E2E_ATELIER_EMAIL || 'atelie@cosmaker.test';
const password = process.env.E2E_FIXTURE_PASSWORD || 'CosmakerLocal!2026';

async function signInAsAtelier(page: Page) {
  await page.goto('/login?next=%2Fatelier%2Fclientes', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('meta[name="cosmaker-firebase-mode"]')).toHaveAttribute('content', 'emulator');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/atelier\/clientes$/);
}

test('equipe consulta a ficha, registra interação e salva novo cliente no Emulator', async ({ page }) => {
  test.setTimeout(180_000);
  await signInAsAtelier(page);
  await expect(page.getByRole('link', { name: 'Abrir ficha de Marina Almeida' })).toBeVisible();
  await page.getByRole('link', { name: 'Abrir ficha de Marina Almeida' }).click();
  await expect(page.getByText('Conta autenticada vinculada')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Fichas de medidas' })).toBeVisible();
  await expect(page.getByText('Ficha principal')).toBeVisible();

  const note = `Interação CRM ${Date.now()}`;
  await page.getByLabel('Nova anotação').fill(note);
  await page.getByRole('button', { name: 'Registrar interação' }).click();
  await expect(page.getByText(note)).toBeVisible();

  await page.goto('/atelier/clientes');
  await page.getByRole('button', { name: 'Novo cliente' }).click();
  const dialog = page.getByRole('dialog', { name: 'Novo cliente' });
  const clientName = `Cliente CRM ${Date.now()}`;
  await dialog.getByLabel('Nome').fill(clientName);
  await dialog.getByLabel('E-mail').fill(`crm-${Date.now()}@example.test`);
  await dialog.getByLabel('Telefone').fill('+55 11 90000-1234');
  await dialog.getByRole('button', { name: 'Cadastrar cliente' }).click();
  await expect(page.getByText('Cliente cadastrado com sucesso.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Buscar clientes' }).fill(clientName);
  await expect(page.getByRole('link', { name: `Abrir ficha de ${clientName}` })).toBeVisible();
});
