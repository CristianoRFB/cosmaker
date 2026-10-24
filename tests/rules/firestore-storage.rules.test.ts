import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
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
      setDoc(doc(db, 'users/member-a'), { active: true, accountType: 'atelier_member', atelierId: 'atelier-a' }),
      ...[['member-b', 'atelier-b'], ['finance-reader', 'atelier-a'], ['no-order-access', 'atelier-a'], ['suspended-member', 'atelier-suspended']].map(([id, atelierId]) => setDoc(doc(db, `users/${id}`), { active: true, accountType: 'atelier_member', atelierId })),
      setDoc(doc(db, 'users/client-a'), { active: true, accountType: 'client' }),
      setDoc(doc(db, 'users/client-b'), { active: true, accountType: 'client' }),
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
  it('validates client profile creation without granting roles, tenant authority or other-user access', async () => {
    const db = environment.authenticatedContext('new-client', { email: 'new@example.test', email_verified: false }).firestore();
    const profile = { name: 'Cliente sintético', email: 'new@example.test', accountType: 'client', role: 'client', permissions: [], active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    const ref = doc(db, 'users/new-client');
    for (const extra of [{ name: 123 }, { name: 'x'.repeat(257) }, { email: 'other@example.test' }, { phone: ['000'] }, { phone: 'x'.repeat(33) }, { photoURL: 'javascript:alert(1)' }, { photoURL: 'https://' + 'x'.repeat(2048) }, { role: 'owner' }, { accountType: 'platform_admin' }, { platformAdmin: true }, { atelierId: 'atelier-a' }, { permissions: ['finance:write'] }, { id: 'member-a' }, { active: false }, { createdAt: new Date(0) }, { updatedAt: 'invalid' }]) await assertFails(setDoc(ref, { ...profile, ...extra }));
    const { name: omittedName, ...withoutName } = profile; void omittedName;
    await assertFails(setDoc(ref, withoutName));
    await assertSucceeds(setDoc(ref, profile));
    await assertSucceeds(getDoc(ref));
    await assertFails(getDoc(doc(db, 'users/member-a')));
    await assertFails(setDoc(doc(db, 'users/other-client'), profile));
  });

  it('validates own presentation updates while keeping authority and immutable timestamps unchanged', async () => {
    await environment.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), 'users/client-a'), { name: 'Cliente sintético', email: 'client@example.com', accountType: 'client', role: 'client', permissions: [], active: true, createdAt: new Date(0) }));
    const db = environment.authenticatedContext('client-a', { email: 'client@example.com', email_verified: true }).firestore(); const ref = doc(db, 'users/client-a');
    await assertSucceeds(updateDoc(ref, { name: 'Novo nome sintético', phone: '000000000', photoURL: 'https://example.invalid/avatar.png', updatedAt: serverTimestamp() }));
    for (const patch of [{ name: {} }, { name: '' }, { name: 'x'.repeat(257) }, { phone: 123 }, { phone: 'x'.repeat(33) }, { photoURL: 'data:private' }, { photoURL: 123 }, { email: 'someone@example.com' }, { updatedAt: new Date(0) }, { createdAt: new Date() }, { role: 'owner' }, { accountType: 'platform_admin' }, { active: false }, { permissions: ['quotes:write'] }, { atelierId: 'atelier-a' }, { extraData: 'pollution' }]) await assertFails(updateDoc(ref, patch));
    await assertFails(deleteDoc(ref));
    await assertFails(getDoc(doc(db, 'users/client-b')));
    // Unchanged legacy presentation cannot become an authority bypass or block a bounded correction.
    await environment.withSecurityRulesDisabled((context) => updateDoc(doc(context.firestore(), 'users/client-a'), { name: 1 }));
    await assertSucceeds(updateDoc(ref, { phone: '', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { name: 'Perfil corrigido', updatedAt: serverTimestamp() }));
  });

  it('validates measurement schema for staff and clients on both create and update', async () => {
    const staff = environment.authenticatedContext('member-a', { email_verified: true }).firestore();
    const client = environment.authenticatedContext('client-a', { email_verified: true }).firestore();
    const root = 'ateliers/atelier-a/measurementProfiles/profile-a/measurements';
    const valid = { type: 'circumference', label: 'Tórax sintético', value: 88, unit: 'cm', notes: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    for (const db of [staff, client]) {
      const ref = doc(db, `${root}/new-measurement`);
      for (const patch of [{ value: -1 }, { value: 100001 }, { value: '88' }, { value: NaN }, { value: Infinity }, { label: 'x'.repeat(101) }, { notes: 'x'.repeat(501) }, { type: 'x'.repeat(81) }, { unit: 'x'.repeat(21) }, { extraData: 'pollution' }, { createdAt: new Date(0) }, { updatedAt: 'invalid' }]) await assertFails(setDoc(ref, { ...valid, ...patch }));
      await assertSucceeds(setDoc(ref, valid));
      for (const patch of [{ value: 'invalid' }, { notes: 'x'.repeat(501) }, { label: 'x'.repeat(101) }, { createdAt: new Date(0) }, { updatedAt: 'invalid' }, { storagePath: 'ateliers/atelier-b/private' }]) await assertFails(updateDoc(ref, patch));
      await assertSucceeds(updateDoc(ref, { value: 90, notes: 'Correção sintética', updatedAt: serverTimestamp() }));
      await environment.withSecurityRulesDisabled((context) => deleteDoc(doc(context.firestore(), ref.path)));
    }
    await assertFails(setDoc(doc(staff, 'ateliers/atelier-a/measurementProfiles/missing/measurements/orphan'), valid));
    const other = environment.authenticatedContext('member-b', { email_verified: true }).firestore();
    await assertFails(setDoc(doc(other, `${root}/other-tenant`), valid));
    await assertFails(setDoc(doc(client, 'ateliers/atelier-a/measurementProfiles/profile-b/measurements/foreign'), valid));
  });

  it('keeps measurement profile ownership immutable and validates all staff profile writes', async () => {
    const staff = environment.authenticatedContext('member-a', { email_verified: true }).firestore(); const ref = doc(staff, 'ateliers/atelier-a/measurementProfiles/new-profile');
    const valid = { clientId: 'client-a', name: 'Ficha sintética', active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    for (const patch of [{ clientId: 'missing' }, { clientId: '../client-b' }, { clientId: 123 }, { name: 'x'.repeat(101) }, { name: '' }, { active: 'true' }, { createdAt: new Date(0) }, { extraData: 'pollution' }]) await assertFails(setDoc(ref, { ...valid, ...patch }));
    await assertSucceeds(setDoc(ref, valid));
    for (const patch of [{ clientId: 'client-b' }, { name: 'x'.repeat(101) }, { active: 1 }, { createdAt: new Date(0) }, { updatedAt: new Date(0) }, { extraData: 'pollution' }]) await assertFails(updateDoc(ref, patch));
    await assertSucceeds(updateDoc(ref, { name: 'Ficha revisada', active: false, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(ref));
  });

  it('closes quote collection-group/email grants and subcollections while keeping active staff queries', async () => {
    const root = 'ateliers/atelier-a';
    await environment.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await Promise.all(['items/item-a', 'approvedItems/item-a', 'responses/reply-a'].map((path) => setDoc(doc(db, `${root}/quotes/quote-a/${path}`), { privateNotes: 'PRIVATE', actorId: 'client-a' })));
      await setDoc(doc(db, 'foreign/namespace/quotes/quote-forged'), { email: 'client@example.com', status: 'sent' });
    });
    const staff = environment.authenticatedContext('member-a', { email_verified: true }).firestore();
    await assertSucceeds(getDocs(collection(staff, `${root}/quotes`)));
    for (const context of [environment.unauthenticatedContext(), environment.authenticatedContext('client-a', { email: 'client@example.com', email_verified: true }), environment.authenticatedContext('client-b', { email: 'client@example.com', email_verified: true }), environment.authenticatedContext('member-b', { email_verified: true }), environment.authenticatedContext('platform-admin', { email_verified: true, platformAdmin: true })]) {
      const db = context.firestore();
      await assertFails(getDocs(query(collectionGroup(db, 'quotes'), where('email', '==', 'client@example.com'), where('status', 'in', ['sent', 'approved', 'rejected', 'expired']))));
      for (const path of ['quotes/quote-a', 'quotes/quote-a/items/item-a', 'quotes/quote-a/approvedItems/item-a', 'quotes/quote-a/responses/reply-a', 'quoteRequests/request-a', 'quoteRequests/request-a/references/ref-a']) await assertFails(getDoc(doc(db, `${root}/${path}`)));
      await assertFails(getDoc(doc(db, 'foreign/namespace/quotes/quote-forged')));
    }
  });

  it('revokes raw domain reads immediately for inactive, mismatched or unverified profiles', async () => {
    const staff = environment.authenticatedContext('member-a', { email_verified: true }).firestore();
    const paths = ['quotes/quote-a', 'quoteRequests/request-a', 'quoteRequests/request-a/references/ref-a', 'members/member-b', 'measurementProfiles/profile-a', 'transactions/transaction-a'];
    for (const path of paths) await assertSucceeds(getDoc(doc(staff, `ateliers/atelier-a/${path}`)));
    for (const patch of [{ active: false }, { accountType: 'client' }, { atelierId: 'atelier-b' }]) {
      await environment.withSecurityRulesDisabled((context) => updateDoc(doc(context.firestore(), 'users/member-a'), patch));
      for (const path of paths) await assertFails(getDoc(doc(staff, `ateliers/atelier-a/${path}`)));
      await environment.withSecurityRulesDisabled((context) => updateDoc(doc(context.firestore(), 'users/member-a'), { active: true, accountType: 'atelier_member', atelierId: 'atelier-a' }));
    }
    const unverified = environment.authenticatedContext('member-a', { email_verified: false }).firestore();
    for (const path of paths) await assertFails(getDoc(doc(unverified, `ateliers/atelier-a/${path}`)));
    const client = environment.authenticatedContext('client-a', { email_verified: true }).firestore();
    await assertSucceeds(getDoc(doc(client, 'ateliers/atelier-a/measurementProfiles/profile-a')));
    await environment.withSecurityRulesDisabled((context) => updateDoc(doc(context.firestore(), 'users/client-a'), { active: false }));
    await assertFails(getDoc(doc(client, 'ateliers/atelier-a/clients/client-a')));
    await assertFails(updateDoc(doc(client, 'ateliers/atelier-a/measurementProfiles/profile-a/measurements/chest'), { value: 99 }));
  });

  it('revokes order reads for inactive profiles, unverified staff and suspended tenants', async () => {
    const customer = environment.authenticatedContext('client-a', { email: 'client@example.com', email_verified: true }).firestore();
    const staff = environment.authenticatedContext('member-a', { email_verified: true }).firestore();
    const unverifiedStaff = environment.authenticatedContext('member-a', { email_verified: false }).firestore();
    await assertSucceeds(getDoc(doc(customer, 'ateliers/atelier-a/orders/order-a')));
    await assertSucceeds(getDoc(doc(staff, 'ateliers/atelier-a/orders/order-a')));
    await assertFails(getDoc(doc(unverifiedStaff, 'ateliers/atelier-a/orders/order-a')));
    await environment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'users/client-a'), { active: false });
      await updateDoc(doc(context.firestore(), 'users/member-a'), { active: false });
    });
    await assertFails(getDoc(doc(customer, 'ateliers/atelier-a/orders/order-a/measurementSnapshot/chest')));
    await assertFails(getDoc(doc(staff, 'ateliers/atelier-a/orders/order-a')));
    await assertFails(getDoc(doc(staff, 'ateliers/atelier-a/orders/order-a/files/private')));
    await environment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'users/client-a'), { active: true });
      await updateDoc(doc(context.firestore(), 'ateliers/atelier-a'), { active: false });
    });
    await assertFails(getDoc(doc(customer, 'ateliers/atelier-a/orders/order-a')));
  });

  it('rejects a recycled email and conflicting UID links when reading an order and its private metadata', async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'ateliers/atelier-a/orders/order-a'), { clientUserId: 'client-a', email: 'reused@example.com' });
    });
    const reassignedEmail = environment.authenticatedContext('client-b', { email: 'reused@example.com', email_verified: true }).firestore();
    const actualClient = environment.authenticatedContext('client-a', { email: 'new-client@example.com', email_verified: true }).firestore();
    await assertFails(getDoc(doc(reassignedEmail, 'ateliers/atelier-a/orders/order-a')));
    for (const path of ['photos/photo-visible', 'payments/deposit', 'measurementSnapshot/chest', 'approvals/approval-a']) {
      await assertFails(getDoc(doc(reassignedEmail, `ateliers/atelier-a/orders/order-a/${path}`)));
    }
    await assertSucceeds(getDoc(doc(actualClient, 'ateliers/atelier-a/orders/order-a')));
    await environment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'ateliers/atelier-a/orders/order-a'), { clientUserId: 'client-b' });
    });
    await assertFails(getDoc(doc(actualClient, 'ateliers/atelier-a/orders/order-a')));
    await assertFails(getDoc(doc(reassignedEmail, 'ateliers/atelier-a/orders/order-a')));
  });

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
    const member = environment.authenticatedContext('member-a', { email_verified: true }).firestore();
    await assertSucceeds(getDoc(doc(member, 'ateliers/atelier-a/quoteRequests/request-a')));
    await assertFails(getDoc(doc(member, 'ateliers/atelier-b/quoteRequests/request-b')));
    await assertFails(getDoc(doc(member, 'ateliers/atelier-b/quoteRequests/request-b/references/ref-b')));
    await assertFails(getDoc(doc(member, 'ateliers/atelier-b/orders/order-b')));
  });

  it('blocks tenant access and public intake while an atelier is suspended', async () => {
    const member = environment.authenticatedContext('suspended-member', { email_verified: true }).firestore();
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

  it('denies raw quotes even with matching verified email; client projections are server-only', async () => {
    const client = environment.authenticatedContext('client-a', { email: 'CLIENT@example.com', email_verified: true }).firestore();
    const quoteRef = doc(client, 'ateliers/atelier-a/quotes/quote-a');
    await assertFails(getDoc(quoteRef));
    await assertFails(updateDoc(quoteRef, { status: 'approved', total: 1 }));
    const otherClient = environment.authenticatedContext('client-b', { email: 'other@example.com', email_verified: true }).firestore();
    await assertFails(getDoc(doc(otherClient, 'ateliers/atelier-a/quotes/quote-a')));
    await assertFails(getDoc(doc(client, 'ateliers/atelier-b/orders/order-b')));
  });

  it('keeps operational preferences and settings idempotency records server-managed', async () => {
    const paths = ['ateliers/atelier-a/preferences/operations', 'ateliers/atelier-a/settingsOperations/op-a'];
    await environment.withSecurityRulesDisabled(async (context) => {
      await Promise.all(paths.map((path) => setDoc(doc(context.firestore(), path), { timezone: 'UTC', version: 1, fingerprint: 'protected' })));
    });
    for (const context of [environment.unauthenticatedContext(), environment.authenticatedContext('member-a', { email_verified: true }), environment.authenticatedContext('member-b', { email_verified: true }), environment.authenticatedContext('client-a', { email_verified: true })]) {
      const db = context.firestore();
      for (const path of paths) {
        await assertFails(getDoc(doc(db, path)));
        await assertFails(setDoc(doc(db, path + '-new'), { version: 999, timezone: 'UTC' }));
        await assertFails(updateDoc(doc(db, path), { version: 999 }));
        await assertFails(deleteDoc(doc(db, path)));
      }
      await assertFails(getDocs(collection(db, 'ateliers/atelier-a/preferences')));
      await assertFails(getDocs(collection(db, 'ateliers/atelier-a/settingsOperations')));
    }
  });

  it('keeps message participants, history, read cursors and personal notifications callable-only', async () => {
    const paths = ['ateliers/atelier-a/conversations/order-a', 'ateliers/atelier-a/conversations/order-a/messages/message-a', 'ateliers/atelier-a/conversations/order-a/operations/op-a', 'ateliers/atelier-a/conversations/order-a/reads/client-a', 'ateliers/atelier-a/notifications/notice-a', 'ateliers/atelier-a/orders/order-a/messages/legacy-a', 'ateliers/atelier-a/orders/order-a/lifecycleOperations/op-a'];
    await environment.withSecurityRulesDisabled(async (context) => {
      await Promise.all(paths.map((path) => setDoc(doc(context.firestore(), path), { clientUserId: 'client-a', userId: 'client-a', senderId: 'member-a', read: false, sequence: 1 })));
    });
    for (const context of [environment.unauthenticatedContext(), environment.authenticatedContext('member-a', { email_verified: true }), environment.authenticatedContext('client-a', { email: 'client@example.com', email_verified: true }), environment.authenticatedContext('member-b', { email_verified: true })]) {
      const db = context.firestore();
      for (const path of paths) {
        await assertFails(getDoc(doc(db, path)));
        await assertFails(setDoc(doc(db, path + '-new'), { clientUserId: 'client-a', senderId: 'member-a', userId: 'client-a', text: 'Mensagem falsificada' }));
        await assertFails(updateDoc(doc(db, path), { clientUserId: 'member-b', senderId: 'client-a', read: true, sequence: 999999 }));
        await assertFails(deleteDoc(doc(db, path)));
      }
      await assertFails(getDocs(collection(db, 'ateliers/atelier-a/conversations')));
      await assertFails(getDocs(collection(db, 'ateliers/atelier-a/notifications')));
    }
  });

  it('routes showcase content and image bytes through tenant-aware projections instead of raw public documents', async () => {
    const paths = ['ateliers/atelier-a/portfolio/project-public', 'ateliers/atelier-a/services/service-public', 'publicAteliers/atelier-a/portfolio/project-public', 'ateliers/atelier-a/showcaseOperations/op-a'];
    const image = 'ateliers/atelier-a/portfolio/project-public/images/image-a';
    const legacyImage = 'ateliers/atelier-a/portfolio/project-public/legacy.png';
    await environment.withSecurityRulesDisabled(async (context) => {
      await Promise.all(paths.map((path) => setDoc(doc(context.firestore(), path), { public: true, active: true, title: 'Público', internalNotes: 'PRIVATE' })));
      await uploadBytes(ref(context.storage(), image), new Uint8Array([1, 2, 3]), { contentType: 'image/png' });
      await uploadBytes(ref(context.storage(), legacyImage), new Uint8Array([1, 2, 3]), { contentType: 'image/png' });
    });
    const contexts = [environment.unauthenticatedContext(), environment.authenticatedContext('member-a', { email_verified: true }), environment.authenticatedContext('member-b', { email_verified: true }), environment.authenticatedContext('client-a', { email_verified: true })];
    for (const context of contexts) {
      for (const path of paths) {
        await assertFails(getDoc(doc(context.firestore(), path)));
        await assertFails(setDoc(doc(context.firestore(), path), { public: true, actorId: 'forged', title: 'x'.repeat(10000) }));
        await assertFails(updateDoc(doc(context.firestore(), path), { public: true, atelierId: 'atelier-b' }));
        await assertFails(deleteDoc(doc(context.firestore(), path)));
      }
      await assertFails(getBytes(ref(context.storage(), image)));
      await assertFails(uploadBytes(ref(context.storage(), image), new Uint8Array([4]), { contentType: 'image/png' }));
      await assertFails(deleteObject(ref(context.storage(), image)));
    }
    await assertFails(getBytes(ref(environment.unauthenticatedContext().storage(), legacyImage)));
    await assertFails(getDocs(collection(environment.unauthenticatedContext().firestore(), 'ateliers/atelier-a/portfolio')));
    await assertFails(getDocs(collection(environment.unauthenticatedContext().firestore(), 'publicAteliers/atelier-a/portfolio')));
  });

  it('keeps financial ledger, compensation locks and legacy mutations server-managed', async () => {
    const root = 'ateliers/atelier-a';
    const paths = ['financeEntries/entry-a', 'financeOperations/operation-a', 'financeReversals/entry-a', 'financePaymentReferences/reference-a'];
    await environment.withSecurityRulesDisabled(async (context) => {
      await Promise.all([...paths, 'expenses/expense-a'].map((path) => setDoc(doc(context.firestore(), `${root}/${path}`), { amountCents: 1000, actorId: 'member-a' })));
    });
    const owner = environment.authenticatedContext('member-a', { email_verified: true }).firestore();
    const other = environment.authenticatedContext('member-b', { email_verified: true }).firestore();
    const client = environment.authenticatedContext('client-a', { email_verified: true }).firestore();
    const guest = environment.unauthenticatedContext().firestore();
    for (const path of paths) {
      for (const db of [owner, other, client, guest]) {
        await assertFails(getDoc(doc(db, `${root}/${path}`)));
        await assertFails(setDoc(doc(db, `${root}/${path}`), { amountCents: -1, actorId: 'forged' }));
        await assertFails(updateDoc(doc(db, `${root}/${path}`), { actorId: 'forged', amountCents: 'invalid', createdAt: new Date(0) }));
        await assertFails(deleteDoc(doc(db, `${root}/${path}`)));
      }
    }
    await assertFails(getDocs(collection(guest, `${root}/financeEntries`)));
    for (const path of ['transactions/transaction-a', 'expenses/expense-a']) {
      await assertSucceeds(getDoc(doc(owner, `${root}/${path}`)));
      await assertFails(updateDoc(doc(owner, `${root}/${path}`), { amountCents: 99 }));
      await assertFails(setDoc(doc(owner, `${root}/${path}-new`), { amountCents: 99 }));
      await assertFails(deleteDoc(doc(owner, `${root}/${path}`)));
      await assertFails(getDoc(doc(other, `${root}/${path}`)));
      await assertFails(getDoc(doc(client, `${root}/${path}`)));
      await assertFails(getDoc(doc(environment.authenticatedContext('member-a', { email_verified: false }).firestore(), `${root}/${path}`)));
    }
    await environment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'users/member-a'), { active: false });
    });
    await assertFails(getDoc(doc(owner, `${root}/transactions/transaction-a`)));
  });

  it('keeps finance records unavailable to a quote-only member', async () => {
    const reader = environment.authenticatedContext('finance-reader', { email_verified: true }).firestore();
    await assertFails(getDoc(doc(reader, 'ateliers/atelier-a/transactions/transaction-a')));
  });

  it('requires Functions for schedule, capacity, block and event mutations', async () => {
    const owner = environment.authenticatedContext('member-a', { email_verified: true }).firestore();
    const date = '2027-05-10';
    const slot = { atelierId: 'atelier-a', date, status: 'scheduled', assignedTo: 'member-a', plannedHours: 2 };
    const block = { atelierId: 'atelier-a', memberId: 'member-a', date, status: 'active', allDay: true };
    const event = { atelierId: 'atelier-a', title: 'Evento fictício', type: 'convention', startDate: date, endDate: date, status: 'active' };
    await assertFails(setDoc(doc(owner, 'ateliers/atelier-a/productionSlots/slot-direct'), slot));
    await assertFails(setDoc(doc(owner, 'ateliers/atelier-a/productionSlots/slot-direct/allocations/allocation-direct'), { plannedHours: 1 }));
    await assertFails(setDoc(doc(owner, 'ateliers/atelier-a/scheduleBlocks/block-direct'), block));
    await assertFails(setDoc(doc(owner, 'ateliers/atelier-a/teamCapacity/member-a'), { weeklyHoursByWeekday: { '1': 8 } }));
    await assertFails(setDoc(doc(owner, 'ateliers/atelier-a/scheduleDays/member-a_2027-05-10'), { allocatedHours: 1 }));
    await assertFails(setDoc(doc(owner, 'ateliers/atelier-a/events/event-direct'), event));
  });

  it('routes staff client access through callables and allows a customer to read only their own profile', async () => {
    const member = environment.authenticatedContext('member-a', { email_verified: true }).firestore();
    const ownClient = environment.authenticatedContext('client-a', { email: 'client@example.com', email_verified: true }).firestore();
    const otherClient = environment.authenticatedContext('client-b', { email: 'other@example.com', email_verified: true }).firestore();
    const clientPath = 'ateliers/atelier-a/clients/client-a';
    await assertFails(getDoc(doc(member, clientPath)));
    await assertFails(getDocs(collection(member, 'ateliers/atelier-a/clients')));
    await assertFails(setDoc(doc(member, 'ateliers/atelier-a/clients/new-client'), { name: 'Ignora auditoria' }));
    await assertFails(updateDoc(doc(member, clientPath), { email: 'changed@example.com' }));
    await assertSucceeds(getDoc(doc(ownClient, clientPath)));
    await assertFails(getDoc(doc(otherClient, clientPath)));
    await assertFails(getDoc(doc(ownClient, 'ateliers/atelier-b/clients/client-a')));
  });

  it('limits order and measurement access to the assigned team and the verified client', async () => {
    const memberWithoutOrderAccess = environment.authenticatedContext('no-order-access', { email_verified: true }).firestore();
    await assertFails(getDoc(doc(memberWithoutOrderAccess, 'ateliers/atelier-a/orders/order-a')));
    const client = environment.authenticatedContext('client-a', { email: 'client@example.com', email_verified: true }).firestore();
    await assertSucceeds(getDoc(doc(client, 'ateliers/atelier-a/orders/order-a/measurementSnapshot/chest')));
    await assertFails(getDocs(query(collectionGroup(client, 'orders'), where('email', '==', 'client@example.com'), orderBy('createdAt', 'desc'))));
    await assertSucceeds(getDoc(doc(client, 'ateliers/atelier-a/orders/order-a')));
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
    const member = environment.authenticatedContext('member-a', { email_verified: true }).firestore();
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

  it('keeps inventory balances, reservations, SKU indexes and movement ledger server-managed', async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await Promise.all([
        setDoc(doc(db, 'ateliers/atelier-a/materials/material-a'), { name: 'Lona', onHandMilli: 5000, reservedMilli: 1000 }),
        setDoc(doc(db, 'ateliers/atelier-a/suppliers/supplier-a'), { name: 'Fornecedor' }),
        setDoc(doc(db, 'ateliers/atelier-a/inventoryMovements/movement-a'), { materialId: 'material-a', kind: 'receive' }),
        setDoc(doc(db, 'ateliers/atelier-a/inventoryReservations/reservation-a'), { materialId: 'material-a', status: 'active' }),
        setDoc(doc(db, 'ateliers/atelier-a/orders/order-a/materialRequirements/material-a'), { plannedMilli: 5000 }),
      ]);
    });
    const owner = environment.authenticatedContext('member-a', { email_verified: true }).firestore();
    const material = doc(owner, 'ateliers/atelier-a/materials/material-a');
    const supplier = doc(owner, 'ateliers/atelier-a/suppliers/supplier-a');
    const movement = doc(owner, 'ateliers/atelier-a/inventoryMovements/movement-a');
    const reservation = doc(owner, 'ateliers/atelier-a/inventoryReservations/reservation-a');
    const requirement = doc(owner, 'ateliers/atelier-a/orders/order-a/materialRequirements/material-a');
    await assertSucceeds(getDoc(material));
    await assertSucceeds(getDoc(movement));
    await assertFails(updateDoc(material, { onHandMilli: 0 }));
    await assertFails(setDoc(doc(owner, 'ateliers/atelier-a/materials/forged'), { name: 'Saldo falso' }));
    await assertFails(deleteDoc(supplier));
    await assertFails(updateDoc(movement, { quantity: 9000 }));
    await assertFails(setDoc(doc(owner, 'ateliers/atelier-a/inventoryMovements/forged'), { kind: 'receive', quantity: 9000 }));
    await assertFails(setDoc(reservation, { materialId: 'material-a', remainingMilli: 999999 }));
    await assertFails(updateDoc(requirement, { plannedMilli: 999999 }));
    await assertFails(setDoc(doc(owner, 'ateliers/atelier-a/inventorySkuIndex/forged'), { materialId: 'forged' }));
  });

  it('denies direct reference bytes and token URLs even for owner and matching client email', async () => {
    const path = 'ateliers/atelier-a/quoteRequests/request-a/references/ref-a';
    await environment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), path), { uploadStatus: 'ready' });
      await uploadBytes(ref(context.storage(), path), new Uint8Array([1, 2, 3]), { contentType: 'image/png' });
    });
    for (const context of [environment.unauthenticatedContext(), environment.authenticatedContext('member-a', { email_verified: true }), environment.authenticatedContext('member-b', { email_verified: true }), environment.authenticatedContext('client-a', { email: 'client@example.com', email_verified: true })]) {
      await assertFails(getBytes(ref(context.storage(), path)));
    }
  });

  it('denies raw public reference uploads after server migration', async () => {
    const guest = environment.unauthenticatedContext().storage();
    await assertFails(uploadBytes(ref(guest, 'ateliers/atelier-a/quoteRequests/request-a/references/ref-a'), new Uint8Array([1, 2, 3]), { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(guest, 'ateliers/atelier-a/quoteRequests/request-a/references/ref.html'), new Uint8Array([1, 2, 3]), { contentType: 'text/html' }));
    await assertFails(uploadBytes(ref(guest, 'ateliers/atelier-closed/quoteRequests/request-closed/references/ref.png'), new Uint8Array([1, 2, 3]), { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(guest, 'ateliers/atelier-unpublished-intake/quoteRequests/request-unpublished/references/ref-unpublished'), new Uint8Array([1, 2, 3]), { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(guest, 'ateliers/atelier-suspended/quoteRequests/request-suspended/references/ref.png'), new Uint8Array([1, 2, 3]), { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(guest, 'ateliers/atelier-b/quoteRequests/request-a/references/ref-a'), new Uint8Array([1, 2, 3]), { contentType: 'image/png' }));
  });

  it('keeps order agreements and production operation ledgers server-managed', async () => {
    const owner = environment.authenticatedContext('member-a', { email_verified: true }).firestore();
    const client = environment.authenticatedContext('client-a', { email: 'client@example.com', email_verified: true }).firestore();
    const root = 'ateliers/atelier-a/orders/order-a';
    const paths = ['productionOperations/op-a', 'changeRequests/change-a', 'changeRequests/change-a/events/event-a', 'agreementVersions/1', 'changeRequestOperations/op-a'];
    await environment.withSecurityRulesDisabled(async (context) => {
      await Promise.all([...paths, 'productionConfigurations/1'].map((path) => setDoc(doc(context.firestore(), `${root}/${path}`), { version: 1 })));
    });
    for (const path of paths) {
      await assertFails(getDoc(doc(owner, `${root}/${path}`)));
      await assertFails(getDoc(doc(client, `${root}/${path}`)));
      await assertFails(setDoc(doc(owner, `${root}/${path}`), { version: 999 }));
      await assertFails(setDoc(doc(client, `${root}/${path}`), { version: 999 }));
    }
    await assertSucceeds(getDoc(doc(owner, `${root}/productionConfigurations/1`)));
    await assertFails(getDoc(doc(client, `${root}/productionConfigurations/1`)));
    await assertFails(updateDoc(doc(owner, `${root}/productionConfigurations/1`), { version: 2 }));
  });

  it('keeps commercial records server-managed and protects the demo marker', async () => {
    const owner = environment.authenticatedContext('member-a', { email_verified: true }).firestore();
    await assertFails(getDoc(doc(owner, 'ateliers/atelier-a/commercial/state')));
    await assertFails(setDoc(doc(owner, 'ateliers/atelier-a/commercial/state'), { planId: 'premium', subscriptionStatus: 'active' }));
    await assertFails(setDoc(doc(owner, 'ateliers/atelier-a/commercial/config'), { featureConfig: { 'test_only.operation_probe': true } }));
    await assertFails(setDoc(doc(owner, 'ateliers/atelier-a/commercialUsage/test-only-operation-probe'), { count: 999 }));
    await assertFails(updateDoc(doc(owner, 'ateliers/atelier-a'), { demoWorkspace: true }));
    await assertFails(updateDoc(doc(owner, 'ateliers/atelier-a'), { plan: 'premium', subscriptionStatus: 'active' }));
    await assertSucceeds(updateDoc(doc(owner, 'ateliers/atelier-a'), { name: 'Nome editado pelo proprietário' }));
  });

  it('keeps team membership, invitations, and ownership server-managed', async () => {
    const owner = environment.authenticatedContext('member-a', { email_verified: true }).firestore();
    const member = environment.authenticatedContext('finance-reader', { email_verified: true }).firestore();
    const membership = doc(owner, 'ateliers/atelier-a/members/new-member');
    const invitation = doc(owner, 'ateliers/atelier-a/teamInvitations/invitation-a');
    const emailIndex = doc(owner, 'ateliers/atelier-a/teamInvitationEmailIndex/hash-a');

    await assertFails(setDoc(membership, { userId: 'new-member', role: 'owner', active: true, permissions: [] }));
    await assertFails(updateDoc(doc(owner, 'ateliers/atelier-a/members/member-a'), { role: 'assistant' }));
    await assertFails(deleteDoc(doc(owner, 'ateliers/atelier-a/members/member-a')));
    await assertFails(setDoc(invitation, { email: 'invite@example.test', tokenHash: 'secret' }));
    await assertFails(getDoc(invitation));
    await assertFails(setDoc(emailIndex, { invitationId: 'invitation-a' }));
    await assertFails(getDoc(emailIndex));
    await assertFails(updateDoc(doc(owner, 'ateliers/atelier-a'), { ownerId: 'finance-reader' }));
    await assertFails(updateDoc(doc(owner, 'ateliers/atelier-a'), { active: false }));
    await assertFails(updateDoc(doc(member, 'ateliers/atelier-a'), { ownerId: 'finance-reader' }));
  });

  it('requires server upload and download for all production photo bytes', async () => {
    const member = environment.authenticatedContext('member-a', { email_verified: true }).storage();
    const client = environment.authenticatedContext('client-a', { email: 'client@example.com', email_verified: true }).storage();
    const visiblePath = 'ateliers/atelier-a/orders/order-a/production/photo-visible';
    const privatePath = 'ateliers/atelier-a/orders/order-a/production/photo-internal';
    const pendingPath = 'ateliers/atelier-a/orders/order-a/production/photo-upload';
    await assertFails(uploadBytes(ref(member, pendingPath), new Uint8Array([1, 2, 3]), {
      contentType: 'image/png', customMetadata: { photoId: 'photo-upload', orderId: 'order-a' },
    }));
    for (const context of [environment.unauthenticatedContext(), environment.authenticatedContext('member-b', { email_verified: true }), environment.authenticatedContext('member-a', { email_verified: false })]) {
      await assertFails(uploadBytes(ref(context.storage(), pendingPath), new Uint8Array([1, 2, 3]), { contentType: 'image/png', customMetadata: { photoId: 'photo-upload', orderId: 'order-a' } }));
      await assertFails(getBytes(ref(context.storage(), visiblePath)));
      await assertFails(deleteObject(ref(context.storage(), visiblePath)));
    }
    await assertFails(deleteObject(ref(member, visiblePath)));
    await assertFails(uploadBytes(ref(member, visiblePath), new Uint8Array([1, 2, 3]), { contentType: 'image/png' }));
    await assertFails(getBytes(ref(client, visiblePath)));
    await assertFails(getBytes(ref(member, visiblePath)));
    await assertFails(getBytes(ref(member, privatePath)));
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

  it('keeps non-demo contracts and invoices writable and denies generic order file writes', async () => {
    const storage = environment.authenticatedContext('member-a').storage();
    for (const path of ['contracts/new.pdf', 'invoices/new.pdf']) {
      const ownFile = ref(storage, `ateliers/atelier-a/${path}`);
      await assertSucceeds(uploadBytes(ownFile, new Uint8Array([1, 2, 3]), { contentType: 'application/pdf' }));
      await assertSucceeds(deleteObject(ownFile));
      await assertFails(uploadBytes(ref(storage, `ateliers/atelier-b/${path}`), new Uint8Array([1, 2, 3]), { contentType: 'application/pdf' }));
    }
    for (const area of ['shipping', 'documents', 'references', 'approvals', 'attachments']) {
      await assertFails(uploadBytes(ref(storage, `ateliers/atelier-a/orders/order-a/${area}/unregistered.pdf`), new Uint8Array([1, 2, 3]), { contentType: 'application/pdf' }));
    }
  });

  it('keeps attachment bytes server-only regardless of role, sharing or archival state', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    const path = 'ateliers/atelier-a/orders/order-a/attachments/file-registered';
    const filePath = 'ateliers/atelier-a/orders/order-a/files/file-registered';
    const owner = environment.authenticatedContext('member-a', { email: 'owner@example.test', email_verified: true });
    const noPermission = environment.authenticatedContext('no-order-access', { email: 'reader@example.test', email_verified: true });
    const client = environment.authenticatedContext('client-a', { email: 'client@example.com', email_verified: true });
    const tenantB = environment.authenticatedContext('member-b', { email: 'b@example.test', email_verified: true });
    const unauthenticated = environment.unauthenticatedContext();
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), filePath), { atelierId: 'atelier-a', orderId: 'order-a', storagePath: path, uploadedBy: 'member-a', uploadStatus: 'pending', contentType: 'image/png', size: bytes.length, visibleToClient: true, archived: false });
    });
    const metadata = { contentType: 'image/png', customMetadata: { fileId: 'file-registered', orderId: 'order-a' } };
    await assertFails(setDoc(doc(owner.firestore(), 'ateliers/atelier-a/orders/order-a/files/forged'), { visibleToClient: true, uploadStatus: 'ready' }));
    await assertFails(updateDoc(doc(owner.firestore(), filePath), { visibleToClient: true }));
    await assertFails(setDoc(doc(owner.firestore(), 'ateliers/atelier-a/orders/order-a/fileActions/forged'), { revision: 1 }));
    await assertFails(getDoc(doc(client.firestore(), filePath)));
    await assertSucceeds(getDoc(doc(owner.firestore(), filePath)));
    await assertFails(getDoc(doc(tenantB.firestore(), filePath)));
    await assertFails(uploadBytes(ref(client.storage(), path), bytes, metadata));
    await assertFails(uploadBytes(ref(noPermission.storage(), path), bytes, metadata));
    await assertFails(uploadBytes(ref(tenantB.storage(), path), bytes, metadata));
    await assertFails(uploadBytes(ref(owner.storage(), path), bytes, { ...metadata, customMetadata: { fileId: 'wrong', orderId: 'order-a' } }));
    await assertFails(uploadBytes(ref(owner.storage(), path), bytes.subarray(0, 8), metadata));
    await assertFails(uploadBytes(ref(owner.storage(), path), bytes, metadata));
    await environment.withSecurityRulesDisabled(async (context) => {
      await uploadBytes(ref(context.storage(), path), bytes, metadata);
    });
    await assertFails(uploadBytes(ref(owner.storage(), path), bytes, metadata));
    await assertFails(deleteObject(ref(owner.storage(), path)));
    await assertFails(getBytes(ref(client.storage(), path)));
    await environment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), filePath), { uploadStatus: 'ready' });
    });
    await assertFails(getBytes(ref(client.storage(), path)));
    await assertFails(getBytes(ref(noPermission.storage(), path)));
    await assertFails(getBytes(ref(tenantB.storage(), path)));
    await assertFails(getBytes(ref(unauthenticated.storage(), path)));
    await environment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), filePath), { visibleToClient: false });
    });
    await assertFails(getBytes(ref(client.storage(), path)));
    await assertFails(getBytes(ref(owner.storage(), path)));
    await environment.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), filePath), { visibleToClient: true, archived: true });
    });
    await assertFails(getBytes(ref(client.storage(), path)));
    await assertFails(getBytes(ref(owner.storage(), path)));
  });
});
