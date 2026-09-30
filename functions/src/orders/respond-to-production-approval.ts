import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminDb } from '../admin';
import { requireVerifiedIdentity } from './access';
import { calculateWeightedProductionProgress } from './production-template';

export const respondToProductionApproval = onCall(async (call) => {
  const identity = requireVerifiedIdentity(call.auth);
  const data = call.data as { atelierId?: unknown; orderId?: unknown; approvalId?: unknown; decision?: unknown; comment?: unknown };
  if (typeof data.atelierId !== 'string' || typeof data.orderId !== 'string' || typeof data.approvalId !== 'string') {
    throw new HttpsError('invalid-argument', 'Ateliê, pedido e aprovação são obrigatórios.');
  }
  if (data.decision !== 'approved' && data.decision !== 'changes_requested') throw new HttpsError('invalid-argument', 'Resposta de aprovação inválida.');
  const comment = typeof data.comment === 'string' ? data.comment.trim() : '';
  if (comment.length > 1000 || (data.decision === 'changes_requested' && comment.length < 5)) {
    throw new HttpsError('invalid-argument', 'Descreva o ajuste em até 1.000 caracteres.');
  }

  const orderRef = adminDb.doc(`ateliers/${data.atelierId}/orders/${data.orderId}`);
  const approvalRef = orderRef.collection('approvals').doc(data.approvalId);
  const orderHistoryRef = orderRef.collection('statusHistory').doc();
  const eventRef = approvalRef.collection('events').doc();
  const auditRef = adminDb.collection('auditLogs').doc();
  let finalStatus = '';
  let finalProgress = 0;

  await adminDb.runTransaction(async (transaction) => {
    const [orderSnapshot, approvalSnapshot] = await Promise.all([transaction.get(orderRef), transaction.get(approvalRef)]);
    if (!orderSnapshot.exists || !approvalSnapshot.exists) throw new HttpsError('not-found', 'A etapa aguardando sua aprovação não foi encontrada.');
    const order = orderSnapshot.data()!;
    const approval = approvalSnapshot.data()!;
    const email = typeof identity.email === 'string' ? identity.email.trim().toLowerCase() : '';
    if (!email || String(order.email).trim().toLowerCase() !== email) throw new HttpsError('permission-denied', 'Este pedido não pertence à sua conta verificada.');
    if (approval.status !== 'pending') throw new HttpsError('failed-precondition', 'Esta aprovação já recebeu uma resposta.');
    const stageRef = orderRef.collection('productionStages').doc(String(approval.stageId));
    const [stageSnapshot, allStages] = await Promise.all([transaction.get(stageRef), transaction.get(orderRef.collection('productionStages').orderBy('order', 'asc'))]);
    if (!stageSnapshot.exists || stageSnapshot.data()?.status !== 'waiting_approval') throw new HttpsError('failed-precondition', 'A etapa não está aguardando uma resposta.');

    const now = Timestamp.now();
    const accepted = data.decision === 'approved';
    const nextStageStatus = accepted ? 'completed' : 'in_progress';
    const nextStageProgress = accepted ? 100 : 50;
    const stages = allStages.docs.map((stage) => ({
      progress: stage.id === stageRef.id ? nextStageProgress : Number(stage.data().progress) || 0,
      progressWeight: Number(stage.data().progressWeight),
    }));
    finalProgress = calculateWeightedProductionProgress(stages);
    finalStatus = accepted ? String(order.status) : 'adjustments';
    transaction.update(approvalRef, {
      status: data.decision, respondedBy: call.auth!.uid, responseComment: comment || null, respondedAt: now,
    });
    transaction.create(eventRef, {
      actorId: call.auth!.uid, action: data.decision, comment: comment || null, createdAt: now,
    });
    transaction.update(stageRef, {
      status: nextStageStatus, progress: nextStageProgress, pendingApprovalId: null,
      ...(accepted ? { completedAt: now } : { notes: comment }), updatedAt: now,
    });
    transaction.update(orderRef, { status: finalStatus, progress: finalProgress, updatedAt: now });
    transaction.create(orderHistoryRef, {
      status: finalStatus, actorId: call.auth!.uid,
      source: accepted ? 'client_approved_production_stage' : 'client_requested_production_adjustment', createdAt: now,
    });
    transaction.create(auditRef, {
      actorId: call.auth!.uid, atelierId: data.atelierId,
      action: accepted ? 'production.client_approved_stage' : 'production.client_requested_adjustment',
      entity: 'order', entityId: data.orderId,
      before: { approvalStatus: approval.status, stageStatus: stageSnapshot.data()?.status, orderStatus: order.status },
      after: { approvalStatus: data.decision, stageStatus: nextStageStatus, orderStatus: finalStatus, comment: comment || null },
      timestamp: FieldValue.serverTimestamp(),
    });
  });
  return { orderId: data.orderId, approvalId: data.approvalId, status: data.decision, progress: finalProgress };
});
