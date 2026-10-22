import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
const requireFromFunctions = createRequire(resolve(process.cwd(), 'functions/package.json'));
const { initializeApp } = requireFromFunctions('firebase-admin/app');
const { getAuth } = requireFromFunctions('firebase-admin/auth');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18080' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:19099') throw new Error('Use somente os emuladores locais de demo-cosmaker.');
const app = initializeApp({ projectId: 'demo-cosmaker' }, `responsive-e2e-${randomUUID()}`);
const auth = getAuth(app); const db = getFirestore(app);

const password = 'CosmakerLocal!2026'; let staffUid: string;
test.beforeAll(async () => {
  const staff = await auth.createUser({ email: `nav-staff-${randomUUID().slice(0, 8)}@cosmaker.test`, password, emailVerified: true }); staffUid = staff.uid;
  await db.doc(`users/${staff.uid}`).set({ active: true, id: staff.uid, email: staff.email, name: 'Equipe de leitura', accountType: 'atelier_member', atelierId: 'atelier-aurora', role: 'assistant' });
  await db.doc(`ateliers/atelier-aurora/members/${staff.uid}`).set({ active: true, role: 'assistant', permissions: ['quotes:read'] });
});
for (const role of ['owner', 'staff', 'client', 'platform'] as const) {
  test(`navegação ${role} em 320, 375, 768 e 1440px`, async ({ page }, info) => {
    test.setTimeout(90_000);
    const staff = role === 'staff' ? await auth.getUser(staffUid) : null;
    const email = role === 'owner' ? 'atelie@cosmaker.test' : role === 'client' ? 'cliente@cosmaker.test' : role === 'platform' ? 'plataforma@cosmaker.test' : staff!.email;
    const route = role === 'owner' ? '/atelier/relatorios' : role === 'staff' ? '/atelier/solicitacoes' : role === 'client' ? '/cliente/pedidos' : '/admin/configuracoes';
    const title = role === 'owner' ? 'Relatórios' : role === 'staff' ? 'Solicitações' : role === 'client' ? 'Meus pedidos' : 'Configurações';
    await page.goto(`/login?next=${encodeURIComponent(route)}`); await page.locator('#email').fill(email); await page.locator('#password').fill(password); await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('banner').getByText(title, { exact: true })).toBeVisible();
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const trigger = page.getByRole('button', { name: 'Abrir menu de navegação', exact: true });
      if (width < 1024) {
        await expect(trigger).toBeVisible(); await trigger.click();
        const menu = page.getByRole('dialog', { name: 'Navegação', exact: true }); await expect(menu).toBeVisible();
        await expect(menu.getByRole('link', { name: title, exact: true })).toHaveAttribute('aria-current', 'page');
        if (role === 'owner') await expect(menu.getByRole('link', { name: 'Financeiro', exact: true })).toBeVisible();
        if (role === 'staff') { await expect(menu.getByRole('link', { name: 'Financeiro', exact: true })).toHaveCount(0); await expect(menu.getByRole('link', { name: 'Estoque', exact: true })).toHaveCount(0); }
        expect(await menu.evaluate((element) => element.getBoundingClientRect().width <= innerWidth && element.scrollHeight >= element.clientHeight)).toBe(true);
        await page.screenshot({ path: info.outputPath(`menu-${role}-${width}.png`) });
        await page.keyboard.press('Escape'); await expect(menu).not.toBeVisible(); await expect(trigger).toBeFocused();
      } else { await expect(trigger).not.toBeVisible(); await expect(page.getByRole('navigation', { name: 'Navegação da área', exact: true })).toBeVisible(); }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.setViewportSize({ width: 375, height: 900 }); await page.getByRole('button', { name: 'Abrir menu de navegação', exact: true }).click();
    const menu = page.getByRole('dialog', { name: 'Navegação', exact: true });
    const link = role === 'platform' ? menu.getByRole('link', { name: 'Métricas', exact: true }) : role === 'client' ? menu.getByRole('link', { name: 'Mensagens', exact: true }) : menu.getByRole('link', { name: 'Orçamentos', exact: true });
    await link.click(); await expect(menu).not.toBeVisible();
    expect(await page.evaluate(() => { const ids = [...document.querySelectorAll('[id]')].map((element) => element.id); return new Set(ids).size === ids.length; })).toBe(true);
  });
}
test.afterAll(async () => { if (staffUid) { await db.doc(`ateliers/atelier-aurora/members/${staffUid}`).delete(); await db.doc(`users/${staffUid}`).delete(); await auth.deleteUser(staffUid); } await app.delete(); });
