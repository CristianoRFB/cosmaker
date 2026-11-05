import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { initializeApp as initializeClient, deleteApp } from 'firebase/app';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

const requireFromFunctions = createRequire(new URL('../../functions/package.json', import.meta.url));
const { initializeApp: initializeAdminApp } = requireFromFunctions('firebase-admin/app');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');
const projectId = 'demo-cosmaker';
const seed = randomUUID().slice(0, 8);
const capId = 'it-cap-' + seed;
const cosplayId = 'it-cosplay-' + seed;
const capSlug = 'cap-brand-' + seed;
const cosplaySlug = 'cosplay-brand-' + seed;

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Testes cap-intake exigem Firebase Emulator.');
}
const adminApp = initializeAdminApp({ projectId }, 'cap-tests-' + seed);
const db = getFirestore(adminApp);
const app = initializeClient({
  apiKey: 'emulator-only-key', authDomain: projectId + '.firebaseapp.com',
  projectId, appId: 'emulator-only-app',
}, 'cap-client-' + seed);
const functions = getFunctions(app, 'us-central1');
connectFunctionsEmulator(functions, process.env.FIREBASE_EMULATOR_HOST || '127.0.0.1',
  Number(process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || '15001'));

function invoke<T>(name: string, data: Record<string, unknown>) {
  return httpsCallable<Record<string, unknown>, T>(functions, name)(data).then(result => result.data);
}

const normalCap = {
  category: 'custom_cap',
  name: 'Cliente sintético',
  email: 'teste-cap@example.invalid',
  capCustomization: {
    model: 'Modelo sob encomenda',
    capColor: 'Vinho',
    frontArtwork: 'Símbolo bordado na frente',
    backArtwork: 'Frase no verso',
    quantity: 2,
  },
  desiredDeliveryDate: '2027-12-15',
  urgency: 'normal',
};

beforeAll(async () => {
  const batch = db.batch();
  for (const [id, slug, type] of [[capId, capSlug, 'caps'], [cosplayId, cosplaySlug, 'cosmaker']] as const) {
    batch.create(db.doc('ateliers/' + id), { name: 'Tenant sintético ' + type, active: true });
    batch.create(db.doc('publicAteliers/' + id), {
      slug, name: 'Tenant sintético ' + type, published: true, quoteRequestsEnabled: true, businessType: type,
    });
    batch.create(db.doc('publicAtelierSlugs/' + slug), { slug, atelierId: id });
  }
  await batch.commit();
}, 60000);

afterAll(async () => {
  await Promise.all([db.recursiveDelete(db.doc('ateliers/' + capId)),
    db.recursiveDelete(db.doc('ateliers/' + cosplayId))].map(p => p.catch(() => undefined)));
  await Promise.all([capId, cosplayId].map(id => db.doc('publicAteliers/' + id).delete()));
  await Promise.all([capSlug, cosplaySlug].map(slug => db.doc('publicAtelierSlugs/' + slug).delete()));
  await deleteApp(app);
  await adminApp.delete();
});

describe('Cap intake multi-tenant via callable real', () => {
  it('devolve apenas campos públicos e preserva businessType', async () => {
    const result = await invoke<{status:string;tenant:Record<string,unknown>}>('resolvePublicTenant', {tenantSlug:capSlug});
    expect(result.status).toBe('available');
    expect(result.tenant.businessType).toBe('caps');
    expect(result.tenant).not.toHaveProperty('atelierId');
  });
  it('grava somente no atelier do slug e salva personalização estruturada', async () => {
    const result = await invoke<{ requestId: string }>('createPublicQuoteRequest', {
      tenantSlug:capSlug, input:normalCap, references:[],
    });
    const saved = await db.doc('ateliers/' + capId + '/quoteRequests/' + result.requestId).get();
    expect(saved.exists).toBe(true);
    expect(saved.data()?.category).toBe('custom_cap');
    expect(saved.data()?.capCustomization).toMatchObject({quantity:2,capColor:'Vinho'});
    expect(saved.data()?.character).toBe('Modelo sob encomenda');
    expect((await db.doc('ateliers/' + cosplayId + '/quoteRequests/' + result.requestId).get()).exists).toBe(false);
  });
  it('rejeita cap em tenant cosplay e alteração maliciosa de atelierId', async () => {
    await expect(invoke('createPublicQuoteRequest', {
      tenantSlug:cosplaySlug, input:normalCap, references:[],
    })).rejects.toMatchObject({code:'functions/invalid-argument'});
    await expect(invoke('createPublicQuoteRequest', {
      tenantSlug:capSlug, atelierId:cosplayId, input:normalCap, references:[],
    })).rejects.toMatchObject({code:'functions/invalid-argument'});
    await expect(invoke('createPublicQuoteRequest', {
      tenantSlug:capSlug, input:{...normalCap,capCustomization:{...normalCap.capCustomization,atelierId:cosplayId}}, references:[],
    })).rejects.toMatchObject({code:'functions/invalid-argument'});
  });
  it('rejeita payload indevido e quantidade fora da política', async () => {
    await expect(invoke('createPublicQuoteRequest', {
      tenantSlug:capSlug,input:{...normalCap,capCustomization:{...normalCap.capCustomization,quantity:0}},references:[],
    })).rejects.toMatchObject({code:'functions/invalid-argument'});
  });
  it('recusa anexos de workspace DEMO mesmo por chamada direta', async () => {
    const demoId='it-demo-cap-'+seed, demoSlug='demo-cap-'+seed;
    try {
      await Promise.all([
        db.doc('ateliers/'+demoId).set({active:true,demoWorkspace:true}),
        db.doc('publicAteliers/'+demoId).set({slug:demoSlug,name:'Demo sintética',
          published:true,quoteRequestsEnabled:true,businessType:'caps'}),
        db.doc('publicAtelierSlugs/'+demoSlug).set({slug:demoSlug,atelierId:demoId}),
      ]);
      await expect(invoke('createPublicQuoteRequest',{
        tenantSlug:demoSlug,input:normalCap,references:[{name:'cap.png',contentType:'image/png',size:20}],
      })).rejects.toMatchObject({code:'functions/failed-precondition'});
    } finally {
      await db.recursiveDelete(db.doc('ateliers/'+demoId));
      await db.doc('publicAteliers/'+demoId).delete();
      await db.doc('publicAtelierSlugs/'+demoSlug).delete();
    }
  });
});
