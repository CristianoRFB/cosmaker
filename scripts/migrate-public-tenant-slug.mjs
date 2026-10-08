import { createRequire } from 'node:module';

const requireFromFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, getApps } = requireFromFunctions('firebase-admin/app');
const { getFirestore, FieldValue } = requireFromFunctions('firebase-admin/firestore');

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? null;
}

const atelierId = argument('atelier-id')?.trim();
const slug = argument('slug')?.trim();
const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim() || (emulator ? 'demo-cosmaker' : '');
const confirmedProject = argument('confirm-project');

if (!atelierId || atelierId.length > 150 || atelierId.includes('/')) {
  throw new Error('Informe --atelier-id=<id existente>.');
}
if (!slug || slug.length > 63 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  throw new Error('Informe --slug=<slug-minusculo-com-hifens>.');
}
if (!projectId) throw new Error('Defina FIREBASE_ADMIN_PROJECT_ID antes de executar a migração.');
if (!emulator && confirmedProject !== projectId) {
  throw new Error('Execução fora do Emulator recusada. Repita com --confirm-project=<mesmo-id-de-FIREBASE_ADMIN_PROJECT_ID> após conferir o destino.');
}

const app = getApps()[0] ?? initializeApp({ projectId }, `public-slug-migration-${Date.now()}`);
const db = getFirestore(app);
const atelierRef = db.doc(`ateliers/${atelierId}`);
const publicRef = db.doc(`publicAteliers/${atelierId}`);
const slugRef = db.doc(`publicAtelierSlugs/${slug}`);

await db.runTransaction(async (transaction) => {
  const [atelierSnapshot, publicSnapshot, slugSnapshot] = await Promise.all([
    transaction.get(atelierRef), transaction.get(publicRef), transaction.get(slugRef),
  ]);
  if (!atelierSnapshot.exists) throw new Error(`Ateliê inexistente: ${atelierId}.`);
  if (!publicSnapshot.exists) throw new Error(`A configuração publicAteliers/${atelierId} precisa existir antes da migração.`);
  const publicData = publicSnapshot.data() ?? {};
  if (typeof publicData.slug === 'string' && publicData.slug !== slug) {
    throw new Error(`O ateliê já possui o slug estável "${publicData.slug}"; esta rotina não substitui slugs existentes.`);
  }
  if (slugSnapshot.exists && slugSnapshot.data()?.atelierId !== atelierId) {
    throw new Error(`O slug "${slug}" já pertence a outro ateliê.`);
  }
  const publicNeedsUpdate = publicData.slug !== slug;
  const indexNeedsUpdate = !slugSnapshot.exists;
  if (!publicNeedsUpdate && !indexNeedsUpdate) return;

  if (publicNeedsUpdate) transaction.update(publicRef, { slug, updatedAt: FieldValue.serverTimestamp() });
  if (indexNeedsUpdate) transaction.create(slugRef, {
    slug,
    atelierId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
});

console.log(`Slug público "${slug}" associado ao ateliê existente "${atelierId}" em ${emulator ? 'emulador' : `projeto ${projectId}`}.`);
await app.delete();
