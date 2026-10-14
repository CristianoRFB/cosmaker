import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

const requireFromFunctions = createRequire(new URL('../../functions/package.json', import.meta.url));
const { initializeApp: initializeAdminApp } = requireFromFunctions('firebase-admin/app');
const { getAuth: getAdminAuth } = requireFromFunctions('firebase-admin/auth');
const { getFirestore, Timestamp } = requireFromFunctions('firebase-admin/firestore');
const projectId = 'demo-cosmaker';
const nonce = randomUUID().slice(0, 8);
const adminApp = initializeAdminApp({ projectId }, `team-tests-${nonce}`);
const adminAuth = getAdminAuth(adminApp);
const adminDb = getFirestore(adminApp);
const clientApp = initializeApp({
  apiKey: 'emulator-only-key',
  authDomain: `${projectId}.firebaseapp.com`,
  projectId,
  appId: 'emulator-only-app',
}, `team-client-${nonce}`);
const auth = getAuth(clientApp);
const functions = getFunctions(clientApp, 'us-central1');
const emulatorHost = process.env.FIREBASE_EMULATOR_HOST || '127.0.0.1';
connectAuthEmulator(auth, `http://${emulatorHost}:${process.env.COSMAKER_AUTH_EMULATOR_PORT || '19099'}`, { disableWarnings: true });
connectFunctionsEmulator(functions, emulatorHost, Number(process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || 15001));

type Identity = { email: string; password: string; uid: string };
type Invitation = { atelierId: string; invitationId: string; token: string; expiresAt: string };
type SnapshotDocument = { id: string; data(): Record<string, unknown>; ref: { delete(): Promise<unknown> } };
type QuerySnapshotLike = { docs: SnapshotDocument[] };
const createdUids: string[] = [];
const createdAteliers: string[] = [];
let ownerA: Identity;
let ownerB: Identity;
let atelierA: string;
let atelierB: string;

async function createIdentity(label: string, platformAdmin = false): Promise<Identity> {
  const email = `${label}-${nonce}@cosmaker.test`;
  const password = `Local!${randomUUID().slice(0, 14)}aA1`;
  const user = await adminAuth.createUser({ email, password, displayName: label, emailVerified: true });
  createdUids.push(user.uid);
  if (platformAdmin) {
    await adminAuth.setCustomUserClaims(user.uid, { platformAdmin: true });
    await adminDb.doc(`users/${user.uid}`).set({ id: user.uid, email, name: label, accountType: 'platform_admin', active: true });
  }
  return { email, password, uid: user.uid };
}

async function createAtelier(label: string) {
  const owner = await createIdentity(`owner-${label}`);
  const atelierId = `team-${nonce}-${label}`;
  createdAteliers.push(atelierId);
  await Promise.all([
    adminDb.doc(`users/${owner.uid}`).set({ id: owner.uid, email: owner.email, name: label, accountType: 'atelier_member', atelierId, role: 'owner', permissions: [], active: true }),
    adminDb.doc(`ateliers/${atelierId}`).set({ id: atelierId, name: `Synthetic ${label}`, ownerId: owner.uid, active: true }),
    adminDb.doc(`ateliers/${atelierId}/members/${owner.uid}`).set({ userId: owner.uid, role: 'owner', permissions: [], active: true }),
  ]);
  return { atelierId, owner };
}

async function addMember(atelierId: string, identity: Identity, role: string, permissions: string[], active = true) {
  await Promise.all([
    adminDb.doc(`users/${identity.uid}`).set({ id: identity.uid, email: identity.email, name: identity.email, accountType: 'atelier_member', atelierId, role, permissions, active }, { merge: true }),
    adminDb.doc(`ateliers/${atelierId}/members/${identity.uid}`).set({ userId: identity.uid, role, permissions, active }),
  ]);
}

async function signIn(identity: Identity) {
  await signOut(auth).catch(() => undefined);
  await signInWithEmailAndPassword(auth, identity.email, identity.password);
  await auth.currentUser?.getIdToken(true);
}

function call<T>(name: string, data: Record<string, unknown> = {}) {
  return httpsCallable<Record<string, unknown>, T>(functions, name)(data).then((result) => result.data);
}

async function invite(email: string, role = 'assistant', permissions: string[] = ['clients:read']) {
  return call<Invitation>('createAtelierInvitation', { email, role, permissions });
}

function accept(invitation: Invitation) {
  return call('acceptAtelierInvitation', {
    atelierId: invitation.atelierId,
    invitationId: invitation.invitationId,
    token: invitation.token,
  });
}

beforeAll(async () => {
  const first = await createAtelier('a');
  const second = await createAtelier('b');
  ownerA = first.owner;
  ownerB = second.owner;
  atelierA = first.atelierId;
  atelierB = second.atelierId;
}, 60000);

afterAll(async () => {
  await signOut(auth).catch(() => undefined);
  await Promise.all(createdAteliers.map((id) => adminDb.recursiveDelete(adminDb.doc(`ateliers/${id}`)).catch(() => undefined)));
  const audits: Array<QuerySnapshotLike | null> = await Promise.all(createdAteliers.map((id) => adminDb.collection('auditLogs').where('atelierId', '==', id).get().catch(() => null)));
  await Promise.all(audits.flatMap((snapshot) => snapshot?.docs ?? []).map((document) => document.ref.delete()));
  await Promise.all(createdUids.map((uid) => adminDb.doc(`users/${uid}`).delete().catch(() => undefined)));
  await Promise.all(createdUids.map((uid) => adminAuth.deleteUser(uid).catch(() => undefined)));
  await deleteApp(clientApp).catch(() => undefined);
  await adminApp.delete().catch(() => undefined);
});

describe('Team Functions em Firebase Emulator', () => {
  it('normaliza convites, guarda somente hash, evita duplicidade concorrente e isola tenants', async () => {
    const invited = await createIdentity('invited-normalized');
    await signIn(ownerA);
    const created = await invite(`  ${invited.email.toUpperCase()}  `);
    expect(created.token).toMatch(/^[a-f0-9]{64}$/);
    const stored = (await adminDb.doc(`ateliers/${atelierA}/teamInvitations/${created.invitationId}`).get()).data()!;
    expect(stored.email).toBe(invited.email);
    expect(stored.tokenHash).toHaveLength(64);
    expect(stored.tokenHash).not.toBe(created.token);
    expect(stored).not.toHaveProperty('token');
    const listed = await call<{ invitations: Array<Record<string, unknown>> }>('listAtelierInvitations');
    expect(listed.invitations).toHaveLength(1);
    expect(listed.invitations[0]).toMatchObject({ email: invited.email, status: 'pending' });
    expect(listed.invitations[0]).not.toHaveProperty('tokenHash');
    expect(listed.invitations[0]).not.toHaveProperty('emailHash');

    const concurrentTarget = await createIdentity('invited-concurrent');
    const attempts = await Promise.allSettled([invite(concurrentTarget.email), invite(concurrentTarget.email)]);
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);

    await signIn(ownerB);
    const otherTenantList = await call<{ invitations: Array<Record<string, unknown>> }>('listAtelierInvitations');
    expect(otherTenantList.invitations).toHaveLength(0);
    await expect(call('revokeAtelierInvitation', { invitationId: created.invitationId }))
      .rejects.toMatchObject({ code: 'functions/failed-precondition' });
    expect((await adminDb.doc(`ateliers/${atelierA}/teamInvitations/${created.invitationId}`).get()).data()?.status).toBe('pending');
  }, 120000);

  it('aceita conta de cliente somente com token de uso único e e-mail verificado correspondente', async () => {
    const client = await createIdentity('existing-client');
    const mismatch = await createIdentity('wrong-email');
    await adminDb.doc(`users/${client.uid}`).set({
      id: client.uid, email: client.email, name: 'Nome preservado', phone: '+55 11 90000-0000',
      accountType: 'client', active: true,
    });
    await signIn(ownerA);
    const invitation = await invite(client.email, 'cosmaker', ['clients:read', 'clients:write']);

    await signIn(mismatch);
    await expect(accept(invitation))
      .rejects.toMatchObject({ code: 'functions/failed-precondition' });

    await signIn(client);
    await expect(accept(invitation)).resolves.toMatchObject({ atelierId: atelierA, status: 'accepted' });
    const profile = (await adminDb.doc(`users/${client.uid}`).get()).data()!;
    expect(profile).toMatchObject({
      name: 'Nome preservado', phone: '+55 11 90000-0000', accountType: 'atelier_member',
      atelierId: atelierA, role: 'cosmaker', active: true,
    });
    expect((await adminDb.doc(`ateliers/${atelierA}/members/${client.uid}`).get()).data()).toMatchObject({ active: true, role: 'cosmaker' });
    await expect(accept(invitation)).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    expect((await adminDb.doc(`ateliers/${atelierA}/teamInvitationEmailIndex/${storedEmailHash(client.email)}`).get()).exists).toBe(false);
  }, 120000);

  it('recusa convites revogados, expirados, destinados a outro tenant e a administrador da plataforma', async () => {
    const revokedTarget = await createIdentity('revoked-target');
    const expiredTarget = await createIdentity('expired-target');
    const otherTenantMember = await createIdentity('other-tenant-member');
    await addMember(atelierB, otherTenantMember, 'assistant', ['clients:read']);
    const platformAdmin = await createIdentity('platform-admin', true);

    await signIn(ownerA);
    const revoked = await invite(revokedTarget.email);
    await call('revokeAtelierInvitation', { invitationId: revoked.invitationId });
    const expired = await invite(expiredTarget.email);
    await adminDb.doc(`ateliers/${atelierA}/teamInvitations/${expired.invitationId}`).update({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
    const crossTenant = await invite(otherTenantMember.email);
    const adminInvite = await invite(platformAdmin.email);

    await signIn(revokedTarget);
    await expect(accept(revoked)).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await signIn(expiredTarget);
    await expect(accept(expired)).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await signIn(otherTenantMember);
    await expect(accept(crossTenant)).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await signIn(platformAdmin);
    await expect(accept(adminInvite)).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    expect((await adminDb.doc(`users/${otherTenantMember.uid}`).get()).data()?.atelierId).toBe(atelierB);
  }, 120000);

  it('limita concessões por papel, aplica desativação e transfere a titularidade de forma atômica', async () => {
    const manager = await createIdentity('limited-manager');
    const target = await createIdentity('managed-member');
    await Promise.all([
      addMember(atelierA, manager, 'assistant', ['team:read', 'team:manage', 'clients:read']),
      addMember(atelierA, target, 'assistant', ['clients:read']),
    ]);

    await signIn(manager);
    await expect(invite('new-admin@example.test', 'admin', []))
      .rejects.toMatchObject({ code: 'functions/permission-denied' });
    await expect(invite('stronger@example.test', 'assistant', ['clients:write']))
      .rejects.toMatchObject({ code: 'functions/permission-denied' });
    await expect(call('updateAtelierMember', { memberId: target.uid, role: 'assistant', permissions: ['clients:write'], active: true }))
      .rejects.toMatchObject({ code: 'functions/permission-denied' });
    await expect(call('updateAtelierMember', { memberId: ownerA.uid, role: 'assistant', permissions: [], active: false }))
      .rejects.toMatchObject({ code: 'functions/permission-denied' });

    const allowed = await invite('within-scope@example.test', 'assistant', ['clients:read']);
    expect(allowed.invitationId).toBeTruthy();
    await call('updateAtelierMember', { memberId: target.uid, role: 'assistant', permissions: ['clients:read'], active: false });
    expect((await adminDb.doc(`ateliers/${atelierA}/members/${target.uid}`).get()).data()?.active).toBe(false);
    await expect(call('listAtelierTeam')).resolves.toMatchObject({ ownerId: ownerA.uid });

    await signIn(ownerA);
    await call('updateAtelierMember', { memberId: manager.uid, role: 'assistant', permissions: ['team:read', 'team:manage', 'clients:read'], active: false });
    await signIn(manager);
    await expect(call('listAtelierTeam')).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await signIn(ownerA);
    await call('updateAtelierMember', { memberId: manager.uid, role: 'assistant', permissions: ['team:read', 'team:manage', 'clients:read'], active: true });
    await call('transferAtelierOwnership', { memberId: manager.uid });

    const atelier = (await adminDb.doc(`ateliers/${atelierA}`).get()).data();
    const members: QuerySnapshotLike = await adminDb.collection(`ateliers/${atelierA}/members`).get();
    expect(atelier?.ownerId).toBe(manager.uid);
    expect(members.docs.filter((member) => member.data().role === 'owner').map((member) => member.id)).toEqual([manager.uid]);
    expect((await adminDb.doc(`ateliers/${atelierA}/members/${ownerA.uid}`).get()).data()?.role).toBe('admin');
    const audit: QuerySnapshotLike = await adminDb.collection('auditLogs').where('atelierId', '==', atelierA).get();
    expect(audit.docs.some((document) => document.data().action === 'team.ownership_transferred')).toBe(true);
  }, 120000);
});

function storedEmailHash(email: string) {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}
