import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { requireVerifiedIdentity } from '../orders/access';
import { messageActor, messageId, messageInput, messagePermission } from './access';
import { writeInternalNotification } from '../notifications/create-notification';
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const iso = (value: FirebaseFirestore.Timestamp) => value.toDate().toISOString();
const sequence = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function conversationClient(current: FirebaseFirestore.DocumentData | undefined, uid: string | null) {
  const existing = typeof current?.clientUserId === 'string' ? current.clientUserId : null;
  if (existing && uid && existing !== uid) throw new HttpsError('permission-denied', 'A conversa pertence a outro vínculo de cliente.');
  const clientUid = uid ?? existing;
  if (!clientUid || clientUid.includes('/') || clientUid.length > 128) throw new HttpsError('failed-precondition', 'O cliente precisa acessar o pedido antes de iniciar esta conversa.');
  return clientUid;
}
async function trustedConversation(tx: FirebaseFirestore.Transaction, ref: FirebaseFirestore.DocumentReference, current: FirebaseFirestore.DocumentSnapshot) {
  if (!current.exists) return;
  const proof = await tx.get(adminDb.doc(`auditLogs/${hash(['message_conversation_created', ref.path])}`));
  if (proof.data()?.action !== 'message.conversation_created' || proof.data()?.after?.clientUserId !== current.data()?.clientUserId) {
    throw new HttpsError('failed-precondition', 'Esta conversa anterior exige conciliação do histórico antes de continuar.');
  }
}
function readyAttachment(file: FirebaseFirestore.DocumentData | undefined) {
  return !!file && typeof file.originalName === 'string' && file.originalName.length > 0 && file.originalName.length <= 160
    && ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.contentType) && Number.isSafeInteger(file.size) && file.size > 0 && file.size <= 20 * 1024 * 1024 && file.source === 'order_upload' && file.uploadStatus === 'ready' && file.archived !== true && file.visibleToClient === true;
}
export const sendOrderMessage = onCall(async (call) => {
  requireVerifiedIdentity(call.auth);
  const data = messageInput(call.data, ['atelierId', 'orderId', 'requestId', 'text', 'attachmentIds']);
  const text = typeof data.text === 'string' ? data.text.trim() : '';
  if (![data.atelierId, data.orderId, data.requestId].every(messageId) || typeof data.text !== 'string' || text.length > 4000
    || !Array.isArray(data.attachmentIds) || data.attachmentIds.length > 5 || data.attachmentIds.some((id) => !messageId(id))
    || new Set(data.attachmentIds).size !== data.attachmentIds.length || (!text && data.attachmentIds.length === 0)) throw new HttpsError('invalid-argument', 'Escreva uma mensagem de até 4.000 caracteres ou selecione anexos compartilhados.');
  const atelierId = String(data.atelierId); const orderId = String(data.orderId);
  const ref = adminDb.doc(`ateliers/${atelierId}/conversations/${orderId}`);
  const id = hash([call.auth!.uid, data.requestId]);
  const operation = ref.collection('operations').doc(id);
  const fingerprint = hash([text, [...data.attachmentIds].sort()]);
  return adminDb.runTransaction(async (tx) => {
    const actor = await messageActor(tx, call.auth, atelierId, orderId, true);
    const [conversation, previous] = await Promise.all([tx.get(ref), tx.get(operation)]);
    await trustedConversation(tx, ref, conversation);
    const clientUid = conversationClient(conversation.data(), actor.clientUid);
    if (!actor.staff && clientUid !== actor.uid) throw new HttpsError('permission-denied', 'A conversa não pertence à sua conta.');
    if (previous.exists) {
      if (previous.data()?.fingerprint !== fingerprint) throw new HttpsError('failed-precondition', 'A chave de repetição foi usada com outra mensagem.');
      return { messageId: id, sequence: previous.data()!.sequence, alreadyApplied: true };
    }
    const files = await Promise.all((data.attachmentIds as string[]).map((fileId) => tx.get(adminDb.doc(`ateliers/${atelierId}/orders/${orderId}/files/${fileId}`))));
    if (files.some((file) => !readyAttachment(file.data()))) throw new HttpsError('permission-denied', 'Use somente anexos deste pedido que estejam compartilhados com o cliente.');
    const currentSequence = conversation.data()?.lastSequence ?? 0;
    if (!sequence(currentSequence) || !Number.isSafeInteger(currentSequence + 1)) throw new HttpsError('failed-precondition', 'A sequência da conversa precisa ser revisada.');
    const next = currentSequence + 1; const now = Timestamp.now();
    const recipient = actor.staff ? clientUid : typeof actor.atelier.ownerId === 'string' ? actor.atelier.ownerId : null;
    const recipientProfile = recipient && !recipient.includes('/') ? await tx.get(adminDb.doc(`users/${recipient}`)) : null;
    const recipientMember = !actor.staff && recipient && !recipient.includes('/') ? await tx.get(adminDb.doc(`ateliers/${atelierId}/members/${recipient}`)) : null;
    const notify = recipient && recipient !== actor.uid && recipientProfile?.data()?.active === true
      && (actor.staff ? recipientProfile.data()?.accountType === 'client'
        : recipientProfile.data()?.accountType === 'atelier_member' && recipientProfile.data()?.atelierId === atelierId && messagePermission(recipientMember?.data()));
    if (!conversation.exists) tx.create(adminDb.doc(`auditLogs/${hash(['message_conversation_created', ref.path])}`), { actorId: actor.uid, atelierId, action: 'message.conversation_created', entity: 'conversation', entityId: orderId, after: { clientUserId: clientUid }, timestamp: now });
    tx.set(ref, { orderId, clientUserId: clientUid, character: typeof actor.order.character === 'string' ? actor.order.character.slice(0, 120) : 'Pedido',
      lastSequence: next, lastMessageAt: now, lastPreview: text.slice(0, 140) || 'Anexo compartilhado', updatedAt: now, ...(!conversation.exists ? { createdAt: now, staffReadSequence: 0 } : {}) }, { merge: true });
    tx.set(ref.collection('reads').doc(actor.uid), { sequence: next, updatedAt: now });
    if (actor.staff) tx.update(ref, { staffReadSequence: next });
    tx.create(ref.collection('messages').doc(id), { sequence: next, senderId: actor.uid, senderRole: actor.staff ? 'staff' : 'client', text,
      attachmentIds: data.attachmentIds, createdAt: now });
    tx.create(operation, { fingerprint, sequence: next, senderId: actor.uid, createdAt: now });
    if (notify) writeInternalNotification(tx, { atelierId, userId: recipient, eventId: id, type: 'order_message', orderId,
      title: 'Nova mensagem sobre seu pedido', message: text.slice(0, 140) || 'Um anexo foi compartilhado na conversa.' });
    tx.create(adminDb.collection('auditLogs').doc(), { actorId: actor.uid, atelierId, action: 'message.sent', entity: 'conversation', entityId: orderId,
      after: { messageId: id, sequence: next, attachmentCount: files.length, notificationCreated: !!notify }, timestamp: now });
    return { messageId: id, sequence: next, alreadyApplied: false, notificationCreated: !!notify };
  });
});

export const getOrderConversation = onCall(async (call) => {
  requireVerifiedIdentity(call.auth);
  const data = messageInput(call.data, ['atelierId', 'orderId', 'beforeSequence']);
  if (![data.atelierId, data.orderId].every(messageId) || (data.beforeSequence !== undefined && (!sequence(data.beforeSequence) || Number(data.beforeSequence) < 1))) throw new HttpsError('invalid-argument', 'Pedido ou página inválidos.');
  const atelierId = String(data.atelierId); const orderId = String(data.orderId);
  const ref = adminDb.doc(`ateliers/${atelierId}/conversations/${orderId}`);
  return adminDb.runTransaction(async (tx) => {
    const actor = await messageActor(tx, call.auth, atelierId, orderId);
    const [conversation, ownRead] = await Promise.all([tx.get(ref), tx.get(ref.collection('reads').doc(actor.uid))]);
    await trustedConversation(tx, ref, conversation);
    const clientUid = conversation.exists ? conversationClient(conversation.data(), actor.clientUid) : actor.clientUid;
    if (!actor.staff && clientUid !== actor.uid) throw new HttpsError('permission-denied', 'A conversa não pertence à sua conta.');
    const clientRead = clientUid ? await tx.get(ref.collection('reads').doc(clientUid)) : null;
    let query = ref.collection('messages').orderBy('sequence', 'desc').limit(51);
    if (data.beforeSequence !== undefined) query = query.where('sequence', '<', data.beforeSequence);
    const messages = await tx.get(query); const page = messages.docs.slice(0, 50);
    const proofs = await Promise.all(page.map((doc) => tx.get(ref.collection('operations').doc(doc.id))));
    if (page.some((doc, index) => {
      const value = doc.data(); const proof = proofs[index].data();
      return typeof value.text !== 'string' || !Array.isArray(value.attachmentIds) || value.attachmentIds.some((id) => !messageId(id))
        || proof?.sequence !== value.sequence || proof?.senderId !== value.senderId || proof?.fingerprint !== hash([value.text, [...value.attachmentIds].sort()]);
    })) throw new HttpsError('failed-precondition', 'O histórico anterior precisa ser conciliado antes de ser exibido.');
    const availableFiles = await tx.get(adminDb.collection(`ateliers/${atelierId}/orders/${orderId}/files`).limit(501));
    if (availableFiles.size > 500) throw new HttpsError('resource-exhausted', 'A lista de anexos exige paginação antes de ser exibida.');
    const fileMap = new Map(availableFiles.docs.map((doc) => [doc.id, doc.data()]));
    const viewFile = (id: string) => { const value = fileMap.get(id); return readyAttachment(value)
      ? { id, available: true, originalName: value!.originalName, contentType: value!.contentType, size: value!.size } : { id, available: false }; };
    return { orderId, atelierId, character: actor.order.character ?? 'Pedido', canSend: actor.staff ? !!clientUid && messagePermission((await tx.get(adminDb.doc(`ateliers/${atelierId}/members/${actor.uid}`))).data(), true) : true,
      lastSequence: conversation.data()?.lastSequence ?? 0, readSequence: ownRead.data()?.sequence ?? 0,
      peerReadSequence: actor.staff ? clientRead?.data()?.sequence ?? 0 : conversation.data()?.staffReadSequence ?? 0,
      messages: page.reverse().map((doc) => { const value = doc.data(); return { id: doc.id, sequence: value.sequence, mine: value.senderId === actor.uid,
        sender: value.senderRole === 'staff' ? 'Equipe do ateliê' : 'Cliente', text: value.text, createdAt: iso(value.createdAt), attachments: (Array.isArray(value.attachmentIds) ? value.attachmentIds : []).map(viewFile) }; }),
      attachments: availableFiles.docs.filter((file) => readyAttachment(file.data())).map((file) => viewFile(file.id)),
      nextBeforeSequence: messages.size > 50 ? page[0]?.data().sequence ?? null : null };
  });
});

export const markOrderConversationRead = onCall(async (call) => {
  requireVerifiedIdentity(call.auth);
  const data = messageInput(call.data, ['atelierId', 'orderId', 'sequence']);
  if (![data.atelierId, data.orderId].every(messageId) || !sequence(data.sequence)) throw new HttpsError('invalid-argument', 'Informe uma posição de leitura válida.');
  const atelierId = String(data.atelierId); const orderId = String(data.orderId); const ref = adminDb.doc(`ateliers/${atelierId}/conversations/${orderId}`);
  return adminDb.runTransaction(async (tx) => {
    const actor = await messageActor(tx, call.auth, atelierId, orderId);
    const [conversation, previous] = await Promise.all([tx.get(ref), tx.get(ref.collection('reads').doc(actor.uid))]);
    if (!conversation.exists || !sequence(conversation.data()?.lastSequence) || Number(data.sequence) > conversation.data()!.lastSequence) throw new HttpsError('invalid-argument', 'A leitura não pode ultrapassar as mensagens existentes.');
    await trustedConversation(tx, ref, conversation);
    const clientUid = conversationClient(conversation.data(), actor.clientUid);
    if (!actor.staff && clientUid !== actor.uid) throw new HttpsError('permission-denied', 'A conversa não pertence à sua conta.');
    const current = previous.data()?.sequence ?? 0; const next = Math.max(current, Number(data.sequence));
    if (next === current) return { sequence: current, alreadyApplied: true };
    tx.set(ref.collection('reads').doc(actor.uid), { sequence: next, updatedAt: Timestamp.now() });
    if (actor.staff && next > (conversation.data()?.staffReadSequence ?? 0)) tx.update(ref, { staffReadSequence: next });
    return { sequence: next, alreadyApplied: false };
  });
});

export const listMessageInbox = onCall(async (call) => {
  requireVerifiedIdentity(call.auth); messageInput(call.data, []);
  const profile = await adminDb.doc(`users/${call.auth!.uid}`).get();
  if (profile.data()?.active !== true || !['atelier_member', 'client'].includes(profile.data()?.accountType)) throw new HttpsError('permission-denied', 'A conta não tem acesso às conversas.');
  const staff = profile.data()!.accountType === 'atelier_member';
  const atelierId = staff && messageId(profile.data()!.atelierId) ? profile.data()!.atelierId as string : null;
  if (staff && !atelierId) throw new HttpsError('permission-denied', 'O vínculo do ateliê é inválido.');
  const snapshot = await (staff ? adminDb.collection(`ateliers/${atelierId}/conversations`).orderBy('lastMessageAt', 'desc').limit(101)
    : adminDb.collectionGroup('conversations').where('clientUserId', '==', call.auth!.uid).orderBy('lastMessageAt', 'desc').limit(101)).get();
  if (snapshot.size > 100) throw new HttpsError('resource-exhausted', 'A caixa de entrada exige paginação antes de ser exibida integralmente.');
  const conversations = []; let legacyCount = 0;
  for (const doc of snapshot.docs) {
    const tenant = doc.ref.parent.parent!.id;
    try {
      const view = await adminDb.runTransaction(async (tx) => {
        const actor = await messageActor(tx, call.auth, tenant, doc.id);
        const current = await tx.get(doc.ref);
        await trustedConversation(tx, doc.ref, current);
        const clientUid = conversationClient(current.data(), actor.clientUid);
        if (!actor.staff && clientUid !== actor.uid) return null;
        const read = await tx.get(doc.ref.collection('reads').doc(actor.uid));
        return { id: doc.id, atelierId: tenant, character: current.data()!.character, preview: current.data()!.lastPreview,
          lastMessageAt: iso(current.data()!.lastMessageAt), unread: Math.max(0, current.data()!.lastSequence - (read.data()?.sequence ?? 0)) };
      });
      if (view) conversations.push(view);
    } catch (error) { if (error instanceof HttpsError && error.code === 'failed-precondition') legacyCount++; else if (!(error instanceof HttpsError) || error.code !== 'permission-denied') throw error; }
  }
  // An empty inbox must still validate staff membership and order permission.
  if (staff) {
    const [atelier, member] = await Promise.all([adminDb.doc(`ateliers/${atelierId}`).get(), adminDb.doc(`ateliers/${atelierId}/members/${call.auth!.uid}`).get()]);
    if (atelier.data()?.active !== true || !messagePermission(member.data())) throw new HttpsError('permission-denied', 'Seu perfil não tem acesso às conversas deste ateliê.');
  }
  return { conversations, legacyCount };
});
