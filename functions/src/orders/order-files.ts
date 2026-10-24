import { FieldValue, type Transaction } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb, adminStorage } from '../admin';
import { requireVerifiedIdentity } from './access';
import { orderFileHash, revokeOrderFileTokens, validOrderFileBytes } from './order-file-storage';
import { orderClientUid } from './client-ownership';

const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const maxBytes = 20 * 1024 * 1024;
const categories = new Set(['reference', 'document', 'approval', 'shipping']);

function input(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpsError('invalid-argument', 'Solicitação inválida.');
  return value as Record<string, unknown>;
}
function id(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(value);
}
export function ids(data: Record<string, unknown>, withFile = false) {
  if (!id(data.atelierId) || !id(data.orderId) || (withFile && !id(data.fileId))) {
    throw new HttpsError('invalid-argument', 'Ateliê, pedido ou arquivo inválidos.');
  }
  return { atelierId: data.atelierId, orderId: data.orderId, fileId: withFile ? String(data.fileId) : '' };
}
function only(data: Record<string, unknown>, keys: string[]) {
  if (Object.keys(data).some((key) => !keys.includes(key))) throw new HttpsError('invalid-argument', 'A solicitação contém campos não aceitos.');
}
export async function manager(transaction: Transaction, atelierId: string, uid: string, write = true) {
  const [atelier, member, profile] = await Promise.all([
    transaction.get(adminDb.doc(`ateliers/${atelierId}`)),
    transaction.get(adminDb.doc(`ateliers/${atelierId}/members/${uid}`)),
    transaction.get(adminDb.doc(`users/${uid}`)),
  ]);
  const data = member.data();
  const permissions = Array.isArray(data?.permissions) ? data.permissions : [];
  if (!atelier.exists || atelier.data()?.active !== true || !member.exists || data?.active !== true
    || !(data.role === 'owner' || data.role === 'admin' || permissions.includes('orders:manage') || (!write && permissions.includes('orders:read')))) {
    throw new HttpsError('permission-denied', 'Sua conta não tem acesso aos arquivos deste ateliê.');
  }
  if (write && atelier.data()?.demoWorkspace === true) throw new HttpsError('failed-precondition', 'Arquivos não podem ser alterados neste espaço de demonstração.');
  if (profile.data()?.active !== true || profile.data()?.accountType !== 'atelier_member' || profile.data()?.atelierId !== atelierId) {
    throw new HttpsError('permission-denied', 'O perfil da conta não pertence a este ateliê ativo.');
  }
}
function iso(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return (value.toDate() as Date).toISOString();
  return value instanceof Date ? value.toISOString() : null;
}
function fileView(fileId: string, data: Record<string, unknown>, atelierId: string) {
  const storagePath = typeof data.storagePath === 'string' ? data.storagePath : '';
  if (!storagePath.startsWith(`ateliers/${atelierId}/orders/`) && !storagePath.startsWith(`ateliers/${atelierId}/quoteRequests/`)) {
    throw new HttpsError('failed-precondition', 'Um arquivo tem referência de armazenamento inválida e precisa de revisão.');
  }
  return {
    id: fileId, storagePath, originalName: data.originalName, contentType: data.contentType,
    size: data.size ?? 0, source: data.source ?? 'order_upload', category: data.category ?? 'reference',
    visibleToClient: data.visibleToClient === true || data.source === 'quote_request',
    uploadStatus: data.uploadStatus ?? 'ready', archived: data.archived === true,
    revision: Number.isSafeInteger(data.revision) ? data.revision : 0,
    createdAt: iso(data.createdAt),
  };
}

export const listOrderFiles = onCall(async (call) => {
  requireVerifiedIdentity(call.auth);
  const data = input(call.data);
  only(data, ['atelierId', 'orderId']);
  const { atelierId, orderId } = ids(data);
  const orderRef = adminDb.doc(`ateliers/${atelierId}/orders/${orderId}`);
  return adminDb.runTransaction(async (transaction) => {
    const [atelier, order, member, profile] = await Promise.all([
      transaction.get(adminDb.doc(`ateliers/${atelierId}`)), transaction.get(orderRef),
      transaction.get(adminDb.doc(`ateliers/${atelierId}/members/${call.auth!.uid}`)),
      transaction.get(adminDb.doc(`users/${call.auth!.uid}`)),
    ]);
    if (!atelier.exists || atelier.data()?.active !== true || !order.exists) throw new HttpsError('permission-denied', 'O pedido não está disponível para esta conta.');
    const membership = member.data();
    const permissions = Array.isArray(membership?.permissions) ? membership.permissions : [];
    const staff = profile.data()?.active === true && profile.data()?.accountType === 'atelier_member' && profile.data()?.atelierId === atelierId
      && membership?.active === true && (['owner', 'admin'].includes(String(membership.role)) || permissions.includes('orders:read') || permissions.includes('orders:manage'));
    const owns = !staff && profile.data()?.accountType === 'client' && await orderClientUid(transaction, atelierId, order.data()!) === call.auth!.uid;
    if (profile.data()?.active !== true || (!staff && !owns)) throw new HttpsError('permission-denied', 'O pedido não está disponível para esta conta.');
    const snapshot = await transaction.get(orderRef.collection('files').orderBy('createdAt', 'asc'));
    const files = snapshot.docs.map((document) => fileView(document.id, document.data(), atelierId));
    return { files: staff ? files : files.filter((file) => file.visibleToClient && !file.archived && file.uploadStatus === 'ready') };
  });
});

export const createOrderFileUpload = onCall(async (call) => {
  requireVerifiedIdentity(call.auth);
  const data = input(call.data);
  only(data, ['atelierId', 'orderId', 'requestId', 'originalName', 'contentType', 'size', 'category', 'visibleToClient', 'sha256']);
  const { atelierId, orderId } = ids(data);
  if (!id(data.requestId) || String(data.requestId).length < 8) throw new HttpsError('invalid-argument', 'Informe a chave única do envio.');
  const originalName = typeof data.originalName === 'string' ? data.originalName.trim() : '';
  if (!originalName || originalName.length > 160 || /[\x00-\x1f]/.test(originalName)) throw new HttpsError('invalid-argument', 'Nome de arquivo inválido.');
  if (typeof data.contentType !== 'string' || !acceptedTypes.has(data.contentType) || !Number.isSafeInteger(data.size) || Number(data.size) < 1 || Number(data.size) > maxBytes) {
    throw new HttpsError('invalid-argument', 'Use imagem JPEG, PNG, WebP ou PDF de até 20 MB.');
  }
  if (!categories.has(String(data.category)) || typeof data.visibleToClient !== 'boolean' || typeof data.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(data.sha256)) throw new HttpsError('invalid-argument', 'Categoria, visibilidade ou assinatura do arquivo inválidas.');
  const orderRef = adminDb.doc(`ateliers/${atelierId}/orders/${orderId}`);
  const fileRef = orderRef.collection('files').doc(String(data.requestId));
  const storagePath = `ateliers/${atelierId}/orders/${orderId}/attachments/${fileRef.id}`;
  const fingerprint = JSON.stringify([originalName, data.contentType, data.size, data.category, data.visibleToClient, data.sha256]);
  return adminDb.runTransaction(async (transaction) => {
    await manager(transaction, atelierId, call.auth!.uid);
    const [order, current] = await Promise.all([transaction.get(orderRef), transaction.get(fileRef)]);
    if (!order.exists) throw new HttpsError('not-found', 'Pedido não encontrado.');
    if (current.exists) {
      if (current.data()?.requestFingerprint !== fingerprint || current.data()?.uploadedBy !== call.auth!.uid) throw new HttpsError('already-exists', 'A chave já foi usada para outro arquivo.');
      if (['rejected', 'cancelled'].includes(String(current.data()?.uploadStatus))) throw new HttpsError('failed-precondition', 'O envio anterior foi recusado ou cancelado. Inicie um novo envio.', { reason: 'upload_rejected' });
      return { fileId: fileRef.id, storagePath, status: current.data()?.uploadStatus, alreadyCreated: true };
    }
    transaction.create(fileRef, {
      atelierId, orderId, storagePath, originalName, contentType: data.contentType, size: data.size, sha256: data.sha256,
      category: data.category, visibleToClient: data.visibleToClient, source: 'order_upload',
      uploadStatus: 'pending', archived: false, revision: 0, uploadedBy: call.auth!.uid,
      requestFingerprint: fingerprint, createdAt: FieldValue.serverTimestamp(),
    });
    return { fileId: fileRef.id, storagePath, status: 'pending', alreadyCreated: false };
  });
});

export const completeOrderFileUpload = onCall(async (call) => {
  requireVerifiedIdentity(call.auth);
  const data = input(call.data);
  only(data, ['atelierId', 'orderId', 'fileId']);
  const { atelierId, orderId, fileId } = ids(data, true);
  const orderRef = adminDb.doc(`ateliers/${atelierId}/orders/${orderId}`);
  const fileRef = orderRef.collection('files').doc(fileId);
  const snapshot = await adminDb.runTransaction(async (transaction) => {
    await manager(transaction, atelierId, call.auth!.uid);
    const current = await transaction.get(fileRef);
    if (!current.exists || current.data()?.uploadedBy !== call.auth!.uid) throw new HttpsError('permission-denied', 'Este upload não pertence à sua conta.');
    return current.data()!;
  });
  if (snapshot.uploadStatus === 'ready') return { fileId, status: 'ready', alreadyApplied: true };
  if (snapshot.uploadStatus !== 'pending') throw new HttpsError('failed-precondition', 'Este envio não está pendente.');
  const path = `ateliers/${atelierId}/orders/${orderId}/attachments/${fileId}`;
  if (snapshot.storagePath !== path) throw new HttpsError('failed-precondition', 'O endereço do envio é inválido.');
  const object = adminStorage.bucket().file(path);
  let metadata: { size?: string | number; contentType?: string; metadata?: Record<string, unknown>; generation?: string | number };
  let bytes: Buffer;
  try {
    [metadata] = await object.getMetadata();
    if (Number(metadata.size) > maxBytes) throw new Error('oversized');
    [bytes] = await object.download();
  } catch { throw new HttpsError('failed-precondition', 'O arquivo não chegou ao armazenamento. Tente enviar novamente.', { reason: 'file_not_received' }); }
  const type = String(metadata.contentType ?? '');
  const valid = validOrderFileBytes(bytes, type) && orderFileHash(bytes) === snapshot.sha256 && Number(metadata.size) === snapshot.size && type === snapshot.contentType
    && metadata.metadata?.fileId === fileId && metadata.metadata?.orderId === orderId;
  if (valid) {
    // Download tokens bypass Storage Rules. Ready attachments are read with authenticated bytes.
    await revokeOrderFileTokens(path);
  }
  const auditRef = adminDb.collection('auditLogs').doc();
  const result = await adminDb.runTransaction(async (transaction) => {
    await manager(transaction, atelierId, call.auth!.uid);
    const [current, order] = await Promise.all([transaction.get(fileRef), transaction.get(orderRef)]);
    if (current.data()?.uploadStatus === 'ready') return { fileId, status: 'ready', alreadyApplied: true };
    if (!order.exists || !current.exists || current.data()?.uploadStatus !== 'pending' || current.data()?.uploadedBy !== call.auth!.uid) throw new HttpsError('failed-precondition', 'O estado do upload mudou. Atualize o pedido.');
    transaction.update(fileRef, { uploadStatus: valid ? 'ready' : 'rejected', completedAt: FieldValue.serverTimestamp(), generation: String(metadata.generation ?? '') });
    transaction.create(auditRef, { actorId: call.auth!.uid, atelierId, action: valid ? 'order.file_uploaded' : 'order.file_rejected', entity: 'order', entityId: orderId, after: { fileId, size: snapshot.size, contentType: type, visibleToClient: snapshot.visibleToClient }, timestamp: FieldValue.serverTimestamp() });
    if (valid) transaction.create(orderRef.collection('statusHistory').doc(), { status: order.data()!.status, actorId: call.auth!.uid, source: 'order_file_uploaded', createdAt: FieldValue.serverTimestamp() });
    return { fileId, status: valid ? 'ready' : 'rejected', alreadyApplied: false };
  });
  if (result.status === 'rejected') {
    await object.delete({ ignoreNotFound: true }).catch(() => undefined);
    throw new HttpsError('failed-precondition', 'O arquivo não passou pela validação de conteúdo, tamanho ou tipo.', { reason: 'upload_rejected' });
  }
  return result;
});

export const updateOrderFileAccess = onCall(async (call) => {
  requireVerifiedIdentity(call.auth);
  const data = input(call.data);
  only(data, ['atelierId', 'orderId', 'fileId', 'requestId', 'expectedRevision', 'visibleToClient', 'archived']);
  const { atelierId, orderId, fileId } = ids(data, true);
  if (!id(data.requestId) || String(data.requestId).length < 8 || !Number.isSafeInteger(data.expectedRevision) || Number(data.expectedRevision) < 0 || typeof data.visibleToClient !== 'boolean' || typeof data.archived !== 'boolean') throw new HttpsError('invalid-argument', 'Alteração de arquivo inválida.');
  const orderRef = adminDb.doc(`ateliers/${atelierId}/orders/${orderId}`);
  const fileRef = orderRef.collection('files').doc(fileId);
  const operationRef = orderRef.collection('fileActions').doc(String(data.requestId));
  const fingerprint = JSON.stringify([fileId, data.expectedRevision, data.visibleToClient, data.archived]);
  const auditRef = adminDb.collection('auditLogs').doc();
  if (data.visibleToClient === false || data.archived === true) {
    await adminDb.runTransaction(async (transaction) => {
      await manager(transaction, atelierId, call.auth!.uid);
      const file = await transaction.get(fileRef);
      if (!file.exists || file.data()?.source !== 'order_upload'
        || file.data()?.storagePath !== `ateliers/${atelierId}/orders/${orderId}/attachments/${fileId}`) {
        throw new HttpsError('failed-precondition', 'O arquivo não pertence ao fluxo de anexos deste pedido.');
      }
    });
    await revokeOrderFileTokens(`ateliers/${atelierId}/orders/${orderId}/attachments/${fileId}`);
  }
  return adminDb.runTransaction(async (transaction) => {
    await manager(transaction, atelierId, call.auth!.uid);
    const [file, operation, order] = await Promise.all([transaction.get(fileRef), transaction.get(operationRef), transaction.get(orderRef)]);
    if (operation.exists) {
      if (operation.data()?.fingerprint !== fingerprint || operation.data()?.actorId !== call.auth!.uid) throw new HttpsError('already-exists', 'Chave já usada em outra alteração.');
      return { fileId, revision: operation.data()?.revision, alreadyApplied: true };
    }
    if (!file.exists || !order.exists) throw new HttpsError('not-found', 'Arquivo ou pedido não encontrado.');
    const current = file.data()!;
    if (current.source === 'quote_request') throw new HttpsError('failed-precondition', 'A referência da solicitação pertence ao snapshot original e deve ser preservada.');
    const cancellingUpload = data.archived === true && ['pending', 'rejected'].includes(String(current.uploadStatus));
    if ((!cancellingUpload && current.uploadStatus !== 'ready') || (current.revision ?? 0) !== data.expectedRevision) throw new HttpsError('failed-precondition', 'O arquivo foi alterado ou ainda não está pronto. Atualize a lista.');
    const revision = Number(data.expectedRevision) + 1;
    const visibleToClient = data.archived ? false : data.visibleToClient;
    transaction.update(fileRef, { visibleToClient, archived: data.archived, revision, ...(cancellingUpload ? { uploadStatus: 'cancelled' } : {}), updatedAt: FieldValue.serverTimestamp() });
    transaction.create(operationRef, { actorId: call.auth!.uid, fingerprint, fileId, revision, createdAt: FieldValue.serverTimestamp() });
    transaction.create(auditRef, { actorId: call.auth!.uid, atelierId, action: 'order.file_access_updated', entity: 'order', entityId: orderId, before: { fileId, visibleToClient: current.visibleToClient, archived: current.archived }, after: { fileId, visibleToClient, archived: data.archived, revision }, timestamp: FieldValue.serverTimestamp() });
    transaction.create(orderRef.collection('statusHistory').doc(), { status: order.data()!.status, actorId: call.auth!.uid, source: 'order_file_access_updated', createdAt: FieldValue.serverTimestamp() });
    return { fileId, revision, alreadyApplied: false };
  });
});
