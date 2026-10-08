import { createRequire } from 'node:module';

const requireFromFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp } = requireFromFunctions('firebase-admin/app');
const { getAuth } = requireFromFunctions('firebase-admin/auth');
const { getFirestore, Timestamp } = requireFromFunctions('firebase-admin/firestore');

const projectId = 'demo-cosmaker';
const fixturePassword = 'CosmakerLocal!2026';
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Recusei a gravação: inicie os emuladores locais de Auth e Firestore antes de criar dados de teste.');
}

const app = initializeApp({ projectId }, `cosmaker-demo-${Date.now()}`);
const auth = getAuth(app);
const db = getFirestore(app);

async function ensureLocalUser(email, displayName) {
  try {
    const user = await auth.getUserByEmail(email);
    return await auth.updateUser(user.uid, { displayName, password: fixturePassword, emailVerified: true, disabled: false });
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error;
    return auth.createUser({ email, displayName, password: fixturePassword, emailVerified: true });
  }
}

const atelierUser = await ensureLocalUser('atelie@cosmaker.test', 'Ateliê Aurora Cosplay');
const atelierUserB = await ensureLocalUser('atelie-luna@cosmaker.test', 'Ateliê Luna Cosplay');
const clientUser = await ensureLocalUser('cliente@cosmaker.test', 'Marina Almeida');
const platformAdminUser = await ensureLocalUser('plataforma@cosmaker.test', 'Administração Cosmaker OS');
await auth.setCustomUserClaims(platformAdminUser.uid, { platformAdmin: true });
const atelierId = 'atelier-aurora';
const suspendedAtelierId = 'atelier-suspended-demo';
const unpublishedAtelierId = 'atelier-unpublished-demo';
const requestId = 'request-2026-001';
const quoteId = 'quote-2026-001';
const now = Timestamp.now();
const eventAt = Timestamp.fromDate(new Date('2026-09-30T12:00:00.000Z'));

// Keep the quote-to-order production journey repeatable without touching a real Firebase project.
await db.recursiveDelete(db.doc(`ateliers/${atelierId}/orders/${quoteId}`));

const batch = db.batch();
batch.set(db.doc(`users/${atelierUser.uid}`), {
  id: atelierUser.uid, name: atelierUser.displayName, email: atelierUser.email,
  accountType: 'atelier_member', atelierId, role: 'owner', permissions: [], active: true, createdAt: now, updatedAt: now,
});
batch.set(db.doc(`users/${atelierUserB.uid}`), {
  id: atelierUserB.uid, name: atelierUserB.displayName, email: atelierUserB.email,
  accountType: 'atelier_member', atelierId: 'atelier-luna', role: 'owner', permissions: [], active: true, createdAt: now, updatedAt: now,
});
batch.set(db.doc(`users/${clientUser.uid}`), {
  id: clientUser.uid, name: clientUser.displayName, email: clientUser.email,
  accountType: 'client', role: 'client', permissions: [], active: true, createdAt: now, updatedAt: now,
});
batch.set(db.doc(`users/${platformAdminUser.uid}`), {
  id: platformAdminUser.uid, name: platformAdminUser.displayName, email: platformAdminUser.email,
  accountType: 'platform_admin', role: 'platform_admin', permissions: [], active: true, createdAt: now, updatedAt: now,
});
batch.set(db.doc(`ateliers/${atelierId}`), {
  id: atelierId, name: 'Ateliê Aurora Cosplay', ownerId: atelierUser.uid, active: true, plan: 'essencial', createdAt: now, updatedAt: now,
});
batch.set(db.doc('ateliers/atelier-luna'), {
  id: 'atelier-luna', name: 'Ateliê Luna Cosplay', ownerId: atelierUserB.uid, active: true, plan: 'essencial', createdAt: now, updatedAt: now,
});
batch.set(db.doc(`ateliers/${suspendedAtelierId}`), {
  id: suspendedAtelierId, name: 'Ateliê de teste suspenso', active: false, status: 'suspended', createdAt: now, updatedAt: now,
});
batch.set(db.doc(`ateliers/${unpublishedAtelierId}`), {
  id: unpublishedAtelierId, name: 'Ateliê de teste não publicado', active: true, status: 'active', createdAt: now, updatedAt: now,
});
batch.set(db.doc(`ateliers/${atelierId}/members/${atelierUser.uid}`), {
  userId: atelierUser.uid, role: 'owner', permissions: [], active: true, createdAt: now,
});
batch.set(db.doc(`ateliers/atelier-luna/members/${atelierUserB.uid}`), {
  userId: atelierUserB.uid, role: 'owner', permissions: [], active: true, createdAt: now,
});
batch.set(db.doc(`ateliers/${atelierId}/clients/${clientUser.uid}`), {
  id: clientUser.uid, userId: clientUser.uid, name: clientUser.displayName, email: clientUser.email,
  totalSpent: 0, orderCount: 0, createdAt: now, updatedAt: now,
});
batch.set(db.doc(`ateliers/${atelierId}/measurementProfiles/profile-marina`), {
  clientId: clientUser.uid, name: 'Ficha principal', active: true, createdAt: now, updatedAt: now,
});
batch.set(db.doc(`ateliers/${atelierId}/measurementProfiles/profile-marina/measurements/chest`), {
  type: 'circumference', label: 'Tórax', value: 88, unit: 'cm', notes: 'Medida de referência', createdAt: now, updatedAt: now,
});
batch.set(db.doc(`ateliers/${atelierId}/measurementProfiles/profile-marina/measurements/waist`), {
  type: 'circumference', label: 'Cintura', value: 68, unit: 'cm', notes: '', createdAt: now, updatedAt: now,
});
batch.set(db.doc(`publicAteliers/${atelierId}`), {
  name: 'Ateliê Aurora Cosplay', slug: 'aurora-cosplay', tagline: 'Projetos artesanais com atenção a cada detalhe.', brandColor: '#6d28d9', published: true, quoteRequestsEnabled: true,
});
batch.set(db.doc('publicAteliers/atelier-luna'), {
  name: 'Ateliê Luna Cosplay', slug: 'luna-cosplay', tagline: 'Sua ideia ganha forma com cuidado e criatividade.', brandColor: '#be185d', published: true, quoteRequestsEnabled: true,
});
batch.set(db.doc(`publicAteliers/${suspendedAtelierId}`), {
  name: 'Ateliê de teste suspenso', slug: 'atelier-suspenso-teste', published: true, quoteRequestsEnabled: true,
});
batch.set(db.doc(`publicAteliers/${unpublishedAtelierId}`), {
  name: 'Ateliê de teste não publicado', slug: 'atelier-nao-publicado-teste', published: false, quoteRequestsEnabled: true,
});
batch.set(db.doc('publicAtelierSlugs/aurora-cosplay'), {
  slug: 'aurora-cosplay', atelierId, createdAt: now, updatedAt: now,
});
batch.set(db.doc('publicAtelierSlugs/luna-cosplay'), {
  slug: 'luna-cosplay', atelierId: 'atelier-luna', createdAt: now, updatedAt: now,
});
batch.set(db.doc(`publicAtelierSlugs/atelier-suspenso-teste`), {
  slug: 'atelier-suspenso-teste', atelierId: suspendedAtelierId, createdAt: now, updatedAt: now,
});
batch.set(db.doc(`publicAtelierSlugs/atelier-nao-publicado-teste`), {
  slug: 'atelier-nao-publicado-teste', atelierId: unpublishedAtelierId, createdAt: now, updatedAt: now,
});
batch.set(db.doc(`ateliers/${atelierId}/quoteRequests/${requestId}`), {
  clientId: null, name: clientUser.displayName, email: clientUser.email,
  character: 'Mikasa Ackerman', franchise: 'Attack on Titan', category: 'full_cosplay',
  description: 'Uniforme completo com jaqueta, harness, acessórios e acabamento resistente para evento.',
  eventDate: '2027-03-12', desiredDeliveryDate: '2027-03-01', budgetMin: 1800, budgetMax: 2600,
  urgency: 'normal', observations: 'Preferência por tecido leve e acabamento resistente para o evento.',
  status: 'quoted', activeQuoteId: quoteId, createdAt: eventAt, updatedAt: now,
});
batch.set(db.doc(`ateliers/${atelierId}/quotes/${quoteId}`), {
  atelierId, requestId, clientId: null, email: clientUser.email, status: 'sent',
  materialsCost: 850, laborCost: 1050, otherCost: 100, urgencyFee: 0, shipping: 45, discount: 45,
  subtotal: 2045, total: 2000, depositPercentage: 30, depositAmount: 600,
  validUntil: '2026-10-15', expectedStartDate: '2026-10-20', expectedCompletionDate: '2027-02-28',
  createdBy: atelierUser.uid, createdAt: now, updatedAt: now, sentAt: now,
});
batch.set(db.doc(`ateliers/${atelierId}/quotes/${quoteId}/items/material-demo`), {
  description: 'Materiais e aviamentos', category: 'material', quantity: 1, unitPrice: 850, total: 850, createdAt: now,
});
batch.set(db.doc(`ateliers/${atelierId}/quotes/${quoteId}/items/labor-demo`), {
  description: 'Confecção e acabamento', category: 'labor', quantity: 30, unitPrice: 35, total: 1050, createdAt: now,
});
batch.set(db.doc(`ateliers/${atelierId}/quotes/${quoteId}/items/other-demo`), {
  description: 'Prova e ajustes', category: 'other', quantity: 1, unitPrice: 100, total: 100, createdAt: now,
});

await batch.commit();
console.log('Dados de teste gravados somente nos emuladores locais (project demo-cosmaker).');
console.log(`Conta do ateliê: ${atelierUser.email}`);
console.log(`Conta do segundo ateliê: ${atelierUserB.email}`);
console.log(`Conta do cliente: ${clientUser.email}`);
console.log(`Conta administrativa local: ${platformAdminUser.email}`);
console.log(`Senha local das três contas: ${fixturePassword}`);

await app.delete();
