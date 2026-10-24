import { HttpsError, onRequest } from 'firebase-functions/v2/https';
import { adminDb, adminStorage } from '../admin';
import { identity, failure } from './order-file-bytes';
import { productionId } from './production-configuration';
import { revokeOrderFileTokens, validOrderFileBytes } from './order-file-storage';
import { orderClientUid } from './client-ownership';

/** Photos are private evidence; their URLs must not outlive the viewer's authorization. */
export const downloadProductionPhotoBytes = onRequest({ cors: true, timeoutSeconds: 120 }, async (request, response) => {
  response.set('Cache-Control', 'private, no-store');
  response.set('X-Content-Type-Options', 'nosniff');
  try {
    if (request.method !== 'GET') { response.set('Allow', 'GET'); response.status(405).end(); return; }
    const token = await identity(request);
    if (Object.keys(request.query).some((key) => !['atelierId', 'orderId', 'photoId'].includes(key))) throw new HttpsError('invalid-argument', 'Há campos fora do contrato da foto.');
    const atelierId = productionId(request.query.atelierId, 'Ateliê');
    const orderId = productionId(request.query.orderId, 'Pedido');
    const photoId = productionId(request.query.photoId, 'Foto');
    const orderRef = adminDb.doc(`ateliers/${atelierId}/orders/${orderId}`);
    const path = `ateliers/${atelierId}/orders/${orderId}/production/${photoId}`;
    const photo = await adminDb.runTransaction(async (transaction) => {
      const [atelier, order, record, profile, member] = await Promise.all([
        transaction.get(adminDb.doc(`ateliers/${atelierId}`)), transaction.get(orderRef),
        transaction.get(orderRef.collection('photos').doc(photoId)), transaction.get(adminDb.doc(`users/${token.uid}`)),
        transaction.get(adminDb.doc(`ateliers/${atelierId}/members/${token.uid}`)),
      ]);
      if (atelier.get('active') !== true || profile.get('active') !== true || !order.exists || !record.exists) throw new HttpsError('permission-denied', 'Foto indisponível para esta conta.');
      const membership = member.data();
      const permissions = Array.isArray(membership?.permissions) ? membership.permissions : [];
      const staff = profile.get('accountType') === 'atelier_member' && profile.get('atelierId') === atelierId && membership?.active === true
        && (['owner', 'admin'].includes(String(membership.role)) || permissions.includes('orders:read') || permissions.includes('orders:manage'));
      const owns = !staff && profile.get('accountType') === 'client' && await orderClientUid(transaction, atelierId, order.data()!) === token.uid;
      const value = record.data()!;
      if (value.uploadStatus !== 'ready' || (!staff && !(owns && value.visibleToClient === true))) throw new HttpsError('permission-denied', 'Foto indisponível para esta conta.');
      if (value.storagePath !== path || value.atelierId !== atelierId || value.orderId !== orderId) throw new HttpsError('failed-precondition', 'A referência da foto precisa de revisão.');
      return value;
    });
    const object = adminStorage.bucket().file(path, photo.storageGeneration ? { generation: String(photo.storageGeneration) } : undefined);
    const [metadata] = await object.getMetadata();
    if (photo.storageGeneration && String(metadata.generation) !== String(photo.storageGeneration)) throw new HttpsError('failed-precondition', 'A foto não corresponde à evidência registrada.');
    const size = Number(metadata.size);
    const contentType = String(metadata.contentType ?? '');
    if (size < 1 || size > 10 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(contentType) || contentType !== photo.contentType) throw new HttpsError('failed-precondition', 'O conteúdo da foto precisa de revisão.');
    const [bytes] = await object.download();
    if (bytes.length !== size || !validOrderFileBytes(bytes, contentType)) throw new HttpsError('failed-precondition', 'O conteúdo da foto é inválido.');
    // Revoke legacy links on an authorized read; new uploads revoke them before becoming ready.
    await revokeOrderFileTokens(path);
    response.set('Content-Type', contentType);
    response.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(String(photo.originalName || 'foto'))}`);
    response.send(bytes);
  } catch (error) { const result = failure(error); response.status(result.status).json({ error: result.error }); }
});
