import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
test.skip(process.env.COSMAKER_MEDIA_UI !== 'true', 'Somente harness sintético de mídia; flags OFF fora dele.');
const login = async (page: import('@playwright/test').Page, email = 'media-ui@cosmaker.test') => {
  await page.goto('/api/media-proof/lab');
  await page.getByLabel('E-mail fictício').fill(email); await page.getByLabel('Senha fictícia').fill('Synthetic!Password123');
  await page.getByRole('button', { name: 'Entrar no laboratório' }).click();
  await expect(page.getByRole('status')).toContainText('Sessão sintética verificada.');
};
if (process.env.COSMAKER_MEDIA_UI_PHASE === 'uploads') test.describe('uploads', () => {
  for (const width of [320, 375, 768, 1440]) test(`persist and export exact 20 MiB at ${width}px`, async ({ page }) => {
    test.setTimeout(180000); await page.setViewportSize({ width, height: 900 }); await login(page);
    await page.getByLabel('Pedido', { exact: true }).fill('order-ui');
    const bytes = Buffer.alloc(20 * 1024 * 1024, width % 251); bytes.write('%PDF-1.7\nSynthetic UI proof\n'); const sha = createHash('sha256').update(bytes).digest('hex');
    await page.getByLabel('Arquivo (até 20 MiB)').setInputFiles({ name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: bytes });
    const createdResponse = page.waitForResponse(r => r.url().endsWith('/api/media-proof/assets') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Enviar e conferir integridade' }).click();
    const created = (await (await createdResponse).json()).data;
    await expect(page.getByRole('status')).toContainText('Arquivo persistido e SHA-256 conferido.', { timeout: 120000 });
    const card = page.getByTestId('media-card').filter({ hasText: created.id }); await expect(card).toContainText('PROTECTED_REGULATED'); await expect(card).toContainText('20.00 MiB');
    const downloadPromise = page.waitForEvent('download'); await card.getByRole('button', { name: 'Baixar original / exportar individualmente' }).click();
    const download = await downloadPromise, path = await download.path(); expect(path).toBeTruthy(); const body = await readFile(path!);
    expect(body.length).toBe(20 * 1024 * 1024); expect(createHash('sha256').update(body).digest('hex')).toBe(sha);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByLabel('Arquivo (até 20 MiB)').setInputFiles({ name: 'too-large.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(20 * 1024 * 1024 + 1) });
    await page.getByRole('button', { name: 'Enviar e conferir integridade' }).click(); await expect(page.getByRole('alert').filter({ hasText: '20 MiB inteiros' })).toBeVisible();
  });
  test('opt-in bounded PNG thumbnail preserves the uploaded original', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 }); await login(page); await page.getByLabel('Pedido', { exact: true }).fill('order-ui');
    const base64 = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 32; const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#273456'; ctx.fillRect(0, 0, 64, 32); return canvas.toDataURL('image/png').split(',')[1]; });
    const bytes = Buffer.from(base64, 'base64'); await page.getByLabel('Arquivo (até 20 MiB)').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: bytes }); await page.getByLabel('Gerar prévia PNG local, sem alterar original').check();
    const response = page.waitForResponse(r => r.url().endsWith('/api/media-proof/assets') && r.request().method() === 'POST'); await page.getByRole('button', { name: 'Enviar e conferir integridade' }).click(); const created = (await (await response).json()).data;
    await expect(page.getByRole('status')).toContainText('Arquivo persistido e SHA-256 conferido.'); await expect(page.getByAltText('Prévia local opcional')).toBeVisible();
    const card = page.getByTestId('media-card').filter({ hasText: created.id }); const downloadPromise = page.waitForEvent('download'); await card.getByRole('button').click(); const downloaded = await downloadPromise; expect(await readFile((await downloaded.path())!)).toEqual(bytes);
  });
});
if (process.env.COSMAKER_MEDIA_UI_PHASE === 'notices') test.describe('notices', () => {
  test('canonical warnings and grace are visible in mobile and desktop', async ({ page }) => {
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await login(page);
      const card = page.getByTestId('media-card').filter({ hasText: 'TEMP_WORKFLOW' }).filter({ hasText: 'Aviso prévio' }); await expect(card).toContainText('Aviso prévio: Registrado'); await expect(card).toContainText('Aviso de vencimento: Registrado'); await expect(card).toContainText('Tolerância até:');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
  test('Platform Owner pause persists, ordinary staff cannot govern, old public routes still render', async ({ page }) => {
    test.setTimeout(90000); await page.setViewportSize({ width: 375, height: 900 }); await login(page, 'platform-media-ui@cosmaker.test');
    await expect(page.getByRole('heading', { name: 'Governança global' })).toBeVisible(); await page.getByRole('button', { name: 'Pausar novos uploads' }).click(); await expect(page.getByRole('button', { name: 'Retomar novos uploads' })).toBeVisible();
    await page.reload(); await login(page, 'platform-media-ui@cosmaker.test'); await expect(page.getByRole('button', { name: 'Retomar novos uploads' })).toBeVisible(); await page.getByRole('button', { name: 'Retomar novos uploads' }).click();
    await login(page); await expect(page.getByRole('heading', { name: 'Governança global' })).toHaveCount(0);
    for (const route of ['/', '/login']) { const r = await page.goto(route); expect(r?.status()).toBeLessThan(400); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  });
});
