import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

const requireFromFunctions = createRequire(new URL('../../functions/package.json', import.meta.url));
const { initializeApp: initializeAdminApp } = requireFromFunctions('firebase-admin/app');
const { getAuth: getAdminAuth } = requireFromFunctions('firebase-admin/auth');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');
const projectId = 'demo-cosmaker';
const nonce = randomUUID().slice(0, 8);
const adminApp = initializeAdminApp({ projectId }, `messages-tests-${nonce}`);
const adminAuth = getAdminAuth(adminApp);
const adminDb = getFirestore(adminApp);
const clientApp = initializeApp({ apiKey: 'emulator-only-key', authDomain: `${projectId}.firebaseapp.com`, projectId, appId: 'emulator-only-app' }, `messages-client-${nonce}`);
const auth = getAuth(clientApp);
const functions = getFunctions(clientApp, 'us-central1');
const emulatorHost = process.env.FIREBASE_EMULATOR_HOST || '127.0.0.1';
connectAuthEmulator(auth, `http://${emulatorHost}:${process.env.COSMAKER_AUTH_EMULATOR_PORT || '19099'}`, { disableWarnings: true });
connectFunctionsEmulator(functions, emulatorHost, Number(process.env.COSMAKER_FUNCTIONS_EMULATOR_PORT || 15001));

type Identity = { uid: string; email: string; password: string };
const createdUids: string[] = [];
const atelierIds = [`messages-${nonce}-a`, `messages-${nonce}-b`];
const newId = () => randomUUID();
let ownerA: Identity;
let ownerB: Identity;
let noMessageAccess: Identity;

async function createIdentity(label: string): Promise<Identity> {
  const email = `${label}-${nonce}@cosmaker.test`;
  const password = `Local!${randomUUID().slice(0, 14)}aA1`;
  const user = await adminAuth.createUser({ email, password, displayName: label, emailVerified: true });
  createdUids.push(user.uid);
  return { uid: user.uid, email, password };
}

async function seedAtelier(atelierId: string, owner: Identity) {
  await Promise.all([
    adminDb.doc(`users/${owner.uid}`).set({ id: owner.uid, email: owner.email, name: owner.email, accountType: 'atelier_member', atelierId, role: 'owner', permissions: [], active: true }),
    adminDb.doc(`ateliers/${atelierId}`).set({ id: atelierId, name: 'Ateliê sintético', ownerId: owner.uid, active: true }),
    adminDb.doc(`ateliers/${atelierId}/members/${owner.uid}`).set({ userId: owner.uid, role: 'owner', permissions: [], active: true }),
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

let client: Identity; let recycled: Identity; let reader: Identity;
const thread = 'message-order';
const send = (text: string, extras: Record<string, unknown> = {}, requestId = newId()) => call<{ messageId: string; sequence: number; alreadyApplied: boolean }>('sendOrderMessage', { atelierId: atelierIds[0], orderId: thread, requestId, text, attachmentIds: [], ...extras });
const get = (extras: Record<string, unknown> = {}) => call<{ lastSequence: number; readSequence: number; peerReadSequence: number; messages: Array<{ id: string; text: string; sequence: number; mine: boolean; attachments: Array<Record<string, unknown>> }>; nextBeforeSequence: number | null }>('getOrderConversation', { atelierId: atelierIds[0], orderId: thread, ...extras });
const notifications = () => call<{ notifications: Array<{ id: string; atelierId: string; orderId: string; read: boolean }> }>('listInternalNotifications');
async function profile(user: Identity, role: 'client' | 'assistant', permissions: string[] = []) {
  await adminDb.doc(`users/${user.uid}`).set({ active: true, accountType: role === 'client' ? 'client' : 'atelier_member', ...(role === 'client' ? {} : { atelierId: atelierIds[0] }) });
  if (role !== 'client') await adminDb.doc(`ateliers/${atelierIds[0]}/members/${user.uid}`).set({ active: true, role, permissions });
}
beforeAll(async () => {
  [ownerA, ownerB, client, recycled, noMessageAccess, reader] = await Promise.all(['owner-message-a', 'owner-message-b', 'client-message', 'recycled-message', 'denied-message', 'reader-message'].map(createIdentity));
  await Promise.all([seedAtelier(atelierIds[0], ownerA), seedAtelier(atelierIds[1], ownerB), profile(client, 'client'), profile(recycled, 'client'), profile(noMessageAccess, 'assistant'), profile(reader, 'assistant', ['orders:read'])]);
  await adminDb.doc(`ateliers/${atelierIds[0]}/orders/${thread}`).set({ character: 'Armadura sintética', clientUserId: client.uid, clientId: 'linked-client', email: recycled.email });
  await adminDb.doc(`ateliers/${atelierIds[0]}/clients/linked-client`).set({ userId: client.uid });
  await signIn(ownerA);
});
afterAll(async () => {
  for (const id of atelierIds) {
    await adminDb.recursiveDelete(adminDb.doc(`ateliers/${id}`));
    const logs = await adminDb.collection('auditLogs').where('atelierId', '==', id).get();
    await Promise.all(logs.docs.map((doc: { ref: { delete(): Promise<unknown> } }) => doc.ref.delete()));
  }
  for (const uid of createdUids) { await adminAuth.deleteUser(uid); await adminDb.doc(`users/${uid}`).delete(); }
  await deleteApp(clientApp); await deleteApp(adminApp);
});

describe('Internal messages and notifications in demo-cosmaker', () => {
  it('deduplica envio concorrente, conserva histórico e notifica somente o UID destinatário', async () => {
    await signIn(ownerA); const key = newId();
    const first = await Promise.all([send('Seu projeto começou.', {}, key), send('Seu projeto começou.', {}, key)]);
    expect(new Set(first.map((item) => item.messageId)).size).toBe(1); expect(first.filter((item) => !item.alreadyApplied)).toHaveLength(1);
    await expect(send('Outro texto', {}, key)).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await signIn(client);
    const view = await get(); expect(view.messages).toHaveLength(1); expect(view.messages[0]).toMatchObject({ text: 'Seu projeto começou.', mine: false });
    expect(JSON.stringify(view)).not.toContain(ownerA.uid); expect(JSON.stringify(view)).not.toContain(client.uid);
    const inbox = await call<{ conversations: Array<{ unread: number }> }>('listMessageInbox'); expect(inbox.conversations[0].unread).toBe(1);
    const notice = await notifications(); expect(notice.notifications).toHaveLength(1); expect(notice.notifications[0]).toMatchObject({ orderId: thread, read: false });
    expect(await call('markInternalNotificationRead', { atelierId: atelierIds[0], notificationId: notice.notifications[0].id })).toMatchObject({ alreadyApplied: false });
    expect(await call('markInternalNotificationRead', { atelierId: atelierIds[0], notificationId: notice.notifications[0].id })).toMatchObject({ alreadyApplied: true });
    await call('markOrderConversationRead', { atelierId: atelierIds[0], orderId: thread, sequence: 1 });
    expect((await call<{ conversations: Array<{ unread: number }> }>('listMessageInbox')).conversations[0].unread).toBe(0);
    await send('Obrigada, recebi a atualização.');
    await signIn(ownerA); const reply = await get(); expect(reply.messages).toHaveLength(2); expect(reply.peerReadSequence).toBe(2);
    expect((await notifications()).notifications).toHaveLength(1);
    const stored = await adminDb.collection(`ateliers/${atelierIds[0]}/conversations/${thread}/messages`).get(); expect(stored.size).toBe(2);
    const logs = await adminDb.collection('auditLogs').where('atelierId', '==', atelierIds[0]).where('action', '==', 'message.sent').get(); expect(logs.size).toBe(2);
  }, 60_000);

  it('nega tenant B, e-mail reutilizado, UID conflitante, perfil inativo e leitura/manipulação alheia', async () => {
    await signIn(ownerA); const notice = (await notifications()).notifications[0];
    for (const user of [ownerB, recycled, noMessageAccess]) {
      await signIn(user); await expect(get()).rejects.toMatchObject({ code: 'functions/permission-denied' });
      await expect(send('Forjado')).rejects.toMatchObject({ code: 'functions/permission-denied' });
      await expect(call('markInternalNotificationRead', { atelierId: atelierIds[0], notificationId: notice.id })).rejects.toMatchObject({ code: 'functions/permission-denied' });
    }
    await signIn(client);
    await expect(send('Forjado', { senderId: ownerA.uid })).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    await expect(call('markOrderConversationRead', { atelierId: atelierIds[0], orderId: thread, sequence: 9999 })).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    await adminDb.doc(`ateliers/${atelierIds[0]}/clients/linked-client`).update({ userId: recycled.uid });
    try { await expect(get()).rejects.toMatchObject({ code: 'functions/permission-denied' }); }
    finally { await adminDb.doc(`ateliers/${atelierIds[0]}/clients/linked-client`).update({ userId: client.uid }); }
    await adminDb.doc(`users/${client.uid}`).update({ active: false });
    try { await expect(get()).rejects.toMatchObject({ code: 'functions/permission-denied' }); await expect(notifications()).rejects.toMatchObject({ code: 'functions/permission-denied' }); }
    finally { await adminDb.doc(`users/${client.uid}`).update({ active: true }); }
    await signIn(reader); expect((await get()).messages.length).toBeGreaterThan(0);
    await expect(send('Sem escrita')).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await signOut(auth); await expect(get()).rejects.toMatchObject({ code: 'functions/unauthenticated' });
  }, 60_000);

  it('aceita apenas anexos compartilhados do pedido e esconde metadados após revogação', async () => {
    await signIn(ownerA); const root = adminDb.doc(`ateliers/${atelierIds[0]}/orders/${thread}`);
    const base = { source: 'order_upload', uploadStatus: 'ready', archived: false, visibleToClient: true, originalName: 'Anexo sintético.pdf', contentType: 'application/pdf', size: 20 };
    await root.collection('files').doc('shared-file').set(base);
    await root.collection('files').doc('private-file').set({ ...base, visibleToClient: false, originalName: 'PRIVATE-FILENAME' });
    await expect(send('Não compartilhar', { attachmentIds: ['private-file'] })).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await expect(send('Path adulterado', { attachmentIds: ['../shared-file'] })).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    const sent = await send('Arquivo para revisão.', { attachmentIds: ['shared-file'] });
    await signIn(client); let message = (await get()).messages.find((message) => message.id === sent.messageId)!;
    expect(message.attachments[0]).toMatchObject({ available: true, originalName: 'Anexo sintético.pdf' });
    await root.collection('files').doc('shared-file').update({ visibleToClient: false });
    message = (await get()).messages.find((message) => message.id === sent.messageId)!;
    expect(message.attachments[0]).toEqual({ id: 'shared-file', available: false });
    expect(JSON.stringify(message)).not.toContain('PRIVATE-FILENAME');
  }, 60_000);

  it('pagina histórico sem omitir mensagens, serializa sequências e não confia em conversa legada forjada', async () => {
    await signIn(ownerA);
    const attempts = await Promise.all([send('Concorrente A'), send('Concorrente B')]);
    expect(Math.abs(attempts[0].sequence - attempts[1].sequence)).toBe(1);
    for (let index = 0; index < 48; index++) await send(`Mensagem ${index}`);
    const first = await get(); expect(first.messages).toHaveLength(50); expect(first.nextBeforeSequence).toBeTruthy();
    const older = await get({ beforeSequence: first.nextBeforeSequence });
    const all = [...older.messages, ...first.messages]; expect(new Set(all.map((message) => message.id)).size).toBe(all.length);
    expect(older.nextBeforeSequence).toBeNull();
    const legacyOrder = adminDb.doc(`ateliers/${atelierIds[0]}/orders/legacy-thread`);
    await legacyOrder.set({ character: 'Legado sintético', clientUserId: client.uid });
    await adminDb.doc(`ateliers/${atelierIds[0]}/conversations/legacy-thread`).set({ clientUserId: client.uid, lastSequence: 1, lastMessageAt: new Date() });
    await expect(get({ orderId: 'legacy-thread' })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
  }, 120_000);
});
