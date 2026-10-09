import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collectionGroup, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';

let environment: RulesTestEnvironment;

const demoProtectedFiles = [
  ['branding/logo.png', 'image/png'],
  ['portfolio/demo-project/photo.png', 'image/png'],
  ['clients/demo-client/measurements/photo.png', 'image/png'],
  ['orders/demo-order/references/reference.png', 'image/png'],
  ['orders/demo-order/approvals/approval.pdf', 'application/pdf'],
  ['orders/demo-order/documents/document.pdf', 'application/pdf'],
  ['orders/demo-order/shipping/label.pdf', 'application/pdf'],
  ['contracts/contract.pdf', 'application/pdf'],
  ['invoices/invoice.pdf', 'application/pdf'],
] as const;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-cosmaker',
    firestore: { rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8') },
    storage: { rules: readFileSync(resolve(process.cwd(), 'storage.rules'), 'utf8') },
  });
});

afterAll(async () => { if (environment) await environment.cleanup(); });

beforeEach(async () => {
  await environment.clearFirestore();
  await environment.clearStorage();
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'ateliers/atelier-a'), { name: 'Ateliê A', active: true }),
      setDoc(doc(db, 'ateliers/atelier-b'), { name: 'Ateliê B', active: true }),
      setDoc(doc(db, 'ateliers/atelier-demo'), { name: 'Ateliê de demonstração', active: true, demoWorkspace: true }),
      setDoc(doc(db, 'ateliers/atelier-closed'), { name: 'Ateliê fechado', active: true }),
      setDoc(doc(db, 'ateliers/atelier-unpublished-intake'), { name: 'Ateliê não publicado', active: true }),
      setDoc(doc(db, 'ateliers/atelier-suspended'), { name: 'Ateliê suspenso', active: false }),
      setDoc(doc(db, 'publicAteliers/atelier-a'), { slug: 'atelier-a', quoteRequestsEnabled: true, published: true }),
      setDoc(doc(db, 'publicAteliers/atelier-b'), { slug: 'atelier-b', quoteRequestsEnabled: true, published: true }),
      setDoc(doc(db, 'publicAteliers/atelier-closed'), { quoteRequestsEnabled: false, published: false }),
      setDoc(doc(db, 'publicAteliers/atelier-unpublished-intake'), { quoteRequestsEnabled: true, published: false }),
      setDoc(doc(db, 'publicAtelierSlugs/atelier-a'), { slug: 'atelier-a', atelierId: 'atelier-a' }),
      setDoc(doc(db, 'publicAtelierSlugs/atelier-b'), { slug: 'atelier-b', atelierId: 'atelier-b' }),
      setDoc(doc(db, 'ateliers/atelier-a/members/member-a'), { active: true, role: 'owner', permissions: [] }),
      setDoc(doc(db, 'ateliers/atelier-b/members/member-b'), { active: true, role: 'assistant', permissions: ['quotes:read'] }),
      setDoc(doc(db, 'ateliers/atelier-demo/members/demo-owner'), { active: true, role: 'owner', permissions: [] }),
      setDoc(doc(db, 'ateliers/atelier-a/members/finance-reader'), { active: true, role: 'assistant', permissions: ['quotes:read'] }),
      setDoc(doc(db, 'ateliers/atelier-a/members/no-order-access'), { active: true, role: 'assistant', permissions: [] }),
      setDoc(doc(db, 'ateliers/atelier-a/quoteRequests/request-a'), { email: 'client@example.com', status: 'new' }),
      setDoc(doc(db, 'ateliers/atelier-b/quoteRequests/request-b'), { email: 'other@example.com', status: 'new' }),
      setDoc(doc(db, 'ateliers/atelier-b/orders/order-b'), { clientId: 'client-b', email: 'other@example.com', status: 'confirmed' }),
      setDoc(doc(db, 'ateliers/atelier-a/quoteRequests/request-a/references/ref-a'), {
        storagePath: 'ateliers/atelier-a/quoteRequests/request-a/references/ref-a', originalName: 'ref.png',
        contentType: 'image/png', size: 3, uploadStatus: 'pending', createdAt: serverTimestamp(),
      }),
      setDoc(doc(db, 'ateliers/atelier-b/quoteRequests/request-b/references/ref-b'), {
        storagePath: 'ateliers/atelier-b/quoteRequests/request-b/references/ref-b', originalName: 'ref.png',
        contentType: 'image/png', size: 3, uploadStatus: 'ready', createdAt: serverTimestamp(),
      }),
      setDoc(doc(db, 'ateliers/atelier-closed/quoteRequests/request-closed'), { email: 'client@example.com', status: 'new' }),
      setDoc(doc(db, 'ateliers/atelier-unpublished-intake/quoteRequests/request-unpublished'), { email: 'client@example.com', status: 'new' }),
      setDoc(doc(db, 'ateliers/atelier-unpublished-intake/quoteRequests/request-unpublished/references/ref-unpublished'), {
        storagePath: 'ateliers/atelier-unpublished-intake/quoteRequests/request-unpublished/references/ref-unpublished',
        originalName: 'ref.png', contentType: 'image/png', size: 3, uploadStatus: 'pending', createdAt: serverTimestamp(),
      }),
      setDoc(doc(db, 'ateliers/atelier-a/quotes/quote-a'), { email: 'client@example.com', status: 'sent', total: 1200 }),
      setDoc(doc(db, 'ateliers/atelier-a/transactions/transaction-a'), { amount: 1200 }),
      setDoc(doc(db, 'ateliers/atelier-a/clients/client-a'), { userId: 'client-a', email: 'client@example.com' }),
      setDoc(doc(db, 'ateliers/atelier-a/clients/client-b'), { userId: 'client-b', email: 'other@example.com' }),
      setDoc(doc(db, 'ateliers/atelier-a/measurementProfiles/profile-a'), { clientId: 'client-a', name: 'Ficha do cliente', active: true, updatedAt: serverTimestamp() }),
      setDoc(doc(db, 'ateliers/atelier-a/measurementProfiles/profile-b'), { clientId: 'client-b', name: 'Outra ficha', active: true, updatedAt: serverTimestamp() }),
      setDoc(doc(db, 'ateliers/atelier-a/measurementProfiles/profile-a/measurements/chest'), { type: 'circumference', label: 'Tórax', value: 88, unit: 'cm' }),
      setDoc(doc(db, 'ateliers/atelier-a/orders/order-a'), { clientId: 'client-a', email: 'client@example.com', status: 'confirmed', amountPaid: 600, amountRemaining: 1400, createdAt: serverTimestamp() }),
      setDoc(doc(db, 'ateliers/atelier-a/orders/order-a/measurementSnapshot/chest'), { label: 'Tórax', value: 88, unit: 'cm' }),
      setDoc(doc(db, 'ateliers/atelier-a/orders/order-a/payments/deposit'), { type: 'deposit', amount: 600, status: 'paid' }),
      setDoc(doc(db, 'ateliers/atelier-a/orders/order-a/productionStages/stage-fitting'), { name: 'Prova e ajustes', order: 3, status: 'waiting_approval', progress: 100, progressWeight: 20, requiresClientApproval: true }),
      setDoc(doc(db, 'ateliers/atelier-a/orders/order-a/approvals/approval-a'), { stageId: 'stage-fitting', status: 'pending', stageName: 'Prova e ajustes' }),
      setDoc(doc(db, 'ateliers/atelier-a/orders/order-a/photos/photo-visible'), {
        atelierId: 'atelier-a', orderId: 'order-a', stageId: 'stage-fitting', storagePath: 'ateliers/atelier-a/orders/order-a/production/photo-visible',
        visibleToClient: true, uploadStatus: 'ready', uploadedBy: 'member-a', size: 9, contentType: 'image/png',
      }),
      setDoc(doc(db, 'ateliers/atelier-a/orders/order-a/photos/photo-internal'), {
        atelierId: 'atelier-a', orderId: 'order-a', stageId: 'stage-fitting', storagePath: 'ateliers/atelier-a/orders/order-a/production/photo-internal',
        visibleToClient: false, uploadStatus: 'ready', uploadedBy: 'member-a', size: 9, contentType: 'image/png',
      }),
      setDoc(doc(db, 'ateliers/atelier-a/orders/order-a/photos/photo-upload'), {
        atelierId: 'atelier-a', orderId: 'order-a', stageId: 'stage-fitting', storagePath: 'ateliers/atelier-a/orders/order-a/production/photo-upload',
        visibleToClient: false, uploadStatus: 'pending', uploadedBy: 'member-a', contentType: 'image/png',
      }),
      setDoc(doc(db, 'ateliers/atelier-demo/orders/demo-order'), { clientId: 'demo-client', email: 'demo@example.invalid', status: 'confirmed' }),
      setDoc(doc(db, 'ateliers/atelier-demo/orders/demo-order/photos/demo-upload'), {
        atelierId: 'atelier-demo', orderId: 'demo-order', stageId: 'stage-demo', storagePath: 'ateliers/atelier-demo/orders/demo-order/production/demo-upload',
        visibleToClient: false, uploadStatus: 'pending', uploadedBy: 'demo-owner', contentType: 'image/png',
      }),
      setDoc(doc(db, 'ateliers/atelier-suspended/members/suspended-member'), { active: true, role: 'owner', permissions: [] }),
      setDoc(doc(db, 'ateliers/atelier-suspended/quoteRequests/request-suspended'), { email: 'client@example.com', status: 'new' }),
      setDoc(doc(db, 'users/platform-admin'), { accountType: 'platform_admin', active: true }),
      setDoc(doc(db, 'users/disabled-admin'), { accountType: 'platform_admin', active: false }),
      setDoc(doc(db, 'auditLogs/log-a'), { actorId: 'platform-admin', action: 'platform.atelier_suspended' }),
    ]);
  });
  await environment.withSecurityRulesDisabled(async (context) => {
    const storage = context.storage();
    await Promise.all([
      uploadBytes(ref(storage, 'ateliers/atelier-a/orders/order-a/production/photo-visible'), new Uint8Array([1, 2, 3]), { contentType: 'image/png' }),
      uploadBytes(ref(storage, 'ateliers/atelier-a/orders/order-a/production/photo-internal'), new Uint8Array([1, 2, 3]), { contentType: 'image/png' }),
      ...demoProtectedFiles.map(([path, contentType]) => uploadBytes(ref(storage, `ateliers/atelier-demo/${path}`), new Uint8Array([1, 2, 3]), { contentType })),
    ]);
  });
});

describe('Firestore and Storage tenant rules', () => {
  it('keeps public slug mappings private and routes intake writes through the trusted backend', async () => {
    const guest = environment.unauthenticatedContext().firestore();
    const validRequest = {
      clientId: null, name: 'Cliente Cosmaker', email: 'client@example.com', character: 'Personagem', franchise: 'Franquia',
      category: 'full_cosplay', description: 'Solicitação pública de orçamento suficientemente detalhada.',
      desiredDeliveryDate: '2027-07-14', urgency: 'normal', status: 'new',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    await assertFails(getDoc(doc(guest, 'publicAtelierSlugs/atelier-a')));
    await assertFails(getDoc(doc(guest, 'publicAteliers/atelier-a')));
    await assertFails(setDoc(doc(guest, 'publicAtelierSlugs/forged'), { slug: 'forged', atelierId: 'atelier-b' }));
    await assertFails(setDoc(doc(guest, 'ateliers/atelier-a/quoteRequests/new-request'), validRequest));
    await assertFails(setDoc(doc(guest, 'ateliers/atelier-closed/quoteRequests/new-request'), validRequest));
    await assertFails(setDoc(doc(guest, 'ateliers/atelier-a/quoteRequests/bad-request'), { ...validRequest, status: 'approved' }));
    await assertFails(setDoc(doc(guest, 'ateliers/atelier-a/quoteRequests/tampered-request'), { ...validRequest, atelierId: 'atelier-b' }));
  });

  it('does not let a member of one tenant read another tenant requests', async () => {
    const member = environment.authenticatedContext('member-a').firestore();
    await assertSucceeds(getDoc(doc(member, 'ateliers/atelier-a/quoteRequests/request-a')));
    await assertFails(getDoc(doc(member, 'ateliers/atelier-b/quoteRequests/request-b')));
    await assertFails(getDoc(doc(member, 'ateliers/atelier-b/quoteRequests/request-b/references/ref-b')));
    await assertFails(getDoc(doc(member, 'ateliers/atelier-b/orders/order-b')));
  });

  it('blocks tenant access and public intake while an atelier is suspended', async () => {
    const member = environment.authenticatedContext('suspended-member').firestore();
    await assertFails(getDoc(doc(member, 'ateliers/atelier-suspended/quoteRequests/request-suspended')));
    const guest = environment.unauthenticatedContext().firestore();
    const request = {
      clientId: null, name: 'Cliente Cosmaker', email: 'client@example.com', character: 'Personagem', franchise: 'Franquia',
      category: 'full_cosplay', description: 'Solicitação pública de orçamento suficientemente detalhada.',
      desiredDeliveryDate: '2027-07-14', urgency: 'normal', status: 'new',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    await assertFails(setDoc(doc(guest, 'ateliers/atelier-suspended/quoteRequests/new-request'), request));
  });

  it('restricts platform audit records to active platform administrators', async () => {
    const administrator = environment.authenticatedContext('platform-admin', { email_verified: true }).firestore();
    await assertSucceeds(getDoc(doc(administrator, 'auditLogs/log-a')));
    const disabledAdministrator = environment.authenticatedContext('disabled-admin', { email_verified: true, platformAdmin: true }).firestore();
    await assertFails(getDoc(doc(disabledAdministrator, 'auditLogs/log-a')));
    const unverifiedAdministrator = environment.authenticatedContext('platform-admin', { email_verified: false, platformAdmin: true }).firestore();
    await assertFails(getDoc(doc(unverifiedAdministrator, 'auditLogs/log-a')));
    const client = environment.authenticatedContext('client-a').firestore();
    await assertFails(getDoc(doc(client, 'auditLogs/log-a')));
  });

  it('lets a verified matching client read a quote but never change its commercial status or total', async () => {
    const client = environment.authenticatedContext('client-a', { email: 'CLIENT@example.com', email_verified: true }).firestore();
    const quoteRef = doc(client, 'ateliers/atelier-a/quotes/quote-a');
    await assertSucceeds(getDoc(quoteRef));
    await assertFails(updateDoc(quoteRef, { status: 'approved', total: 1 }));
    const otherClient = environment.authenticatedContext('client-b', { email: 'other@example.com', email_verified: true }).firestore();
    await assertFails(getDoc(doc(otherClient, 'ateliers/atelier-a/quotes/quote-a')));
    await assertFails(getDoc(doc(client, 'ateliers/atelier-b/orders/order-b')));
  });

  it('keeps finance records unavailable to a quote-only member', async () => {
    const reader = environment.authenticatedContext('finance-reader').firestore();
    await assertFails(getDoc(doc(reader, 'ateliers/atelier-a/transactions/transaction-a')));
  });

  it('limits order and measurement access to the assigned team and the verified client', async () => {
    const memberWithoutOrderAccess = environment.authenticatedContext('no-order-access').firestore();
    await assertFails(getDoc(doc(memberWithoutOrderAccess, 'ateliers/atelier-a/orders/order-a')));
    const client = environment.authenticatedContext('client-a', { email: 'client@example.com', email_verified: true }).firestore();
    await assertSucceeds(getDoc(doc(client, 'ateliers/atelier-a/orders/order-a/measurementSnapshot/chest')));
    const orders = await getDocs(query(collectionGroup(client, 'orders'), where('email', '==', 'client@example.com'), orderBy('createdAt', 'desc')));
    expect(orders.size).toBe(1);
    await assertSucceeds(getDoc(doc(client, 'ateliers/atelier-a/measurementProfiles/profile-a')));
    await assertFails(getDoc(doc(client, 'ateliers/atelier-a/measurementProfiles/profile-b')));
    await assertSucceeds(setDoc(doc(client, 'ateliers/atelier-a/measurementProfiles/profile-a/measurements/height'), {
      type: 'length', label: 'Altura', value: 165, unit: 'cm', notes: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
    await assertFails(setDoc(doc(client, 'ateliers/atelier-a/measurementProfiles/profile-b/measurements/height'), {
      type: 'length', label: 'Altura', value: 165, unit: 'cm',
    }));
  });

  it('makes order state server-managed and exposes only client-approved production photos', async () => {
    const member = environment.authenticatedContext('member-a').firestore();
    const client = environment.authenticatedContext('client-a', { email: 'client@example.com', email_verified: true }).firestore();
    const order = doc(member, 'ateliers/atelier-a/orders/order-a');
    await assertFails(updateDoc(order, { status: 'completed' }));
    await assertFails(updateDoc(doc(member, 'ateliers/atelier-a/orders/order-a/payments/deposit'), { status: 'paid' }));
    await assertFails(updateDoc(doc(member, 'ateliers/atelier-a/orders/order-a/productionStages/stage-fitting'), { status: 'completed' }));
    await assertFails(updateDoc(doc(client, 'ateliers/atelier-a/orders/order-a/approvals/approval-a'), { status: 'approved' }));
    await assertSucceeds(getDoc(doc(client, 'ateliers/atelier-a/orders/order-a/photos/photo-visible')));
    await assertFails(getDoc(doc(client, 'ateliers/atelier-a/orders/order-a/photos/photo-internal')));
    await assertSucceeds(getDoc(doc(client, 'ateliers/atelier-a/orders/order-a/productionStages/stage-fitting')));
  });

  it('limits public reference uploads to image types and enabled public intake', async () => {
    const guest = environment.unauthenticatedContext().storage();
    await assertSucceeds(uploadBytes(ref(guest, 'ateliers/atelier-a/quoteRequests/request-a/references/ref-a'), new Uint8Array([1, 2, 3]), { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(guest, 'ateliers/atelier-a/quoteRequests/request-a/references/ref.html'), new Uint8Array([1, 2, 3]), { contentType: 'text/html' }));
    await assertFails(uploadBytes(ref(guest, 'ateliers/atelier-closed/quoteRequests/request-closed/references/ref.png'), new Uint8Array([1, 2, 3]), { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(guest, 'ateliers/atelier-unpublished-intake/quoteRequests/request-unpublished/references/ref-unpublished'), new Uint8Array([1, 2, 3]), { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(guest, 'ateliers/atelier-suspended/quoteRequests/request-suspended/references/ref.png'), new Uint8Array([1, 2, 3]), { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(guest, 'ateliers/atelier-b/quoteRequests/request-a/references/ref-a'), new Uint8Array([1, 2, 3]), { contentType: 'image/png' }));
  });

  it('keeps commercial records server-managed and protects the demo marker', async () => {
    const owner = environment.authenticatedContext('member-a').firestore();
    await assertFails(getDoc(doc(owner, 'ateliers/atelier-a/commercial/state')));
    await assertFails(setDoc(doc(owner, 'ateliers/atelier-a/commercial/state'), { planId: 'premium', subscriptionStatus: 'active' }));
    await assertFails(setDoc(doc(owner, 'ateliers/atelier-a/commercial/config'), { featureConfig: { 'test_only.operation_probe': true } }));
    await assertFails(setDoc(doc(owner, 'ateliers/atelier-a/commercialUsage/test-only-operation-probe'), { count: 999 }));
    await assertFails(updateDoc(doc(owner, 'ateliers/atelier-a'), { demoWorkspace: true }));
    await assertFails(updateDoc(doc(owner, 'ateliers/atelier-a'), { plan: 'premium', subscriptionStatus: 'active' }));
    await assertSucceeds(updateDoc(doc(owner, 'ateliers/atelier-a'), { name: 'Nome editado pelo proprietário' }));
  });

  it('restricts production image uploads to assigned staff and serves only visible photos to clients', async () => {
    const member = environment.authenticatedContext('member-a').storage();
    const client = environment.authenticatedContext('client-a', { email: 'client@example.com', email_verified: true }).storage();
    const visiblePath = 'ateliers/atelier-a/orders/order-a/production/photo-visible';
    const privatePath = 'ateliers/atelier-a/orders/order-a/production/photo-internal';
    const pendingPath = 'ateliers/atelier-a/orders/order-a/production/photo-upload';
    await assertSucceeds(uploadBytes(ref(member, pendingPath), new Uint8Array([1, 2, 3]), {
      contentType: 'image/png', customMetadata: { photoId: 'photo-upload', orderId: 'order-a' },
    }));
    await assertSucceeds(getBytes(ref(client, visiblePath)));
    await assertFails(getBytes(ref(client, privatePath)));
    await assertFails(uploadBytes(ref(client, 'ateliers/atelier-a/orders/order-a/production/unauthorized'), new Uint8Array([1]), {
      contentType: 'image/png', customMetadata: { photoId: 'unauthorized', orderId: 'order-a' },
    }));
    const demoOwner = environment.authenticatedContext('demo-owner').storage();
    await assertFails(uploadBytes(ref(demoOwner, 'ateliers/atelier-demo/orders/demo-order/production/demo-upload'), new Uint8Array([1, 2, 3]), {
      contentType: 'image/png', customMetadata: { photoId: 'demo-upload', orderId: 'demo-order' },
    }));
  });

  it('preserves demo file reads while denying create, update and deletion of sensitive files', async () => {
    const storage = environment.authenticatedContext('demo-owner').storage();
    for (const [path, contentType] of demoProtectedFiles) {
      const existing = ref(storage, `ateliers/atelier-demo/${path}`);
      await assertSucceeds(getBytes(existing));
      await assertFails(uploadBytes(existing, new Uint8Array([4, 5, 6]), { contentType }));
      await assertFails(uploadBytes(ref(storage, `ateliers/atelier-demo/${path}-new`), new Uint8Array([4, 5, 6]), { contentType }));
      await assertFails(deleteObject(existing));
      await assertSucceeds(getBytes(existing));
    }
  });

  it('keeps non-demo document and logistical writes available to the existing authorized tenant', async () => {
    const storage = environment.authenticatedContext('member-a').storage();
    for (const path of ['contracts/new.pdf', 'invoices/new.pdf', 'orders/order-a/shipping/new.pdf', 'orders/order-a/documents/new.pdf']) {
      const ownFile = ref(storage, `ateliers/atelier-a/${path}`);
      await assertSucceeds(uploadBytes(ownFile, new Uint8Array([1, 2, 3]), { contentType: 'application/pdf' }));
      await assertSucceeds(deleteObject(ownFile));
      await assertFails(uploadBytes(ref(storage, `ateliers/atelier-b/${path}`), new Uint8Array([1, 2, 3]), { contentType: 'application/pdf' }));
    }
  });
});
