import { describe, expect, it } from 'vitest';
import { photosForProductionApproval } from '../../features/production/approval-evidence';
import type { ProductionApproval, ProductionPhoto } from '../../types/production';

const approval = { id: 'approval', atelierId: 'atelier', orderId: 'order', stageId: 'stage-fitting', stageName: 'Prova', clientId: 'client', status: 'pending', requestedAt: { seconds: 100, nanoseconds: 50 } } as ProductionApproval;
function photo(id: string, seconds = 90): ProductionPhoto {
  return { id, atelierId: 'atelier', orderId: 'order', stageId: 'stage-fitting', storagePath: `ateliers/atelier/orders/order/production/${id}`, caption: '', originalName: 'proof.png', contentType: 'image/png', size: 12, visibleToClient: true, uploadStatus: 'ready', uploadedBy: 'owner', createdAt: { seconds, nanoseconds: 0 }, storageGeneration: 'generation-1' };
}

describe('client production approval evidence', () => {
  it('shows exactly the immutable evidence set, excluding later images and changed generations', () => {
    const first = photo('first'); const later = photo('later', 101);
    const snapshot = { ...approval, photoEvidence: [{ photoId: first.id, storagePath: first.storagePath, storageGeneration: first.storageGeneration ?? null }] };
    expect(photosForProductionApproval(snapshot, [first, later]).map((item) => item.id)).toEqual(['first']);
    expect(photosForProductionApproval(snapshot, [{ ...first, storageGeneration: 'changed-generation' }])).toEqual([]);
  });

  it('uses only verified earlier visible/ready photos for a legacy approval', () => {
    expect(photosForProductionApproval(approval, [photo('before'), photo('after', 101), { ...photo('private'), visibleToClient: false }, { ...photo('pending'), uploadStatus: 'pending' }]).map((item) => item.id)).toEqual(['before']);
    expect(photosForProductionApproval(approval, [{ ...photo('unknown-date'), createdAt: undefined }])).toEqual([]);
  });
});
