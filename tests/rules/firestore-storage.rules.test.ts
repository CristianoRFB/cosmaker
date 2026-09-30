import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';

let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-cosmaker',
    firestore: { rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8') },
    storage: { rules: readFileSync(resolve(process.cwd(), 'storage.rules'), 'utf8') },
  });
});

afterAll(async () => { await environment.cleanup(); });

beforeEach(async () => {
  await environment.clearFirestore();
  await environment.clearStorage();
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'ateliers/atelier-a'), { name: 'Ateliê A', active: true }),
      setDoc(doc(db, 'ateliers/atelier-b'), { name: 'Ateliê B', active: true }),
      setDoc(doc(db, 'ateliers/atelier-closed'), { name: 'Ateliê fechado', active: true }),
      setDoc(doc(db, 'ateliers/atelier-suspended'), { name: 'Ateliê suspenso', active: false }),
      setDoc(doc(db, 'publicAteliers/atelier-a'), { quoteRequestsEnabled: true, published: false }),
      setDoc(doc(db, 'publicAteliers/atelier-closed'), { quoteRequestsEnabled: false, published: false }),
      setDoc(doc(db, 'ateliers/atelier-a/members/member-a'), { active: true, role: 'owner', permissions: [] }),
      setDoc(doc(db, 'ateliers/atelier-b/members/member-b'), { active: true, role: 'assistant', permissions: ['quotes:read'] }),
      setDoc(doc(db, 'ateliers/atelier-a/members/finance-reader'), { active: true, role: 'assistant', permissions: ['quotes:read'] }),
      setDoc(doc(db, 'ateliers/atelier-a/quoteRequests/request-a'), { email: 'client@example.com', status: 'new' }),
      setDoc(doc(db, 'ateliers/atelier-b/quoteRequests/request-b'), { email: 'other@example.com', status: 'new' }),
      setDoc(doc(db, 'ateliers/atelier-closed/quoteRequests/request-closed'), { email: 'client@example.com', status: 'new' }),
      setDoc(doc(db, 'ateliers/atelier-a/quotes/quote-a'), { email: 'client@example.com', status: 'sent', total: 1200 }),
      setDoc(doc(db, 'ateliers/atelier-a/transactions/transaction-a'), { amount: 1200 }),
      setDoc(doc(db, 'ateliers/atelier-suspended/members/suspended-member'), { active: true, role: 'owner', permissions: [] }),
      setDoc(doc(db, 'ateliers/atelier-suspended/quoteRequests/request-suspended'), { email: 'client@example.com', status: 'new' }),
      setDoc(doc(db, 'users/platform-admin'), { accountType: 'platform_admin', active: true }),
      setDoc(doc(db, 'users/disabled-admin'), { accountType: 'platform_admin', active: false }),
      setDoc(doc(db, 'auditLogs/log-a'), { actorId: 'platform-admin', action: 'platform.atelier_suspended' }),
    ]);
  });
});

describe('Firestore and Storage tenant rules', () => {
  it('allows only valid public intake for a published intake configuration', async () => {
    const guest = environment.unauthenticatedContext().firestore();
    const validRequest = {
      clientId: null, name: 'Cliente Cosmaker', email: 'client@example.com', character: 'Personagem', franchise: 'Franquia',
      category: 'full_cosplay', description: 'Solicitação pública de orçamento suficientemente detalhada.',
      desiredDeliveryDate: '2027-07-14', urgency: 'normal', status: 'new',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    await assertSucceeds(setDoc(doc(guest, 'ateliers/atelier-a/quoteRequests/new-request'), validRequest));
    await assertFails(setDoc(doc(guest, 'ateliers/atelier-closed/quoteRequests/new-request'), validRequest));
    await assertFails(setDoc(doc(guest, 'ateliers/atelier-a/quoteRequests/bad-request'), { ...validRequest, status: 'approved' }));
  });

  it('does not let a member of one tenant read another tenant requests', async () => {
    const member = environment.authenticatedContext('member-a').firestore();
    await assertSucceeds(getDoc(doc(member, 'ateliers/atelier-a/quoteRequests/request-a')));
    await assertFails(getDoc(doc(member, 'ateliers/atelier-b/quoteRequests/request-b')));
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
  });

  it('keeps finance records unavailable to a quote-only member', async () => {
    const reader = environment.authenticatedContext('finance-reader').firestore();
    await assertFails(getDoc(doc(reader, 'ateliers/atelier-a/transactions/transaction-a')));
  });

  it('limits public reference uploads to image types and enabled public intake', async () => {
    const guest = environment.unauthenticatedContext().storage();
    await assertSucceeds(uploadBytes(ref(guest, 'ateliers/atelier-a/quoteRequests/request-a/references/ref.png'), new Uint8Array([1, 2, 3]), { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(guest, 'ateliers/atelier-a/quoteRequests/request-a/references/ref.html'), new Uint8Array([1, 2, 3]), { contentType: 'text/html' }));
    await assertFails(uploadBytes(ref(guest, 'ateliers/atelier-closed/quoteRequests/request-closed/references/ref.png'), new Uint8Array([1, 2, 3]), { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(guest, 'ateliers/atelier-suspended/quoteRequests/request-suspended/references/ref.png'), new Uint8Array([1, 2, 3]), { contentType: 'image/png' }));
  });
});
