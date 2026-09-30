import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb, adminStorage } from '../admin';
import { requireOrderManager, requireVerifiedIdentity } from './access';

const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxPhotoBytes = 10 * 1024 * 1024;

export const createProductionPhotoUpload = onCall(async (call) => {
  requireVerifiedIdentity(call.auth);
  const data = call.data as {
    atelierId?: unknown; orderId?: unknown; stageId?: unknown; originalName?: unknown;
    contentType?: unknown; caption?: unknown; visibleToClient?: unknown;
  };
  if (typeof data.atelierId !== 'string' || typeof data.orderId !== 'string' || typeof data.stageId !== 'string') {
    throw new HttpsError('invalid-argument', 'Ateliê, pedido e etapa são obrigatórios.');
  }
  if (typeof data.originalName !== 'string' || !data.originalName.trim() || data.originalName.length > 160) {
    throw new HttpsError('invalid-argument', 'Informe um nome de arquivo válido.');
  }
  if (typeof data.contentType !== 'string' || !acceptedTypes.includes(data.contentType)) {
    throw new HttpsError('invalid-argument', 'Use uma imagem JPEG, PNG ou WebP.');
  }
  const caption = typeof data.caption === 'string' ? data.caption.trim() : '';
  if (caption.length > 500 || typeof data.visibleToClient !== 'boolean') {
    throw new HttpsError('invalid-argument', 'Descrição ou visibilidade da foto inválida.');
  }
  await requireOrderManager(data.atelierId, call.auth!.uid, 'orders:manage');

  const orderRef = adminDb.doc(`ateliers/${data.atelierId}/orders/${data.orderId}`);
  const [order, stage] = await Promise.all([
    orderRef.get(), orderRef.collection('productionStages').doc(data.stageId).get(),
  ]);
  if (!order.exists || !stage.exists) throw new HttpsError('not-found', 'Pedido ou etapa não encontrados.');
  if (!['confirmed', 'scheduled', 'modeling', 'in_production', 'fitting', 'adjustments', 'finishing', 'paused'].includes(String(order.data()?.status))) {
    throw new HttpsError('failed-precondition', 'As fotos de produção ficam disponíveis após a confirmação do sinal.');
  }
  if (!['in_progress', 'waiting_approval', 'completed', 'blocked'].includes(String(stage.data()?.status))) {
    throw new HttpsError('failed-precondition', 'Inicie a etapa antes de anexar fotos de progresso.');
  }

  const photoRef = orderRef.collection('photos').doc();
  const storagePath = `ateliers/${data.atelierId}/orders/${data.orderId}/production/${photoRef.id}`;
  await photoRef.create({
    atelierId: data.atelierId, orderId: data.orderId, stageId: data.stageId,
    storagePath, caption, originalName: data.originalName.trim(), contentType: data.contentType,
    size: null, visibleToClient: data.visibleToClient, uploadStatus: 'pending',
    uploadedBy: call.auth!.uid, createdAt: FieldValue.serverTimestamp(),
  });
  return { photoId: photoRef.id, storagePath };
});

export const completeProductionPhotoUpload = onCall(async (call) => {
  requireVerifiedIdentity(call.auth);
  const data = call.data as { atelierId?: unknown; orderId?: unknown; photoId?: unknown };
  if (typeof data.atelierId !== 'string' || typeof data.orderId !== 'string' || typeof data.photoId !== 'string') {
    throw new HttpsError('invalid-argument', 'Ateliê, pedido e foto são obrigatórios.');
  }
  await requireOrderManager(data.atelierId, call.auth!.uid, 'orders:manage');
  const orderRef = adminDb.doc(`ateliers/${data.atelierId}/orders/${data.orderId}`);
  const photoRef = orderRef.collection('photos').doc(data.photoId);
  const photoSnapshot = await photoRef.get();
  if (!photoSnapshot.exists) throw new HttpsError('not-found', 'A solicitação de upload não foi encontrada.');
  const photo = photoSnapshot.data()!;
  if (photo.uploadedBy !== call.auth!.uid) throw new HttpsError('permission-denied', 'Somente quem iniciou este upload pode finalizá-lo.');
  if (photo.uploadStatus === 'ready') return { photoId: data.photoId, status: 'ready' as const };
  if (photo.uploadStatus !== 'pending') throw new HttpsError('failed-precondition', 'Este upload não está pendente.');

  const file = adminStorage.bucket().file(String(photo.storagePath));
  let objectMetadata: { size?: string | number; contentType?: string; metadata?: Record<string, unknown> };
  let bytes: Buffer;
  try {
    [objectMetadata] = await file.getMetadata();
    const [download] = await file.download({ start: 0, end: 11 });
    bytes = download;
  } catch {
    throw new HttpsError('failed-precondition', 'O arquivo não chegou ao armazenamento. Tente enviar novamente.');
  }
  const size = Number(objectMetadata.size);
  const contentType = String(objectMetadata.contentType ?? '').toLowerCase();
  const customMetadata = objectMetadata.metadata ?? {};
  const isPng = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp = bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!Number.isFinite(size) || size <= 0 || size > maxPhotoBytes
    || contentType !== photo.contentType || !acceptedTypes.includes(contentType)
    || customMetadata.photoId !== data.photoId || customMetadata.orderId !== data.orderId
    || !(isPng || isJpeg || isWebp)) {
    await file.delete({ ignoreNotFound: true }).catch(() => undefined);
    await photoRef.update({ uploadStatus: 'rejected', rejectedAt: Timestamp.now() });
    throw new HttpsError('failed-precondition', 'A imagem enviada não passou pela validação de tamanho, tipo ou conteúdo.');
  }

  const auditRef = adminDb.collection('auditLogs').doc();
  await adminDb.runTransaction(async (transaction) => {
    const current = await transaction.get(photoRef);
    if (!current.exists || current.data()?.uploadStatus !== 'pending' || current.data()?.uploadedBy !== call.auth!.uid) {
      throw new HttpsError('failed-precondition', 'O estado do upload foi alterado; recarregue o pedido.');
    }
    transaction.update(photoRef, { uploadStatus: 'ready', size, contentType, uploadedAt: Timestamp.now() });
    transaction.create(auditRef, {
      actorId: call.auth!.uid, atelierId: data.atelierId, action: 'production.photo_uploaded',
      entity: 'order', entityId: data.orderId,
      after: { photoId: data.photoId, stageId: photo.stageId, visibleToClient: photo.visibleToClient, size, contentType },
      timestamp: FieldValue.serverTimestamp(),
    });
  });
  return { photoId: data.photoId, status: 'ready' as const };
});
