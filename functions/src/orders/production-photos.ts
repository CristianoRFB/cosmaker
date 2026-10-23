import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb, adminStorage } from '../admin';
import { requireOrderManager, requireVerifiedIdentity } from './access';
import { requireNonDemoWorkspace } from '../commercial/access';
import { productionId, readProductionManager } from './production-configuration';
import { revokeOrderFileTokens } from './order-file-storage';

export const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'];
export const maxPhotoBytes = 10 * 1024 * 1024;
export const activeOrderStatuses = ['confirmed', 'scheduled', 'modeling', 'in_production', 'fitting', 'adjustments', 'finishing', 'paused', 'ready_to_ship', 'waiting_final_payment'];

export const createProductionPhotoUpload = onCall(async (call) => {
  requireVerifiedIdentity(call.auth);
  const data = call.data as {
    atelierId?: unknown; orderId?: unknown; stageId?: unknown; originalName?: unknown;
    contentType?: unknown; caption?: unknown; visibleToClient?: unknown;
  };
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some((key) => !['atelierId', 'orderId', 'stageId', 'originalName', 'contentType', 'caption', 'visibleToClient'].includes(key))) throw new HttpsError('invalid-argument', 'Há campos fora do contrato da foto.');
  productionId(data.atelierId, 'Ateliê'); productionId(data.orderId, 'Pedido'); productionId(data.stageId, 'Etapa');
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
  if ((data.caption !== undefined && typeof data.caption !== 'string') || caption.length > 500 || typeof data.visibleToClient !== 'boolean') {
    throw new HttpsError('invalid-argument', 'Descrição ou visibilidade da foto inválida.');
  }
  await requireOrderManager(data.atelierId, call.auth!.uid, 'orders:manage');
  await requireNonDemoWorkspace(data.atelierId);

  const orderRef = adminDb.doc(`ateliers/${data.atelierId}/orders/${data.orderId}`);
  const photoRef = orderRef.collection('photos').doc();
  const storagePath = `ateliers/${data.atelierId}/orders/${data.orderId}/production/${photoRef.id}`;
  await adminDb.runTransaction(async (transaction) => {
    const [actor, order, stage] = await Promise.all([
      readProductionManager(transaction, data.atelierId as string, call.auth!.uid), transaction.get(orderRef),
      transaction.get(orderRef.collection('productionStages').doc(data.stageId as string)),
    ]);
    if (actor.atelier.demoWorkspace === true) throw new HttpsError('failed-precondition', 'Fotos de produção não são gravadas no espaço demonstrativo.');
    if (!order.exists || !stage.exists) throw new HttpsError('not-found', 'Pedido ou etapa não encontrados.');
    if (!activeOrderStatuses.includes(String(order.data()?.status))) throw new HttpsError('failed-precondition', 'Fotos só podem ser anexadas em pedidos ativos com entrada confirmada.');
    if (!['in_progress', 'completed', 'approved', 'blocked'].includes(String(stage.data()?.status))) throw new HttpsError('failed-precondition', 'Fotos novas exigem etapa iniciada e sem aprovação pendente. Aguarde a resposta do cliente antes de alterar a evidência.');
    transaction.create(photoRef, {
      atelierId: data.atelierId, orderId: data.orderId, stageId: data.stageId,
      storagePath, caption, originalName: (data.originalName as string).trim(), contentType: data.contentType,
      size: null, visibleToClient: data.visibleToClient, uploadStatus: 'pending',
      uploadedBy: call.auth!.uid, createdAt: FieldValue.serverTimestamp(),
    });
  });
  return { photoId: photoRef.id, storagePath };
});

export async function finishProductionPhotoUpload(call: { auth?: { uid: string; token: Record<string, unknown> }; data: unknown }, leaseId?: string) {
  requireVerifiedIdentity(call.auth);
  const data = call.data as { atelierId?: unknown; orderId?: unknown; photoId?: unknown };
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some((key) => !['atelierId', 'orderId', 'photoId'].includes(key))) throw new HttpsError('invalid-argument', 'Há campos fora do contrato da foto.');
  productionId(data.atelierId, 'Ateliê'); productionId(data.orderId, 'Pedido'); productionId(data.photoId, 'Foto');
  if (typeof data.atelierId !== 'string' || typeof data.orderId !== 'string' || typeof data.photoId !== 'string') {
    throw new HttpsError('invalid-argument', 'Ateliê, pedido e foto são obrigatórios.');
  }
  await requireOrderManager(data.atelierId, call.auth!.uid, 'orders:manage');
  await requireNonDemoWorkspace(data.atelierId);
  const orderRef = adminDb.doc(`ateliers/${data.atelierId}/orders/${data.orderId}`);
  const photoRef = orderRef.collection('photos').doc(data.photoId);
  const photo = await adminDb.runTransaction(async (transaction) => {
    const [actor, photoSnapshot, order] = await Promise.all([
      readProductionManager(transaction, data.atelierId as string, call.auth!.uid), transaction.get(photoRef), transaction.get(orderRef),
    ]);
    if (actor.atelier.demoWorkspace === true) throw new HttpsError('failed-precondition', 'Fotos de produção não são gravadas no espaço demonstrativo.');
    if (!photoSnapshot.exists) throw new HttpsError('not-found', 'A solicitação de upload não foi encontrada.');
    const current = photoSnapshot.data()!;
    if (current.uploadedBy !== call.auth!.uid) throw new HttpsError('permission-denied', 'Somente quem iniciou este upload pode finalizá-lo.');
    if (current.uploadStatus === 'pending' && current.uploadLeaseId !== undefined && current.uploadLeaseId !== leaseId) throw new HttpsError('aborted', 'A tentativa de envio está em andamento. Aguarde a conclusão.');
    if (current.uploadStatus !== 'ready' && (!order.exists || !activeOrderStatuses.includes(String(order.get('status'))))) throw new HttpsError('failed-precondition', 'O pedido não está ativo para finalizar este upload.');
    if (current.storagePath !== `ateliers/${data.atelierId}/orders/${data.orderId}/production/${data.photoId}`) throw new HttpsError('failed-precondition', 'O arquivo não pertence ao pedido.');
    return current;
  });
  if (photo.uploadStatus === 'ready') {
    await revokeOrderFileTokens(String(photo.storagePath));
    return { photoId: data.photoId, status: 'ready' as const };
  }
  if (photo.uploadStatus !== 'pending') throw new HttpsError('failed-precondition', 'Este upload não está pendente.');

  const file = adminStorage.bucket().file(String(photo.storagePath));
  let objectMetadata: { size?: string | number; contentType?: string; metadata?: Record<string, unknown>; generation?: string | number };
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
    || !((contentType === 'image/png' && isPng) || (contentType === 'image/jpeg' && isJpeg) || (contentType === 'image/webp' && isWebp))) {
    await adminDb.runTransaction(async (transaction) => {
      const [actor, current, order] = await Promise.all([readProductionManager(transaction, data.atelierId as string, call.auth!.uid), transaction.get(photoRef), transaction.get(orderRef)]);
      if (actor.atelier.demoWorkspace === true) throw new HttpsError('failed-precondition', 'Fotos de produção não são gravadas no espaço demonstrativo.');
      if (!activeOrderStatuses.includes(String(order.get('status'))) || current.get('uploadStatus') !== 'pending' || current.get('uploadedBy') !== call.auth!.uid) throw new HttpsError('failed-precondition', 'O pedido ou o upload mudou. Atualize a tela.');
      transaction.update(photoRef, { uploadStatus: 'rejected', rejectedAt: Timestamp.now() });
    });
    await file.delete({ ignoreNotFound: true }).catch(() => undefined);
    throw new HttpsError('failed-precondition', 'A imagem enviada não passou pela validação de tamanho, tipo ou conteúdo.');
  }

  await revokeOrderFileTokens(String(photo.storagePath));
  const [privateMetadata] = await file.getMetadata();
  objectMetadata.generation = privateMetadata.generation;
  const auditRef = adminDb.collection('auditLogs').doc();
  await adminDb.runTransaction(async (transaction) => {
    const [actor, current, order] = await Promise.all([
      readProductionManager(transaction, data.atelierId as string, call.auth!.uid), transaction.get(photoRef), transaction.get(orderRef),
    ]);
    if (actor.atelier.demoWorkspace === true) throw new HttpsError('failed-precondition', 'Fotos de produção não são gravadas no espaço demonstrativo.');
    if (current.get('uploadStatus') === 'ready' && current.get('uploadedBy') === call.auth!.uid) return;
    if (!order.exists || !activeOrderStatuses.includes(String(order.get('status')))) throw new HttpsError('failed-precondition', 'O pedido não está ativo para finalizar este upload.');
    const stage = await transaction.get(orderRef.collection('productionStages').doc(productionId(current.get('stageId'), 'Etapa')));
    if (!stage.exists || !['in_progress', 'completed', 'approved', 'blocked'].includes(String(stage.get('status')))) throw new HttpsError('failed-precondition', 'Fotos novas não podem mudar a evidência de uma aprovação pendente. Aguarde a resposta do cliente.');
    if (current.get('uploadLeaseId') !== undefined && current.get('uploadLeaseId') !== leaseId) throw new HttpsError('aborted', 'A tentativa de envio mudou. Atualize o pedido.');
    if (!current.exists || current.data()?.uploadStatus !== 'pending' || current.data()?.uploadedBy !== call.auth!.uid) {
      throw new HttpsError('failed-precondition', 'O estado do upload foi alterado; recarregue o pedido.');
    }
    transaction.update(photoRef, { uploadStatus: 'ready', size, contentType, storageGeneration: objectMetadata.generation === undefined ? null : String(objectMetadata.generation), uploadedAt: Timestamp.now() });
    transaction.create(auditRef, {
      actorId: call.auth!.uid, atelierId: data.atelierId, action: 'production.photo_uploaded',
      entity: 'order', entityId: data.orderId,
      after: { photoId: data.photoId, stageId: photo.stageId, visibleToClient: photo.visibleToClient, size, contentType },
      timestamp: FieldValue.serverTimestamp(),
    });
  });
  return { photoId: data.photoId, status: 'ready' as const };
}

export const completeProductionPhotoUpload = onCall((call) => finishProductionPhotoUpload(call));
