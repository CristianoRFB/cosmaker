import type { ProductionApproval, ProductionPhoto } from '@/types/production';

function timestampParts(value: unknown): { seconds: number; nanoseconds: number } | null {
  if (value && typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value
    && typeof value.seconds === 'number' && typeof value.nanoseconds === 'number') return { seconds: value.seconds, nanoseconds: value.nanoseconds };
  const milliseconds = value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(milliseconds)) return null;
  return { seconds: Math.floor(milliseconds / 1000), nanoseconds: (milliseconds % 1000) * 1_000_000 };
}

export function photosForProductionApproval(approval: ProductionApproval, photos: ProductionPhoto[]) {
  return photos.filter((photo) => {
    if (photo.stageId !== approval.stageId || !photo.visibleToClient || photo.uploadStatus !== 'ready') return false;
    if (approval.photoEvidence !== undefined) return approval.photoEvidence.some((evidence) => evidence.photoId === photo.id
      && evidence.storagePath === photo.storagePath && evidence.storageGeneration === (photo.storageGeneration ?? null));
    const requested = timestampParts(approval.requestedAt);
    const uploaded = timestampParts(photo.uploadedAt ?? photo.createdAt);
    return requested && uploaded && (uploaded.seconds < requested.seconds || (uploaded.seconds === requested.seconds && uploaded.nanoseconds <= requested.nanoseconds));
  });
}
