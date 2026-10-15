import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

export interface ProductionPhotoEvidence {
  photoId: string;
  storagePath: string;
  storageGeneration: string | null;
}

export function captureProductionPhotoEvidence(atelierId: string, orderId: string, stageId: string, photoId: string, photo: Record<string, unknown>): ProductionPhotoEvidence {
  const expectedPath = `ateliers/${atelierId}/orders/${orderId}/production/${photoId}`;
  if (photo.uploadStatus !== 'ready' || photo.visibleToClient !== true || photo.stageId !== stageId || photo.storagePath !== expectedPath
    || (photo.storageGeneration !== undefined && photo.storageGeneration !== null && (typeof photo.storageGeneration !== 'string' || !photo.storageGeneration))) {
    throw new HttpsError('failed-precondition', 'Uma foto de evidência não corresponde ao pedido e à etapa.');
  }
  return { photoId, storagePath: expectedPath, storageGeneration: typeof photo.storageGeneration === 'string' ? photo.storageGeneration : null };
}

export function photoExistedBeforeProductionApproval(photo: Record<string, unknown>, requestedAt: unknown) {
  const uploadedAt = photo.uploadedAt ?? photo.createdAt;
  return uploadedAt instanceof Timestamp && requestedAt instanceof Timestamp
    && (uploadedAt.seconds < requestedAt.seconds || (uploadedAt.seconds === requestedAt.seconds && uploadedAt.nanoseconds <= requestedAt.nanoseconds));
}
