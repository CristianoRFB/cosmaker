import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onRequest, type Request } from 'firebase-functions/v2/https';
import { adminAuth, adminDb, adminStorage } from '../admin';
import { ids, manager } from './order-files';
import { orderFileHash, orderFileMaxBytes, orderFilePath, revokeOrderFileTokens, validOrderFileBytes } from './order-file-storage';

export async function identity(request: Request) {
  const bearer = request.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
  if (!bearer) throw new HttpsError('unauthenticated', 'Entre na sua conta para acessar arquivos.');
  let token;
  try { token = await adminAuth.verifyIdToken(bearer, true); }
  catch { throw new HttpsError('unauthenticated', 'A sessão expirou. Entre novamente.'); }
  if (token.email_verified !== true) throw new HttpsError('failed-precondition', 'Confirme seu e-mail para acessar arquivos.');
  return token;
}

export function failure(error: unknown) {
  const known = error instanceof HttpsError ? error : new HttpsError('internal', 'Não foi possível concluir a transferência do arquivo.');
  const statuses: Record<string, number> = { 'unauthenticated': 401, 'permission-denied': 403, 'not-found': 404, 'invalid-argument': 400, 'failed-precondition': 409, 'already-exists': 409, 'aborted': 409, 'resource-exhausted': 413, 'unavailable': 503 };
  return { status: statuses[known.code] ?? 500, error: { code: known.code, message: known.message, ...(known.details === undefined ? {} : { details: known.details }) } };
}

export const uploadOrderFileBytes = onRequest({ cors: true, timeoutSeconds: 120, memory: '512MiB' }, async (request, response) => {
  response.set('Cache-Control', 'private, no-store');
  const uploadState: { lease: { ref: FirebaseFirestore.DocumentReference; id: string } | null } = { lease: null };
  try {
    if (request.method !== 'POST') { response.set('Allow', 'POST'); response.status(405).end(); return; }
    const token = await identity(request);
    const { atelierId, orderId, fileId } = ids(request.query, true);
    const orderRef = adminDb.doc(`ateliers/${atelierId}/orders/${orderId}`);
    const fileRef = orderRef.collection('files').doc(fileId);
    const path = orderFilePath(atelierId, orderId, fileId);
    const bytes = request.rawBody;
    if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > orderFileMaxBytes) throw new HttpsError('invalid-argument', 'Use um arquivo de até 20 MB.');
    const contentType = request.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
    const hash = orderFileHash(bytes);
    const contentValid = validOrderFileBytes(bytes, contentType);
    const leaseId = randomUUID();
    const current = await adminDb.runTransaction(async (transaction) => {
      await manager(transaction, atelierId, token.uid);
      const [file, order] = await Promise.all([transaction.get(fileRef), transaction.get(orderRef)]);
      if (!order.exists || !file.exists || file.data()?.uploadedBy !== token.uid) throw new HttpsError('permission-denied', 'Este envio não pertence à sua conta.');
      const value = file.data()!;
      if (value.source !== 'order_upload' || value.storagePath !== path) throw new HttpsError('failed-precondition', 'Referência de envio inválida.');
      if (!['pending', 'ready'].includes(String(value.uploadStatus))) throw new HttpsError('failed-precondition', 'Este envio foi recusado ou cancelado.', { reason: 'upload_rejected' });
      if (hash !== value.sha256 || bytes.length !== value.size || contentType !== value.contentType) throw new HttpsError('invalid-argument', 'Os bytes não correspondem ao arquivo declarado.');
      if (value.uploadStatus === 'pending' && contentValid) {
        if (Number(value.uploadLeaseExpiresAtMs) > Date.now() && value.uploadLeaseId !== leaseId) throw new HttpsError('aborted', 'Este arquivo está sendo enviado. Aguarde e tente novamente.');
        uploadState.lease = { ref: fileRef, id: leaseId };
        transaction.update(fileRef, { uploadLeaseId: leaseId, uploadLeaseExpiresAtMs: Date.now() + 300_000 });
      }
      return value;
    });
    if (current.uploadStatus === 'ready') { response.json({ fileId, status: 'ready', alreadyApplied: true }); return; }
    if (!contentValid) {
      await adminDb.runTransaction(async (transaction) => {
        await manager(transaction, atelierId, token.uid);
        const file = await transaction.get(fileRef);
        if (file.data()?.uploadStatus === 'pending' && file.data()?.uploadedBy === token.uid) {
          transaction.update(fileRef, { uploadStatus: 'rejected', completedAt: FieldValue.serverTimestamp() });
          transaction.create(adminDb.collection('auditLogs').doc(), { actorId: token.uid, atelierId, action: 'order.file_rejected', entity: 'order', entityId: orderId, after: { fileId }, timestamp: FieldValue.serverTimestamp() });
        }
      });
      throw new HttpsError('failed-precondition', 'O arquivo não passou pela validação de conteúdo.', { reason: 'upload_rejected' });
    }
    const object = adminStorage.bucket().file(path);
    try {
      await object.save(bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType, cacheControl: 'private, no-store', metadata: { fileId, orderId, sha256: hash } } });
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && [409, 412].includes(Number(error.code)))) throw error;
      const [existing] = await object.getMetadata();
      if (existing.metadata?.sha256 !== hash || Number(existing.size) !== bytes.length || existing.contentType !== contentType) throw new HttpsError('already-exists', 'Outro conteúdo já ocupa este envio.');
    }
    await revokeOrderFileTokens(path);
    const [metadata] = await object.getMetadata();
    const result = await adminDb.runTransaction(async (transaction) => {
      await manager(transaction, atelierId, token.uid);
      const [file, order] = await Promise.all([transaction.get(fileRef), transaction.get(orderRef)]);
      if (!file.exists || !order.exists || file.data()?.uploadedBy !== token.uid || file.data()?.sha256 !== hash) throw new HttpsError('permission-denied', 'O envio não está disponível para esta conta.');
      if (file.data()?.uploadStatus === 'ready') return { fileId, status: 'ready', alreadyApplied: true };
      if (file.data()?.uploadStatus !== 'pending') throw new HttpsError('failed-precondition', 'Este envio foi cancelado ou alterado.', { reason: 'upload_rejected' });
      if (file.data()?.uploadLeaseId !== leaseId) throw new HttpsError('aborted', 'A tentativa de envio expirou. Atualize o pedido e tente novamente.');
      transaction.update(fileRef, { uploadStatus: 'ready', generation: String(metadata.generation), uploadLeaseId: FieldValue.delete(), uploadLeaseExpiresAtMs: FieldValue.delete(), completedAt: FieldValue.serverTimestamp() });
      transaction.create(adminDb.collection('auditLogs').doc(), { actorId: token.uid, atelierId, action: 'order.file_uploaded', entity: 'order', entityId: orderId, after: { fileId, size: bytes.length, contentType, visibleToClient: file.data()!.visibleToClient }, timestamp: FieldValue.serverTimestamp() });
      transaction.create(orderRef.collection('statusHistory').doc(), { status: order.data()!.status, actorId: token.uid, source: 'order_file_uploaded', createdAt: FieldValue.serverTimestamp() });
      return { fileId, status: 'ready', alreadyApplied: false };
    });
    response.json(result);
  } catch (error) { const result = failure(error); response.status(result.status).json({ error: result.error }); }
  finally {
    if (uploadState.lease) {
      const held = uploadState.lease;
      await adminDb.runTransaction(async (transaction) => {
        const current = await transaction.get(held.ref);
        if (current.data()?.uploadLeaseId === held.id) transaction.update(held.ref, { uploadLeaseId: FieldValue.delete(), uploadLeaseExpiresAtMs: FieldValue.delete() });
      }).catch(() => undefined);
    }
  }
});

export const downloadOrderFileBytes = onRequest({ cors: true, timeoutSeconds: 120 }, async (request, response) => {
  response.set('Cache-Control', 'private, no-store');
  response.set('X-Content-Type-Options', 'nosniff');
  try {
    if (request.method !== 'GET') { response.set('Allow', 'GET'); response.status(405).end(); return; }
    const token = await identity(request);
    const { atelierId, orderId, fileId } = ids(request.query, true);
    const orderRef = adminDb.doc(`ateliers/${atelierId}/orders/${orderId}`);
    const file = await adminDb.runTransaction(async (transaction) => {
      const [atelier, order, fileSnapshot, profile, member] = await Promise.all([
        transaction.get(adminDb.doc(`ateliers/${atelierId}`)), transaction.get(orderRef), transaction.get(orderRef.collection('files').doc(fileId)),
        transaction.get(adminDb.doc(`users/${token.uid}`)), transaction.get(adminDb.doc(`ateliers/${atelierId}/members/${token.uid}`)),
      ]);
      if (atelier.data()?.active !== true || profile.data()?.active !== true || !order.exists || !fileSnapshot.exists) throw new HttpsError('permission-denied', 'Arquivo indisponível para esta conta.');
      const membership = member.data();
      const permissions = Array.isArray(membership?.permissions) ? membership.permissions : [];
      const staff = profile.data()?.accountType === 'atelier_member' && profile.data()?.atelierId === atelierId && membership?.active === true
        && (['owner', 'admin'].includes(String(membership.role)) || permissions.includes('orders:read') || permissions.includes('orders:manage'));
      const value = fileSnapshot.data()!;
      const orderValue = order.data()!;
      const clientId = typeof orderValue.clientId === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(orderValue.clientId) ? orderValue.clientId : null;
      const client = clientId ? await transaction.get(adminDb.doc(`ateliers/${atelierId}/clients/${clientId}`)) : null;
      const orderUid = typeof orderValue.clientUserId === 'string' ? orderValue.clientUserId : null;
      const profileUid = typeof client?.data()?.userId === 'string' ? String(client.data()!.userId) : null;
      const linkedUid = orderUid ?? profileUid;
      const conflictingLink = orderUid && profileUid && orderUid !== profileUid;
      const owns = profile.data()?.accountType === 'client' && !conflictingLink && (linkedUid ? linkedUid === token.uid : typeof token.email === 'string' && typeof orderValue.email === 'string' && token.email.toLowerCase() === orderValue.email.toLowerCase());
      const ready = value.uploadStatus === 'ready' || (value.source === 'quote_request' && value.uploadStatus === undefined);
      if (!ready || (!staff && !(owns && value.archived !== true && (value.visibleToClient === true || value.source === 'quote_request')))) throw new HttpsError('permission-denied', 'Arquivo indisponível para esta conta.');
      const expected = orderFilePath(atelierId, orderId, fileId);
      const legacy = value.source === 'quote_request' && typeof orderValue.requestId === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(orderValue.requestId)
        && value.storagePath === `ateliers/${atelierId}/quoteRequests/${orderValue.requestId}/references/${fileId}`;
      if (value.storagePath !== expected && !legacy) throw new HttpsError('failed-precondition', 'A referência do arquivo precisa de revisão.');
      return value;
    });
    const object = adminStorage.bucket().file(String(file.storagePath), file.generation ? { generation: String(file.generation) } : undefined);
    const [metadata] = await object.getMetadata();
    if (Number(metadata.size) > orderFileMaxBytes || Number(metadata.size) < 1) throw new HttpsError('failed-precondition', 'O tamanho deste arquivo é inválido.');
    response.set('Content-Type', String(file.contentType || 'application/octet-stream'));
    response.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(String(file.originalName || 'arquivo'))}`);
    const [bytes] = await object.download();
    response.send(bytes);
  } catch (error) { const result = failure(error); response.status(result.status).json({ error: result.error }); }
});
