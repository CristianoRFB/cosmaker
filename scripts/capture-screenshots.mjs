import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const outputDirectory = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));
const baseUrl = process.env.SCREENSHOT_BASE_URL || 'http://127.0.0.1:3000';
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
    page.on('pageerror', (error) => errors.push(`${screen.route}: ${error.message}`));
    const response = await page.goto(new URL(screen.route, baseUrl).toString(), { waitUntil: 'networkidle' });
    if (!response?.ok()) throw new Error(`Falha ao abrir ${screen.route}: HTTP ${response?.status() ?? 'sem resposta'}`);
    await page.screenshot({ path: `${outputDirectory}/${screen.name}.png`, fullPage: true });
    console.log(`${screen.route} -> docs/screenshots/${screen.name}.png`);
    await page.close();
  }

  for (const screen of [{ name: 'landing-mobile', route: '/' }, { name: 'quote-request-mobile', route: '/orcamento' }, { name: 'login-mobile', route: '/login' }]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    page.on('pageerror', (error) => errors.push(`${screen.route} mobile: ${error.message}`));
    const response = await page.goto(new URL(screen.route, baseUrl).toString(), { waitUntil: 'networkidle' });
    if (!response?.ok()) throw new Error(`Falha ao abrir ${screen.route} em mobile: HTTP ${response?.status() ?? 'sem resposta'}`);
    await page.screenshot({ path: `${outputDirectory}/${screen.name}.png`, fullPage: true });
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
    page.on('pageerror', (error) => errors.push(`área admin: ${error.message}`));
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
      await page.screenshot({ path: `${outputDirectory}/${screen.name}.png`, fullPage: true });
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
      await page.screenshot({ path: `${outputDirectory}/${screen.name}.png`, fullPage: true });
      console.log(`${screen.route} mobile -> docs/screenshots/${screen.name}.png`);
    }
    await context.close();

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
        ],
      },
      {
        email: process.env.SCREENSHOT_CLIENT_EMAIL || 'cliente@cosmaker.test',
        baseRoute: '/cliente/orcamentos',
        screens: [
          { name: 'client-quotes', route: '/cliente/orcamentos', ready: 'R$ 2.000,00' },
          { name: 'client-quote-detail', route: '/cliente/orcamentos/quote-2026-001?atelierId=atelier-aurora', ready: 'Itens e serviços' },
        ],
        mobileScreens: [
          { name: 'client-quotes-mobile', route: '/cliente/orcamentos', ready: 'R$ 2.000,00' },
          { name: 'client-quote-detail-mobile', route: '/cliente/orcamentos/quote-2026-001?atelierId=atelier-aurora', ready: 'Itens e serviços' },
        ],
      },
    ];
    for (const role of quoteRoles) {
      const roleContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
      const rolePage = await roleContext.newPage();
      rolePage.on('pageerror', (error) => errors.push(`${role.baseRoute}: ${error.message}`));
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
        await rolePage.getByText(screen.ready, { exact: false }).first().waitFor({ timeout: 20_000 });
        const alerts = (await rolePage.getByRole('alert').allTextContents()).filter((alert) => alert.trim());
        if (alerts.length) throw new Error(`A tela ${screen.route} apresentou um erro ao carregar: ${alerts.join(' | ')}`);
        await rolePage.screenshot({ path: `${outputDirectory}/${screen.name}.png`, fullPage: true });
        console.log(`${screen.route} -> docs/screenshots/${screen.name}.png`);
      }
      for (const screen of role.mobileScreens ?? []) {
        await rolePage.setViewportSize({ width: 390, height: 844 });
        const response = await rolePage.goto(new URL(screen.route, baseUrl).toString(), { waitUntil: 'domcontentloaded' });
        if (!response?.ok()) throw new Error(`Falha ao abrir ${screen.route} em mobile: HTTP ${response?.status() ?? 'sem resposta'}`);
        await rolePage.getByText(screen.ready, { exact: false }).first().waitFor({ timeout: 20_000 });
        await rolePage.screenshot({ path: `${outputDirectory}/${screen.name}.png`, fullPage: true });
        console.log(`${screen.route} mobile -> docs/screenshots/${screen.name}.png`);
      }
      await roleContext.close();
    }
  }

  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await browser.close();
}
