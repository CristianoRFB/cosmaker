import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { workflowContextOptions } from './workflow-context-options';
import { expect, test } from '@playwright/test';

const host = process.env.FIREBASE_EMULATOR_HOST || '127.0.0.1';
const authPort = process.env.COSMAKER_AUTH_EMULATOR_PORT || '19099';
const firestorePort = process.env.COSMAKER_FIRESTORE_EMULATOR_PORT || '18080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= `${host}:${authPort}`;
process.env.FIRESTORE_EMULATOR_HOST ||= `${host}:${firestorePort}`;
process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= `${host}:${process.env.COSMAKER_STORAGE_EMULATOR_PORT || '19199'}`;

const requireFromFunctions = createRequire(resolve(process.cwd(), 'functions/package.json'));
const { initializeApp: initializeAdminApp } = requireFromFunctions('firebase-admin/app');
const { getAuth: getAdminAuth } = requireFromFunctions('firebase-admin/auth');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');
const projectId = 'demo-cosmaker';
const adminApp = initializeAdminApp({ projectId }, `showcase-e2e-${randomUUID()}`);
const adminAuth = getAdminAuth(adminApp);
const adminDb = getFirestore(adminApp);
const { getStorage } = requireFromFunctions('firebase-admin/storage');
const bucket = getStorage(adminApp).bucket('demo-cosmaker.appspot.com');

test('mantém serviços e portfólio, publica fotos, vincula orçamento e revoga acesso em desktop/mobile', async ({ page, browser }, testInfo) => {
  test.setTimeout(240_000);
  const nonce = randomUUID().slice(0, 8); const atelierIds = [`showcase-e2e-${nonce}-a`, `showcase-e2e-${nonce}-b`];
  const slugs = [`atelier-showcase-${nonce}`, `outro-showcase-${nonce}`];
  const email = `showcase-${nonce}@cosmaker.test`; const password = `Local!${randomUUID().slice(0, 14)}aA1`;
  const projectTitle = `Armadura violeta ${nonce}`; const serviceTitle = `Armaduras sob medida ${nonce}`; const caption = `Detalhes da armadura ${nonce}`;
  const visitorContext = await browser.newContext(workflowContextOptions()); const visitor = await visitorContext.newPage();
  let uid: string | null = null;
  try {
    const user = await adminAuth.createUser({ email, password, emailVerified: true }); uid = user.uid;
    await Promise.all([
      adminDb.doc(`users/${uid}`).set({ id: uid, email, name: 'Titular sintético', accountType: 'atelier_member', atelierId: atelierIds[0], role: 'owner', permissions: [], active: true }),
      adminDb.doc(`ateliers/${atelierIds[0]}/members/${uid}`).set({ userId: uid, role: 'owner', permissions: [], active: true }),
      ...atelierIds.map((id) => adminDb.doc(`ateliers/${id}`).set({ name: 'Ateliê sintético', active: true })),
      ...atelierIds.map((id, index) => adminDb.doc(`publicAteliers/${id}`).set({ slug: slugs[index], name: 'Ateliê sintético', published: true, quoteRequestsEnabled: true, brandColor: '#6d28d9', privateBillingEmail: 'PRIVATE-CONTACT' })),
      ...slugs.map((slug, index) => adminDb.doc(`publicAtelierSlugs/${slug}`).set({ slug, atelierId: atelierIds[index] })),
      adminDb.doc(`ateliers/${atelierIds[1]}/services/service-b`).set({ title: 'Serviço exclusivo de outro ateliê', description: 'Conteúdo público do segundo ateliê.', category: 'wig', public: true, active: true, sortOrder: 0, internalNotes: 'PRIVATE-B' }),
    ]);
    await page.goto('/login?next=%2Fatelier%2Fservicos');
    await expect(page.locator('meta[name="cosmaker-firebase-mode"]')).toHaveAttribute('content', 'emulator');
    await page.locator('#email').fill(email); await page.locator('#password').fill(password); await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.getByRole('button', { name: 'Novo serviço', exact: true }).click();
    let dialog = page.getByRole('dialog');
    await dialog.getByLabel('Título', { exact: true }).fill(serviceTitle);
    await dialog.getByLabel('Descrição pública', { exact: true }).fill('Modelagem e pintura de armaduras sob medida.');
    await dialog.getByLabel('Categoria', { exact: true }).selectOption('armor');
    await dialog.getByLabel('Nota interna', { exact: true }).fill('PRIVATE-SERVICE');
    await dialog.getByLabel('Publicar conteúdo', { exact: true }).check();
    await dialog.getByRole('button', { name: 'Salvar conteúdo', exact: true }).click();
    await expect(page.getByText(serviceTitle, { exact: true })).toBeVisible();
    await page.getByRole('navigation', { name: 'Conteúdo comercial' }).getByRole('link', { name: 'Portfólio', exact: true }).click();
    await page.getByRole('button', { name: 'Novo projeto', exact: true }).click(); dialog = page.getByRole('dialog');
    await dialog.getByLabel('Título', { exact: true }).fill(projectTitle);
    await dialog.getByLabel('Descrição pública', { exact: true }).fill('Armadura autoral com modelagem, textura e pintura artesanal.');
    await dialog.getByLabel('Categoria', { exact: true }).selectOption('armor');
    await dialog.getByLabel('Personagem', { exact: true }).fill('Personagem sintético');
    await dialog.getByLabel('Nota interna', { exact: true }).fill('PRIVATE-PROJECT');
    await expect(dialog.getByLabel('Publicar conteúdo', { exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Salvar conteúdo', exact: true }).click();
    await expect(page.getByText(projectTitle, { exact: true })).toBeVisible();
    await page.getByLabel(`Legenda para ${projectTitle}`, { exact: true }).fill(caption);
    await page.getByLabel(`Adicionar foto em ${projectTitle}`, { exact: true }).setInputFiles(resolve(process.cwd(), 'tests/fixtures/production-progress.png'));
    await expect(page.getByText('Imagem enviada com acesso controlado. Publique o projeto quando estiver pronto.', { exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: caption, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Editar projeto', exact: true }).click(); dialog = page.getByRole('dialog');
    await dialog.getByLabel('Publicar conteúdo', { exact: true }).check();
    await dialog.getByRole('button', { name: 'Salvar conteúdo', exact: true }).click();
    await expect(page.getByText('Publicado', { exact: true })).toBeVisible();
    await page.getByLabel('Nome público', { exact: true }).fill(`Ateliê Violeta ${nonce}`);
    await page.getByLabel('Cor da marca', { exact: true }).fill('#123abc');
    await page.getByLabel('Apresentação curta', { exact: true }).fill('Projetos autorais com atenção aos detalhes.');
    await page.getByRole('button', { name: 'Salvar identidade e publicação', exact: true }).click();
    await expect(page.getByText('Identidade e publicação atualizadas.', { exact: true })).toBeVisible();
    const projectSnapshot = await adminDb.collection(`ateliers/${atelierIds[0]}/portfolio`).get();
    expect(projectSnapshot.size).toBe(1); const projectId = projectSnapshot.docs[0].id; const imageId = projectSnapshot.docs[0].data().images[0].id;
    await page.screenshot({ path: testInfo.outputPath('showcase-admin.png'), fullPage: true });
    await visitor.goto(`http://127.0.0.1:3000/${slugs[0]}`);
    await expect(visitor.getByRole('heading', { name: serviceTitle, exact: true })).toBeVisible();
    await expect(visitor.getByRole('heading', { name: projectTitle, exact: true })).toBeVisible();
    await expect(visitor.getByRole('img', { name: caption, exact: true })).toBeVisible();
    await expect.poll(() => visitor.getByRole('img', { name: caption, exact: true }).evaluate((node) => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)).toBe(true);
    await expect(visitor.getByText(/PRIVATE-/)).toHaveCount(0);
    await visitor.getByLabel('Filtrar categoria', { exact: true }).selectOption('wig');
    await expect(visitor.getByText('Nenhum trabalho publicado nesta categoria.', { exact: true })).toBeVisible();
    await visitor.getByLabel('Filtrar categoria', { exact: true }).selectOption('armor');
    await expect(visitor.getByRole('heading', { name: projectTitle, exact: true })).toBeVisible();
    expect(await visitor.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await visitor.screenshot({ path: testInfo.outputPath('showcase-public.png'), fullPage: true });
    await visitor.getByRole('link', { name: 'Solicitar um projeto semelhante →', exact: true }).click();
    await expect(visitor.getByText(`Referência selecionada: ${projectTitle}`, { exact: true })).toBeVisible();
    await visitor.locator('#character').fill('Personagem sintético'); await visitor.locator('#franchise').fill('Universo sintético');
    await visitor.locator('#category').selectOption('armor'); await visitor.locator('#description').fill('Quero uma armadura autoral inspirada neste trabalho do portfólio.');
    await visitor.locator('#desiredDeliveryDate').fill('2027-10-22'); await visitor.locator('#name').fill('Visitante sintético');
    await visitor.locator('#email').fill(`visitor-${nonce}@cosmaker.test`);
    await visitor.getByRole('button', { name: 'Enviar solicitação', exact: true }).click();
    await expect(visitor).toHaveURL(/\/orcamento\/sucesso\?protocolo=/);
    const requestId = new URL(visitor.url()).searchParams.get('protocolo'); expect(requestId).toBeTruthy();
    expect((await adminDb.doc(`ateliers/${atelierIds[0]}/quoteRequests/${requestId}`).get()).data()?.showcaseContext).toEqual({ project: { id: projectId, title: projectTitle } });
    await page.goto(`/atelier/solicitacoes/${requestId}`); await expect(page.getByText(`Trabalho de referência: ${projectTitle}`, { exact: true })).toBeVisible();
    await page.goto('/atelier/portfolio'); await page.getByRole('button', { name: 'Editar projeto', exact: true }).click(); dialog = page.getByRole('dialog');
    await dialog.getByLabel('Publicar conteúdo', { exact: true }).uncheck(); await dialog.getByRole('button', { name: 'Salvar conteúdo', exact: true }).click();
    await expect(page.getByText('Privado', { exact: true })).toBeVisible();
    await visitor.goto(`http://127.0.0.1:3000/${slugs[0]}`); await expect(visitor.getByRole('heading', { name: serviceTitle, exact: true })).toBeVisible();
    await expect(visitor.getByRole('heading', { name: projectTitle, exact: true })).toHaveCount(0);
    const imageResponse = await visitor.request.get(`http://${host}:15001/demo-cosmaker/us-central1/downloadShowcaseImage?${new URLSearchParams({ tenantSlug: slugs[0], projectId, imageId })}`);
    expect(imageResponse.status()).toBe(404);
    await visitor.goto(`http://127.0.0.1:3000/${slugs[1]}`); await expect(visitor.getByRole('heading', { name: 'Serviço exclusivo de outro ateliê', exact: true })).toBeVisible();
    await expect(visitor.getByRole('heading', { name: serviceTitle, exact: true })).toHaveCount(0);
    await page.getByLabel('Publicar página do ateliê', { exact: true }).uncheck(); await page.getByLabel('Receber solicitações de orçamento', { exact: true }).uncheck();
    await page.getByRole('button', { name: 'Salvar identidade e publicação', exact: true }).click(); await expect(page.getByText('Identidade e publicação atualizadas.', { exact: true })).toBeVisible();
    await visitor.goto(`http://127.0.0.1:3000/${slugs[0]}`); await expect(visitor.getByRole('heading', { name: 'Página ainda não publicada', exact: true })).toBeVisible();
    await expect(visitor.getByRole('heading', { name: serviceTitle, exact: true })).toHaveCount(0);
  } finally {
    await visitorContext.close();
    for (let index = 0; index < 2; index++) {
      const [files] = await bucket.getFiles({ prefix: `ateliers/${atelierIds[index]}/portfolio/` });
      await Promise.all(files.map((file: { delete(): Promise<unknown> }) => file.delete()));
      await adminDb.recursiveDelete(adminDb.doc(`ateliers/${atelierIds[index]}`)); await adminDb.recursiveDelete(adminDb.doc(`publicAteliers/${atelierIds[index]}`)); await adminDb.doc(`publicAtelierSlugs/${slugs[index]}`).delete();
      const audits = await adminDb.collection('auditLogs').where('atelierId', '==', atelierIds[index]).get();
      await Promise.all(audits.docs.map((doc: { ref: { delete(): Promise<unknown> } }) => doc.ref.delete()));
    }
    if (uid) { await adminAuth.deleteUser(uid); await adminDb.doc(`users/${uid}`).delete(); }
    await adminApp.delete();
  }
});
