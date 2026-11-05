/** Firebase Emulator ONLY. Synthetic preview of the public Dogstar-inspired cap-quote experience. */
import { createRequire } from 'node:module';
const requireFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, deleteApp } = requireFunctions('firebase-admin/app');
const { getFirestore, FieldValue } = requireFunctions('firebase-admin/firestore');
const { getAuth } = requireFunctions('firebase-admin/auth');

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST
  || (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_PROJECT_ID !== 'demo-cosmaker')) {
  throw new Error('Preview Dogstar somente com Auth/Firestore Emulators no projeto demo-cosmaker.');
}
const pass = process.env.COSMAKER_PREVIEW_PASSWORD;
if (typeof pass !== 'string' || pass.length < 12) throw new Error('Defina COSMAKER_PREVIEW_PASSWORD em variável privada (12+ caracteres).');
const app = initializeApp({ projectId: 'demo-cosmaker' }, 'dogstar-preview-' + Date.now());
try {
  const db = getFirestore(app), auth = getAuth(app);
  const id = 'atelier-dogstar-preview', slug = 'dogstar-cap-preview';
  const email = 'dogstar-preview@cosmaker.test';
  const reference = db.doc('ateliers/' + id), slugRef = db.doc('publicAtelierSlugs/' + slug);
  const [existing, claimed] = await Promise.all([reference.get(), slugRef.get()]);
  if (existing.exists || claimed.exists) throw new Error('Preview já existe ou slug está ocupado; nenhuma sobrescrita automática.');
  const user = await auth.createUser({ email, password: pass, emailVerified: true, displayName: 'Equipe Demo Dogstar Cap' });
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.create(reference, { id, name: 'Dogstar Cap — Demonstração', ownerId: user.uid, demoWorkspace: true, active: true, createdAt: now, updatedAt: now });
  batch.create(db.doc('users/' + user.uid), { id: user.uid, name: 'Equipe Demo Dogstar Cap', email, accountType: 'atelier_member',
    atelierId: id, role: 'owner', permissions: [], active: true, demoAccount: true, createdAt: now, updatedAt: now });
  batch.create(db.doc('ateliers/' + id + '/members/' + user.uid), { userId: user.uid, role: 'owner', permissions: [], active: true, createdAt: now });
  batch.create(slugRef, { atelierId: id, slug, createdAt: now, updatedAt: now });
  batch.create(db.doc('publicAteliers/' + id), {
    name: 'Dogstar Cap — Demonstração', slug, brandColor: '#7f1d1d',
    tagline: 'Estilo que não late, Morde!', businessType: 'caps',
    published: true, quoteRequestsEnabled: true, demoWorkspace: true,
    createdAt: now, updatedAt: now,
  });
  batch.create(db.doc('ateliers/' + id + '/commercial/state'), {
    planId: 'premium', subscriptionStatus: 'demo', trialUntil: null,
    entitlementOverrides: {}, limitOverrides: {},
  });
  batch.create(db.doc('ateliers/' + id + '/commercial/config'), { featureConfig: {}, createdAt: now });
  try { await batch.commit(); }
  catch (error) { await auth.deleteUser(user.uid).catch(() => undefined); throw error; }
  console.log('Preview sintético criado no Emulator: /dogstar-cap-preview. Nenhum cliente ou pedido real foi importado.');
} finally { await deleteApp(app); }
