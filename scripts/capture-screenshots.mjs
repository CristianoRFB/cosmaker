import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const outputDirectory = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));
const baseUrl = process.env.SCREENSHOT_BASE_URL || 'http://127.0.0.1:3000';
async function captureScreenshot(page, path) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await writeFile(path, await page.screenshot({ fullPage: true }));
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw lastError;
}

async function waitForScreen(page, screen) {
  const ready = page.getByText(screen.ready, { exact: false }).first();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await ready.waitFor({ timeout: 7_000 });
      return;
    } catch (error) {
      if (attempt === 2) {
        const body = (await page.locator('body').innerText()).slice(0, 1200);
        throw new Error(`A tela ${screen.route} não ficou pronta em ${page.url()}. Conteúdo visível: ${body}`, { cause: error });
      }
      await page.reload({ waitUntil: 'domcontentloaded' });
    }
  }
}

const screens = [
  { name: 'landing', route: '/' },
  { name: 'quote-request', route: '/orcamento' },
  { name: 'login', route: '/login' },
  { name: 'registration', route: '/cadastro' },
  { name: 'password-recovery', route: '/recuperar-senha' },
  { name: 'email-verification', route: '/verificar-email' },
  { name: 'quote-request-success-empty', route: '/orcamento/sucesso' },
];

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];

try {
  if (process.env.SCREENSHOT_AUTH_ONLY !== 'true') {
  for (const screen of screens) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    page.on('pageerror', (error) => errors.push(`${screen.route}: ${error.stack || error.message}`));
    const response = await page.goto(new URL(screen.route, baseUrl).toString(), { waitUntil: 'networkidle' });
    if (!response?.ok()) throw new Error(`Falha ao abrir ${screen.route}: HTTP ${response?.status() ?? 'sem resposta'}`);
    await captureScreenshot(page, `${outputDirectory}/${screen.name}.png`);
    console.log(`${screen.route} -> docs/screenshots/${screen.name}.png`);
    await page.close();
  }

  for (const screen of [{ name: 'landing-mobile', route: '/' }, { name: 'quote-request-mobile', route: '/orcamento' }, { name: 'login-mobile', route: '/login' }]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    page.on('pageerror', (error) => errors.push(`${screen.route} mobile: ${error.stack || error.message}`));
    const response = await page.goto(new URL(screen.route, baseUrl).toString(), { waitUntil: 'networkidle' });
    if (!response?.ok()) throw new Error(`Falha ao abrir ${screen.route} em mobile: HTTP ${response?.status() ?? 'sem resposta'}`);
    await captureScreenshot(page, `${outputDirectory}/${screen.name}.png`);
    console.log(`${screen.route} mobile -> docs/screenshots/${screen.name}.png`);
    await page.close();
  }
  }

  if (process.env.SCREENSHOT_LOCAL_ADMIN === 'true') {
    const email = process.env.SCREENSHOT_ADMIN_EMAIL || 'plataforma@cosmaker.test';
    const password = process.env.SCREENSHOT_ADMIN_PASSWORD;
    if (!password) throw new Error('SCREENSHOT_ADMIN_PASSWORD é obrigatório para capturar telas autenticadas do administrador.');
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(`área admin: ${error.stack || error.message}`));
    await page.goto(new URL('/login', baseUrl).toString(), { waitUntil: 'networkidle' });
    const firebaseMode = await page.locator('meta[name="cosmaker-firebase-mode"]').getAttribute('content');
    if (firebaseMode !== 'emulator') throw new Error('Capturas autenticadas bloqueadas: a aplicação não está conectada ao Firebase Emulator.');
    await page.addInitScript(() => document.addEventListener('submit', (event) => event.preventDefault(), true));
    await page.goto(new URL('/login?next=%2Fadmin', baseUrl).toString(), { waitUntil: 'networkidle' });
    await page.waitForTimeout(750);
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL((url) => url.pathname === '/admin', { timeout: 20_000 });
    await page.getByText('Auditoria recente').waitFor({ timeout: 20_000 });
    const adminScreens = [
      { name: 'admin-dashboard', route: '/admin', ready: 'Ateliês cadastrados' },
      { name: 'admin-ateliers', route: '/admin/ateliers', ready: 'Ateliê Aurora Cosplay' },
      { name: 'admin-atelier-detail', route: `/admin/ateliers/${encodeURIComponent(process.env.SCREENSHOT_ATELIER_ID || 'atelier-aurora')}`, ready: 'Conta responsável' },
      { name: 'admin-audit', route: '/admin/logs', ready: 'Ateliê suspenso pela plataforma' },
    ];
    for (const screen of adminScreens) {
      const response = await page.goto(new URL(screen.route, baseUrl).toString(), { waitUntil: 'domcontentloaded' });
      if (!response?.ok()) throw new Error(`Falha ao abrir ${screen.route}: HTTP ${response?.status() ?? 'sem resposta'}`);
      await page.getByText(screen.ready, { exact: false }).first().waitFor({ timeout: 20_000 });
      if (await page.getByText('Não foi possível carregar os dados').count()) throw new Error(`Falha ao carregar dados administrativos em ${screen.route}.`);
      await captureScreenshot(page, `${outputDirectory}/${screen.name}.png`);
      console.log(`${screen.route} -> docs/screenshots/${screen.name}.png`);
      if (screen.name === 'admin-atelier-detail') {
        await page.getByRole('button', { name: 'Suspender ateliê' }).click();
        await page.getByRole('button', { name: 'Suspender acesso' }).click();
        await page.getByText('Suspenso', { exact: true }).waitFor({ timeout: 10_000 });
        await page.getByRole('button', { name: 'Reativar ateliê' }).click();
        await page.getByRole('button', { name: 'Reativar acesso' }).click();
        await page.getByText('Ativo', { exact: true }).waitFor({ timeout: 10_000 });
        console.log('A suspensão e a reativação foram confirmadas no fluxo administrativo local.');
      }
    }

    for (const screen of [{ name: 'admin-dashboard-mobile', route: '/admin', ready: 'Ateliês cadastrados' }, { name: 'admin-ateliers-mobile', route: '/admin/ateliers', ready: 'Ateliê Aurora Cosplay' }]) {
      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(new URL(screen.route, baseUrl).toString(), { waitUntil: 'domcontentloaded' });
      if (!response?.ok()) throw new Error(`Falha ao abrir ${screen.route} em mobile: HTTP ${response?.status() ?? 'sem resposta'}`);
      await page.getByText(screen.ready, { exact: false }).first().waitFor({ timeout: 20_000 });
      await captureScreenshot(page, `${outputDirectory}/${screen.name}.png`);
      console.log(`${screen.route} mobile -> docs/screenshots/${screen.name}.png`);
    }
    await context.close();

    // Make the production screenshots reproducible from a fresh local seed.
    const preparationContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const preparationPage = await preparationContext.newPage();
    await preparationPage.goto(new URL('/login', baseUrl).toString(), { waitUntil: 'networkidle' });
    if (await preparationPage.locator('meta[name="cosmaker-firebase-mode"]').getAttribute('content') !== 'emulator') {
      throw new Error('A preparação de capturas foi bloqueada fora do Firebase Emulator.');
    }
    await preparationPage.addInitScript(() => document.addEventListener('submit', (event) => event.preventDefault(), true));
    await preparationPage.goto(new URL('/login?next=%2Fcliente%2Forcamentos', baseUrl).toString(), { waitUntil: 'networkidle' });
    await preparationPage.waitForTimeout(500);
    await preparationPage.locator('#email').fill(process.env.SCREENSHOT_CLIENT_EMAIL || 'cliente@cosmaker.test');
    await preparationPage.locator('#password').fill(password);
    await preparationPage.getByRole('button', { name: 'Entrar' }).click();
    await preparationPage.waitForURL((url) => url.pathname === '/cliente/orcamentos', { timeout: 20_000 });
    await preparationPage.goto(new URL('/cliente/orcamentos/quote-2026-001?atelierId=atelier-aurora', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
    const approveQuote = preparationPage.getByRole('button', { name: 'Aprovar proposta' });
    await preparationPage.getByRole('heading', { name: 'Proposta de cosplay' }).waitFor({ timeout: 20_000 });
    await approveQuote.waitFor({ timeout: 15_000 });
    await approveQuote.click();
    await preparationPage.getByRole('button', { name: 'Aprovar orçamento' }).click();
    await preparationPage.getByText('Aprovação registrada').waitFor({ timeout: 15_000 });
    await preparationPage.goto(new URL('/cliente/pedidos', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
    const preparedOrderLink = preparationPage.getByRole('link', { name: 'Abrir pedido' });
    for (let attempt = 0; attempt < 20 && !(await preparedOrderLink.count()); attempt += 1) {
      await preparationPage.waitForTimeout(500);
      await preparationPage.reload({ waitUntil: 'domcontentloaded' });
    }
    await preparedOrderLink.waitFor({ timeout: 10_000 });
    await preparationContext.close();

    const quoteRoles = [
      {
        email: process.env.SCREENSHOT_ATELIER_EMAIL || 'atelie@cosmaker.test',
        baseRoute: '/atelier/solicitacoes',
        screens: [
          { name: 'atelier-quote-requests', route: '/atelier/solicitacoes', ready: 'Mikasa Ackerman' },
          { name: 'atelier-quote-request-detail', route: '/atelier/solicitacoes/request-2026-001', ready: 'Projeto solicitado' },
          { name: 'atelier-quotes', route: '/atelier/orcamentos', ready: 'R$ 2.000,00' },
          { name: 'atelier-quote-editor', route: '/atelier/orcamentos/novo?solicitacaoId=request-2026-001', ready: 'Itens do orçamento' },
          { name: 'atelier-quote-detail', route: '/atelier/orcamentos/quote-2026-001', ready: 'Materiais e aviamentos' },
          { name: 'atelier-orders', route: '/atelier/pedidos', ready: 'Mikasa Ackerman' },
          { name: 'atelier-order-detail', route: '/atelier/pedidos/quote-2026-001', ready: 'Itens aprovados' },
          { name: 'atelier-production', route: '/atelier/producao', ready: 'Do planejamento até a entrega' },
          { name: 'atelier-production-kanban', route: '/atelier/producao/kanban', ready: 'Etapas ativas por pedido' },
          { name: 'atelier-order-production', route: '/atelier/pedidos/quote-2026-001/producao', ready: 'Atualizar etapa' },
        ],
        mobileScreens: [
          { name: 'atelier-production-mobile', route: '/atelier/producao', ready: 'Do planejamento até a entrega' },
          { name: 'atelier-production-kanban-mobile', route: '/atelier/producao/kanban', ready: 'Etapas ativas por pedido' },
          { name: 'atelier-order-production-mobile', route: '/atelier/pedidos/quote-2026-001/producao', ready: 'Atualizar etapa' },
        ],
      },
      {
        email: process.env.SCREENSHOT_CLIENT_EMAIL || 'cliente@cosmaker.test',
        baseRoute: '/cliente/orcamentos',
        screens: [
          { name: 'client-quotes', route: '/cliente/orcamentos', ready: 'R$ 2.000,00' },
          { name: 'client-quote-detail', route: '/cliente/orcamentos/quote-2026-001?atelierId=atelier-aurora', ready: 'Itens e serviços' },
          { name: 'client-orders', route: '/cliente/pedidos', ready: 'Mikasa Ackerman' },
          { name: 'client-order-detail', route: '/cliente/pedidos/quote-2026-001?atelierId=atelier-aurora', ready: 'Itens aprovados' },
          { name: 'client-production-approval', route: '/cliente/pedidos/quote-2026-001?atelierId=atelier-aurora', ready: 'Sua aprovação é necessária' },
          { name: 'client-measurement-profiles', route: '/cliente/medidas', ready: 'Ficha principal' },
          { name: 'client-measurement-detail', route: '/cliente/medidas/profile-marina?atelierId=atelier-aurora', ready: 'Medidas cadastradas' },
        ],
        mobileScreens: [
          { name: 'client-quotes-mobile', route: '/cliente/orcamentos', ready: 'R$ 2.000,00' },
          { name: 'client-quote-detail-mobile', route: '/cliente/orcamentos/quote-2026-001?atelierId=atelier-aurora', ready: 'Itens e serviços' },
          { name: 'client-orders-mobile', route: '/cliente/pedidos', ready: 'Mikasa Ackerman' },
          { name: 'client-order-detail-mobile', route: '/cliente/pedidos/quote-2026-001?atelierId=atelier-aurora', ready: 'Itens aprovados' },
          { name: 'client-production-approval-mobile', route: '/cliente/pedidos/quote-2026-001?atelierId=atelier-aurora', ready: 'Sua aprovação é necessária' },
          { name: 'client-measurement-profiles-mobile', route: '/cliente/medidas', ready: 'Ficha principal' },
          { name: 'client-measurement-detail-mobile', route: '/cliente/medidas/profile-marina?atelierId=atelier-aurora', ready: 'Medidas cadastradas' },
        ],
      },
    ];
    for (const role of quoteRoles) {
      const roleContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
      const rolePage = await roleContext.newPage();
      rolePage.on('pageerror', (error) => errors.push(`${rolePage.url()}: ${error.stack || error.message}`));
      await rolePage.goto(new URL('/login', baseUrl).toString(), { waitUntil: 'networkidle' });
      const roleFirebaseMode = await rolePage.locator('meta[name="cosmaker-firebase-mode"]').getAttribute('content');
      if (roleFirebaseMode !== 'emulator') throw new Error('Capturas autenticadas bloqueadas: a aplicação não está conectada ao Firebase Emulator.');
      await rolePage.addInitScript(() => document.addEventListener('submit', (event) => event.preventDefault(), true));
      await rolePage.goto(new URL(`/login?next=${encodeURIComponent(role.baseRoute)}`, baseUrl).toString(), { waitUntil: 'networkidle' });
      await rolePage.waitForTimeout(750);
      await rolePage.locator('#email').fill(role.email);
      await rolePage.locator('#password').fill(password);
      await rolePage.getByRole('button', { name: 'Entrar' }).click();
      await rolePage.waitForURL((url) => url.pathname === role.baseRoute, { timeout: 20_000 });
      for (const screen of role.screens) {
        const response = await rolePage.goto(new URL(screen.route, baseUrl).toString(), { waitUntil: 'domcontentloaded' });
        if (!response?.ok()) throw new Error(`Falha ao abrir ${screen.route}: HTTP ${response?.status() ?? 'sem resposta'}`);
      await waitForScreen(rolePage, screen);
        const alerts = (await rolePage.getByRole('alert').allTextContents()).filter((alert) => alert.trim());
        if (alerts.length) throw new Error(`A tela ${screen.route} apresentou um erro ao carregar: ${alerts.join(' | ')}`);
        await captureScreenshot(rolePage, `${outputDirectory}/${screen.name}.png`);
        console.log(`${screen.route} -> docs/screenshots/${screen.name}.png`);
        if (screen.name === 'atelier-order-detail') {
          const registerDeposit = rolePage.getByRole('button', { name: 'Registrar recebimento' });
          if (await registerDeposit.count()) {
            await registerDeposit.click();
            await rolePage.getByRole('button', { name: 'Confirmar entrada' }).click();
            await rolePage.getByText('Entrada registrada', { exact: false }).waitFor({ timeout: 15_000 });
          }
          await rolePage.goto(new URL('/atelier/pedidos/quote-2026-001/producao', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
          for (const stageName of ['A iniciar', 'Modelagem', 'Em produção']) {
            await rolePage.locator('section').getByRole('heading', { name: stageName, exact: true }).waitFor({ timeout: 15_000 });
            await rolePage.getByRole('button', { name: 'Iniciar etapa' }).first().click();
            await rolePage.getByRole('button', { name: 'Concluir etapa' }).click();
          }
          await rolePage.getByRole('button', { name: 'Iniciar etapa' }).click();
          await rolePage.locator('#production-photo-stage-fitting').setInputFiles({
            name: 'prova.png', mimeType: 'image/png',
            buffer: await readFile(fileURLToPath(new URL('../tests/fixtures/production-progress.png', import.meta.url))),
          });
          await rolePage.getByLabel('Descrição para o histórico').fill('Prova do ajuste da manga');
          await rolePage.getByLabel('Visível ao cliente').check();
          await rolePage.getByRole('button', { name: 'Enviar foto' }).click();
          await rolePage.getByText('Foto de progresso enviada.').waitFor({ timeout: 15_000 });
          await rolePage.getByRole('button', { name: 'Solicitar aprovação do cliente' }).click();
          await rolePage.getByText('Etapa enviada para aprovação do cliente.').waitFor({ timeout: 15_000 });
        }
      }
      for (const screen of role.mobileScreens ?? []) {
        await rolePage.setViewportSize({ width: 390, height: 844 });
        const response = await rolePage.goto(new URL(screen.route, baseUrl).toString(), { waitUntil: 'domcontentloaded' });
        if (!response?.ok()) throw new Error(`Falha ao abrir ${screen.route} em mobile: HTTP ${response?.status() ?? 'sem resposta'}`);
        await waitForScreen(rolePage, screen);
        await captureScreenshot(rolePage, `${outputDirectory}/${screen.name}.png`);
        console.log(`${screen.route} mobile -> docs/screenshots/${screen.name}.png`);
      }
      await roleContext.close();
    }
  }

  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await browser.close();
}
