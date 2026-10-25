import { test, expect } from '@playwright/test';
test.skip(process.env.COSMAKER_SPARK_UI !== 'true', 'Somente harness Spark isolado com emuladores e workerd.');
for (const width of [320, 375, 768, 1440]) {
  test(`Spark local proof: Next/OpenNext to Worker/Firestore at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/api/spark-proof/lab');
    await expect(page.getByRole('heading', { name: 'Prova local Spark' })).toBeVisible();
    await page.getByLabel('E-mail fictício').fill('spark-ui@cosmaker.test');
    await page.getByLabel('Senha fictícia').fill('Synthetic!Password123');
    await page.getByRole('button', { name: 'Conectar ao Worker' }).click();
    await expect(page.getByRole('status')).toContainText('Conectado ao ateliê spark-ui-synthetic');
    await page.getByRole('button', { name: 'Registrar despesa sintética de R$12,34', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Lançamento persistido:');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
