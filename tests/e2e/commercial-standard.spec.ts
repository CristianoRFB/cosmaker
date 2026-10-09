import { expect, test, type Page } from '@playwright/test';

const fixturePassword = process.env.E2E_FIXTURE_PASSWORD || 'CosmakerLocal!2026';
const adminEmail = process.env.E2E_ADMIN_EMAIL || 'plataforma@cosmaker.test';

async function signIn(page: Page, email: string, next: string) {
  await page.goto('/login');
  await expect(page.locator('meta[name="cosmaker-firebase-mode"]')).toHaveAttribute('content', 'emulator');
  await page.goto(`/login?next=${encodeURIComponent(next)}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(fixturePassword);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
}

test('Platform Owner atribui plano e trial e acompanha os valores na auditoria', async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page, adminEmail, '/admin');
  await page.goto('/admin/planos');
  await expect(page.getByText(/R\$\s*59,90/)).toBeVisible();
  await expect(page.getByText(/R\$\s*1\.199,00/)).toBeVisible();
  await expect(page.getByText('Recomendado', { exact: true })).toBeVisible();
  await expect(page.getByText(/diferenças por recurso e cotas numéricas aguardam aprovação/i)).toHaveCount(3);
  await expect(page.getByRole('button', { name: /checkout|pagar/i })).toHaveCount(0);

  await page.goto('/admin/ateliers/atelier-premium');
  await expect(page.getByRole('heading', { name: 'Tenant Premium de teste' })).toBeVisible();
  await page.getByLabel('Motivo para esta alteração').fill('Atribuição manual pelo teste de jornada.');
  await page.getByLabel('Plano comercial').selectOption('pro');
  const updateSuccess = page.getByText('Estado comercial atualizado e registrado na auditoria.', { exact: true });
  await page.getByRole('button', { name: 'Revisar atribuição' }).click();
  await expect(updateSuccess).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Atribuir plano e status' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar alteração' }).click();
  await expect(updateSuccess).toBeVisible();
  await expect(page.getByText('Premium · Ativo → Pro · Ativo', { exact: true }).first()).toBeVisible();

  await page.getByLabel('Motivo para esta alteração').fill('Status pendente autorizado pelo teste de jornada.');
  await page.getByLabel('Status comercial').selectOption('past_due');
  await page.getByRole('button', { name: 'Revisar atribuição' }).click();
  await expect(updateSuccess).toHaveCount(0);
  await page.getByRole('button', { name: 'Confirmar alteração' }).click();
  await expect(updateSuccess).toBeVisible();
  await expect(page.getByText('Pro · Ativo → Pro · Pendente', { exact: true }).first()).toBeVisible();

  const reason = 'Trial autorizado manualmente pelo teste.';
  const reasonField = page.getByLabel('Motivo para esta alteração');
  await reasonField.fill(reason);
  await expect(reasonField).toHaveValue(reason);
  await page.getByRole('button', { name: 'Iniciar trial autorizado' }).click();
  await expect(page.getByRole('dialog', { name: 'Iniciar trial Premium' })).toBeVisible();
  await expect(updateSuccess).toHaveCount(0);
  await page.getByRole('button', { name: 'Confirmar alteração' }).click();
  await expect(updateSuccess).toBeVisible();
  await expect(page.getByText('Trial Premium iniciado', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Premium · Trial|Trial ·/).first()).toBeVisible();
  await expect(page.getByText(/Trial até:/)).toBeVisible();
});

test('Platform Owner cria e encerra demo com confirmação e auditoria', async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page, adminEmail, '/admin/planos');
  const demoName = `Demo sintética de jornada ${Date.now()}`;
  await page.getByLabel('Nome para a demonstração').fill(demoName);
  await page.getByLabel('Motivo administrativo').fill('Criar demo isolada para validação local da jornada.');
  await page.getByRole('button', { name: 'Criar demonstração Premium' }).click();
  await page.getByRole('button', { name: 'Confirmar criação da demo' }).click();
  await expect(page.getByText('Demonstração criada', { exact: true })).toBeVisible();
  const tenantId = await page.locator('dl').locator('div').filter({ has: page.getByText('Tenant:', { exact: true }) }).locator('dd').innerText();
  await page.goto(`/admin/ateliers/${encodeURIComponent(tenantId)}`);
  await expect(page.getByRole('heading', { name: demoName })).toBeVisible();
  await page.getByLabel('Motivo para esta alteração').fill('Encerrar demo sintética após validação da jornada.');
  await page.getByRole('button', { name: 'Encerrar demonstração', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar alteração' }).click();
  await expect(page.getByText('Demonstração encerrada', { exact: true })).toBeVisible();
  await expect(page.getByText('Premium · Demonstração → Premium · Cancelado', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Suspender ateliê' })).toBeVisible();
});

test('usuário de ateliê não acessa administração comercial', async ({ page }) => {
  await signIn(page, 'atelie@cosmaker.test', '/atelier');
  await page.goto('/admin/planos');
  await expect(page.getByRole('heading', { name: 'Acesso não permitido' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Criar demonstração Premium' })).toHaveCount(0);
});

test('Demo mostra identificação e só executa a prova sintética autorizada', async ({ page }) => {
  await signIn(page, 'demo@cosmaker.test', '/atelier');
  await expect(page.getByText('DEMONSTRAÇÃO — PLANO PREMIUM', { exact: true })).toBeVisible();
  await expect(page.getByText(/dados fictícios/i)).toBeVisible();
  await expect(page.getByText(/Somente Firebase Emulator/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Executar operação de prova' })).toBeVisible();
  await page.getByRole('button', { name: 'Executar operação de prova' }).click();
  await expect(page.getByText(/Operação aceita · uso \d+/)).toBeVisible();
});

test('status past_due mostra bloqueio de política na interface', async ({ page }) => {
  await signIn(page, 'past-due@cosmaker.test', '/atelier');
  await expect(page.getByText('Plano Pro · Pendente')).toBeVisible();
  await expect(page.getByText('O estado comercial atual não libera esta operação protegida.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Executar operação de prova' })).toHaveCount(0);
});
