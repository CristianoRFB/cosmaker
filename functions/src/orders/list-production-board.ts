import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { requireOrderManager, requireVerifiedIdentity } from './access';

export const listProductionBoard = onCall(async (call) => {
  requireVerifiedIdentity(call.auth);
  const { atelierId } = call.data as { atelierId?: unknown };
  if (typeof atelierId !== 'string' || !atelierId) throw new HttpsError('invalid-argument', 'Ateliê obrigatório.');
  await requireOrderManager(atelierId, call.auth!.uid, 'orders:read');
  const stageQuery = await adminDb.collectionGroup('productionStages')
    .where('atelierId', '==', atelierId)
    .orderBy('order', 'asc')
    .limit(600)
    .get();
  const orderRefs = [...new Map(stageQuery.docs.flatMap((stage) => {
    const orderRef = stage.ref.parent.parent;
    return orderRef && orderRef.path.startsWith(`ateliers/${atelierId}/orders/`) ? [[orderRef.path, orderRef] as const] : [];
  })).values()];
  const orderSnapshots = [];
  for (let offset = 0; offset < orderRefs.length; offset += 100) {
    orderSnapshots.push(...await adminDb.getAll(...orderRefs.slice(offset, offset + 100)));
  }
  const orders = new Map(orderSnapshots.filter((snapshot) => snapshot.exists).map((snapshot) => [snapshot.ref.path, snapshot.data()!]));
  return {
    stages: stageQuery.docs.flatMap((snapshot) => {
      const orderRef = snapshot.ref.parent.parent;
      const order = orderRef ? orders.get(orderRef.path) : undefined;
      if (!order || order.status === 'cancelled' || order.status === 'refunded' || order.status === 'completed') return [];
      const stage = snapshot.data();
      return [{
        id: snapshot.id, atelierId, orderId: orderRef!.id,
        name: stage.name, order: stage.order, status: stage.status,
        progress: stage.progress, progressWeight: stage.progressWeight,
        requiresClientApproval: stage.requiresClientApproval,
        pendingApprovalId: stage.pendingApprovalId ?? null,
        notes: stage.notes ?? null,
        character: order.character, clientName: order.clientName,
        expectedDeliveryDate: order.expectedDeliveryDate,
        priority: order.priority, orderStatus: order.status,
        orderProgress: order.progress,
      }];
    }),
  };
});
