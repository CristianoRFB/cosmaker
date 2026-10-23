import { randomUUID } from 'node:crypto';
import { FieldValue, type DocumentReference } from 'firebase-admin/firestore';
import { HttpsError, onRequest } from 'firebase-functions/v2/https';
import { adminDb, adminStorage } from '../admin';
import { messageInput } from '../messages/access';
import { identity, failure } from './order-file-bytes';
import { productionId, readProductionManager } from './production-configuration';
import { orderFileHash, revokeOrderFileTokens, validOrderFileBytes } from './order-file-storage';
import { acceptedTypes, activeOrderStatuses, maxPhotoBytes, finishProductionPhotoUpload } from './production-photos';

/** No Storage Rules cross-service budget: all authorities are checked in server transactions. */
export const uploadProductionPhotoBytes = onRequest({ cors: true, timeoutSeconds: 120, memory: '512MiB' }, async (request, response) => {
  response.set('Cache-Control', 'private, no-store');
  const lease: { ref: DocumentReference | null; id: string } = { ref: null, id: randomUUID() };
  try {
    if (request.method !== 'POST') { response.set('Allow', 'POST'); response.status(405).end(); return; }
    const token = await identity(request);
    const data = messageInput(request.query, ['atelierId', 'orderId', 'photoId']);
    const atelierId = productionId(data.atelierId, 'Ateliê');
    const orderId = productionId(data.orderId, 'Pedido');
    const photoId = productionId(data.photoId, 'Foto');
    const orderRef = adminDb.doc(`ateliers/${atelierId}/orders/${orderId}`);
    const photoRef = orderRef.collection('photos').doc(photoId);
    const path = `ateliers/${atelierId}/orders/${orderId}/production/${photoId}`;
    const bytes = request.rawBody;
    const contentType = request.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
    if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > maxPhotoBytes || !acceptedTypes.includes(contentType) || !validOrderFileBytes(bytes, contentType)) throw new HttpsError('invalid-argument', 'Use uma imagem JPEG, PNG ou WebP válida de até 10 MB.');
    const sha256 = orderFileHash(bytes);
    const current = await adminDb.runTransaction(async (tx) => {
      const actor = await readProductionManager(tx, atelierId, token.uid);
      if (actor.atelier.demoWorkspace === true) throw new HttpsError('failed-precondition', 'Fotos de produção não são gravadas no espaço demonstrativo.');
      const [order, photo] = await Promise.all([tx.get(orderRef), tx.get(photoRef)]);
      const value = photo.data();
      if (!order.exists || !value || value.uploadedBy !== token.uid) throw new HttpsError('permission-denied', 'Este envio não pertence à sua conta.');
      if (value.atelierId !== atelierId || value.orderId !== orderId || value.storagePath !== path || value.contentType !== contentType) throw new HttpsError('failed-precondition', 'A foto não corresponde ao envio declarado.');
      if (!['pending', 'ready'].includes(value.uploadStatus)) throw new HttpsError('failed-precondition', 'Este envio não está disponível.');
      if (value.sha256 !== undefined && value.sha256 !== sha256) throw new HttpsError('already-exists', 'Outro conteúdo já está vinculado a este envio.');
      if (value.uploadStatus === 'ready') {
        if (value.sha256 !== sha256 || value.size !== bytes.length) throw new HttpsError('already-exists', 'Este envio já foi concluído com outro conteúdo.');
        return value;
      }
      const stage = await tx.get(orderRef.collection('productionStages').doc(productionId(value.stageId, 'Etapa')));
      if (!activeOrderStatuses.includes(String(order.get('status'))) || !stage.exists || !['in_progress', 'completed', 'approved', 'blocked'].includes(String(stage.get('status')))) throw new HttpsError('failed-precondition', 'O pedido ou a etapa não permite enviar esta foto.');
      if (Number(value.uploadLeaseExpiresAtMs) > Date.now()) throw new HttpsError('aborted', 'A foto está sendo enviada. Aguarde e tente novamente.');
      lease.ref = photoRef;
      tx.update(photoRef, { sha256, size: bytes.length, uploadLeaseId: lease.id, uploadLeaseExpiresAtMs: Date.now() + 300_000 });
      return value;
    });
    const object = adminStorage.bucket().file(path);
    if (current.uploadStatus === 'ready') {
      const [metadata] = await object.getMetadata();
      if (String(metadata.generation) !== current.storageGeneration || metadata.contentType !== contentType || Number(metadata.size) !== bytes.length) throw new HttpsError('failed-precondition', 'A foto armazenada precisa de conferência.');
      await finishProductionPhotoUpload({ auth: { uid: token.uid, token }, data: { atelierId, orderId, photoId } });
      response.json({ photoId, status: 'ready', alreadyApplied: true }); return;
    }
    try {
      await object.save(bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType, cacheControl: 'private, no-store', metadata: { photoId, orderId, sha256 } } });
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && [409, 412].includes(Number(error.code)))) throw error;
      const [metadata] = await object.getMetadata();
      if (Number(metadata.size) !== bytes.length || metadata.contentType !== contentType) throw new HttpsError('already-exists', 'Outro conteúdo já ocupa este envio.');
      const [stored] = await object.download();
      if (orderFileHash(stored) !== sha256) throw new HttpsError('already-exists', 'Outro conteúdo já ocupa este envio.');
    }
    await revokeOrderFileTokens(path);
    // Completion rechecks current profile, membership, tenant, order and approval state after I/O.
    const result = await finishProductionPhotoUpload({ auth: { uid: token.uid, token }, data: { atelierId, orderId, photoId } }, lease.id);
    response.json({ ...result, alreadyApplied: false });
  } catch (error) { const result = failure(error); response.status(result.status).json({ error: result.error }); }
  finally {
    if (lease.ref) {
      const ref = lease.ref;
      await adminDb.runTransaction(async (tx) => {
        const current = await tx.get(ref);
        if (current.get('uploadLeaseId') === lease.id) tx.update(ref, { uploadLeaseId: FieldValue.delete(), uploadLeaseExpiresAtMs: FieldValue.delete() });
      }).catch(() => undefined);
    }
  }
});
